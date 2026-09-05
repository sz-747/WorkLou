'use client';

import { useCallback, useEffect, useState } from 'react';

interface Change {
  id: number;
  service_id: number;
  field: string;
  stored_value: string;
  extracted_value: string;
  source_url: string;
  detected_at: string;
  service_name: string;
}

interface Summary {
  total: number;
  verified: number;
  stale: number;
  needs_review: number;
  pendingChanges: number;
  lastRun: {
    id: number;
    trigger: string;
    started_at: string;
    finished_at: string | null;
    services_checked: number;
    matches: number;
    changes_detected: number;
    failures: number;
    latency_ms: number;
  } | null;
}

const FIELD_LABELS: Record<string, string> = {
  opening_hours: 'Opening hours',
  phone: 'Phone',
  address: 'Address',
  eligibility: 'Eligibility',
  children_allowed: 'Children accepted',
  walk_in_allowed: 'Walk-ins allowed',
  referral_required: 'Referral required',
};

export default function VerificationDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/verification/summary');
    const data = await res.json();
    setSummary(data.summary);
    setChanges(data.changes);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runNow() {
    setRunning(true);
    await fetch('/api/verification/run', { method: 'POST' });
    await load();
    setRunning(false);
  }

  async function review(id: number, decision: 'approve' | 'reject') {
    setBusyId(id);
    await fetch(`/api/verification/changes/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    await load();
    setBusyId(null);
  }

  return (
    <div>
      <h1>Verification</h1>
      <p className="sub">Each service is checked against its official source. Changes are flagged for a human — nothing is overwritten automatically.</p>

      {summary && (
        <div className="stat-grid">
          <div className="stat"><div className="n">{summary.total}</div><div className="l">Total services</div></div>
          <div className="stat"><div className="n">{summary.verified}</div><div className="l">Verified</div></div>
          <div className="stat"><div className="n">{summary.stale}</div><div className="l">Not verified in 30+ days</div></div>
          <div className="stat"><div className="n">{summary.pendingChanges}</div><div className="l">Awaiting review</div></div>
        </div>
      )}

      {summary?.lastRun && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>Last verification run</strong>{' '}
          <span className="muted">
            ({summary.lastRun.trigger}) — checked {summary.lastRun.services_checked}, matched{' '}
            {summary.lastRun.matches}, flagged {summary.lastRun.changes_detected}, failed{' '}
            {summary.lastRun.failures}, in {summary.lastRun.latency_ms} ms ·{' '}
            {new Date(summary.lastRun.started_at).toLocaleString('en-AU')}
          </span>
        </div>
      )}

      <div className="row" style={{ margin: '12px 0 20px' }}>
        <button onClick={runNow} disabled={running}>{running ? 'Running…' : 'Run verification now'}</button>
        <span className="muted">A scheduled job also runs this every 6 hours.</span>
      </div>

      <h2>Changes detected — need your review</h2>
      {changes.length === 0 && <p className="muted">Nothing waiting for review. Run a verification to check sources.</p>}
      {changes.map((c) => (
        <div key={c.id} className="card">
          <div className="result-head">
            <div>
              <strong>{c.service_name}</strong>
              <span className="muted"> · {FIELD_LABELS[c.field] ?? c.field}</span>
            </div>
            <span className="badge warn">Possible change detected</span>
          </div>
          <div className="diff">
            <div className="old">Stored: {c.stored_value}</div>
            <div className="new">Current source: {c.extracted_value}</div>
          </div>
          <p className="muted">
            <a href={c.source_url ?? '#'} target="_blank" rel="noreferrer">Open source ↗</a> · detected{' '}
            {new Date(c.detected_at).toLocaleString('en-AU')}
          </p>
          <div className="row">
            <button className="small" disabled={busyId === c.id} onClick={() => review(c.id, 'approve')}>
              Approve update
            </button>
            <button className="danger small" disabled={busyId === c.id} onClick={() => review(c.id, 'reject')}>
              Keep existing
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
