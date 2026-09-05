import { pool } from './db';
import { compareFacts, extractFacts, fetchSource, VerifiedField, FIELD_COLUMNS } from './extract';
import type { ServiceRow } from './types';

export interface RunSummary {
  runId: number;
  trigger: string;
  servicesChecked: number;
  matches: number;
  changesDetected: number;
  failures: number;
  latencyMs: number;
}

export async function runVerification(trigger: string): Promise<RunSummary> {
  const started = Date.now();
  const run = await pool.query(
    `INSERT INTO verification_runs (trigger, started_at) VALUES ($1, now()) RETURNING id`,
    [trigger]
  );
  const runId = run.rows[0].id;

  // Due records for scheduled runs; everything for manual/eval runs (small dataset)
  const onlyDue = trigger === 'scheduled';
  const services = (
    await pool.query<ServiceRow>(
      `SELECT * FROM services ${onlyDue ? 'WHERE verification_due_at IS NULL OR verification_due_at <= now()' : ''} ORDER BY id`
    )
  ).rows;

  let matches = 0;
  let changesDetected = 0;
  let failures = 0;

  for (const s of services) {
    const src = await fetchSource(s);
    if (!src.ok) {
      failures++;
      continue;
    }
    const facts = await extractFacts(s, src.text);
    const changes = compareFacts(s, facts);

    if (changes.length === 0) {
      await pool.query(
        `UPDATE services SET last_verified_at = now(), verification_due_at = now() + interval '14 days',
           verification_status = 'verified', updated_at = now() WHERE id = $1`,
        [s.id]
      );
      matches++;
    } else {
      for (const ch of changes) {
        // don't duplicate an existing pending change for the same field
        const existing = await pool.query(
          `SELECT id FROM verification_changes WHERE service_id = $1 AND field = $2 AND status = 'pending'`,
          [s.id, ch.field]
        );
        if (existing.rows.length > 0) continue;
        await pool.query(
          `INSERT INTO verification_changes (service_id, field, stored_value, extracted_value, source_url, status, verification_run_id)
           VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
          [s.id, ch.field, ch.stored, ch.extracted, s.source_url, runId]
        );
      }
      await pool.query(
        `UPDATE services SET verification_status = 'needs_review', updated_at = now() WHERE id = $1`,
        [s.id]
      );
      changesDetected += changes.length;
    }
  }

  const latencyMs = Date.now() - started;
  await pool.query(
    `UPDATE verification_runs SET finished_at = now(), services_checked = $1, matches = $2,
       changes_detected = $3, failures = $4, latency_ms = $5 WHERE id = $6`,
    [services.length, matches, changesDetected, failures, latencyMs, runId]
  );

  return { runId, trigger, servicesChecked: services.length, matches, changesDetected, failures, latencyMs };
}

export async function reviewChange(changeId: number, decision: 'approve' | 'reject'): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ch = await client.query(
      `SELECT * FROM verification_changes WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [changeId]
    );
    if (ch.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    const row = ch.rows[0];
    if (decision === 'approve') {
      const col = FIELD_COLUMNS[row.field as VerifiedField];
      if (!col) {
        await client.query('ROLLBACK');
        return false;
      }
      let value: unknown = row.extracted_value;
      if (['children_allowed', 'walk_in_allowed', 'referral_required'].includes(col)) {
        value = /^yes$/i.test(row.extracted_value || '');
      }
      await client.query(`UPDATE services SET ${col} = $1, last_verified_at = now(),
        verification_due_at = now() + interval '14 days', verification_status = 'verified', updated_at = now() WHERE id = $2`, [value, row.service_id]);
    }
    await client.query(
      `UPDATE verification_changes SET status = $1, reviewed_at = now() WHERE id = $2`,
      [decision === 'approve' ? 'approved' : 'rejected', changeId]
    );
    await client.query('COMMIT');
  } finally {
    client.release();
  }
  if (decision === 'reject') await reconcileStatuses();
  return true;
}

// Reset any "needs_review" status that no longer has a pending change
export async function reconcileStatuses(): Promise<void> {
  await pool.query(
    `UPDATE services SET verification_status = 'verified'
     WHERE verification_status = 'needs_review'
       AND NOT EXISTS (SELECT 1 FROM verification_changes vc WHERE vc.service_id = services.id AND vc.status = 'pending')`
  );
}

export async function verificationSummary() {
  const stats = await pool.query(
    `SELECT count(*)::int AS total,
       count(*) FILTER (WHERE verification_status = 'verified')::int AS verified,
       count(*) FILTER (WHERE last_verified_at IS NULL OR last_verified_at < now() - interval '30 days')::int AS stale,
       count(*) FILTER (WHERE verification_status = 'needs_review')::int AS needs_review
     FROM services`
  );
  const pending = await pool.query(
    `SELECT count(*)::int AS n FROM verification_changes WHERE status = 'pending'`
  );
  const lastRun = await pool.query(
    `SELECT * FROM verification_runs ORDER BY started_at DESC LIMIT 1`
  );
  return {
    ...stats.rows[0],
    pendingChanges: pending.rows[0].n,
    lastRun: lastRun.rows[0] ?? null,
  };
}

export async function pendingChanges() {
  const res = await pool.query(
    `SELECT vc.*, s.name AS service_name FROM verification_changes vc
     JOIN services s ON s.id = vc.service_id
     WHERE vc.status = 'pending' ORDER BY vc.detected_at DESC`
  );
  return res.rows;
}
