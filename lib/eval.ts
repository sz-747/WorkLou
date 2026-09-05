import { pool } from './db';
import { parseReferralQuery } from './parse';
import { searchServices } from './search';
import type { ServiceRow } from './types';
import { VERIFIED_FIELDS, VerifiedField } from './extract';

// ---- Search evaluation ----
export interface Scenario {
  id: string;
  name: string;
  query: string;
  validServices: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'S1',
    name: 'Emergency accommodation tonight, two children, Redfern',
    query: 'Emergency accommodation tonight for a woman with two children near Redfern.',
    validServices: ["Redfern Women's Refuge", 'Waterloo Crisis Accommodation'],
  },
  {
    id: 'S2',
    name: 'Food assistance this week near Redfern, children welcome',
    query: 'Food assistance this week near Redfern, accepts children.',
    validServices: ['Redfern Community Food Bank', 'Waterloo Food Distribution Centre', 'Marrickville Meals Program'],
  },
  {
    id: 'S3',
    name: 'Legal help near Redfern this week',
    query: 'Legal help about housing near Redfern this week.',
    validServices: ['Redfern Legal Centre', "Sydney Women's Legal Advice", 'Tenancy Advocacy Service'],
  },
  {
    id: 'S4',
    name: 'DFV support with children in Bankstown, no referral needed',
    query: 'DFV support for a woman with children in Bankstown, no referral needed.',
    validServices: ['Bankstown DFV Case Support'],
  },
  {
    id: 'S5',
    name: 'Emergency accommodation with children in Parramatta',
    query: 'Emergency accommodation for a woman with children in Parramatta.',
    validServices: ["Western Sydney Women's Refuge"],
  },
];

export interface ScenarioResult {
  scenarioId: string;
  name: string;
  query: string;
  returned: string[];
  validReturned: string[];
  invalidReturned: string[];
  missedValid: string[];
  validReferralRate: number;
  invalidReferralRate: number;
  coverage: number;
  parserSource: string;
}

export interface SearchEvalResult {
  scenarios: ScenarioResult[];
  overall: {
    validReferralRate: number;
    invalidReferralRate: number;
    coverage: number;
    scenariosRun: number;
  };
  timeToValidReferral: {
    sampleCount: number;
    medianMs: number | null;
    note: string;
  };
  ranAt: string;
}

export async function runSearchEval(): Promise<SearchEvalResult> {
  const services = (await pool.query<ServiceRow>(`SELECT * FROM services ORDER BY id`)).rows;
  const byName = new Map(services.map((s) => [s.name, s]));
  const results: ScenarioResult[] = [];

  for (const sc of SCENARIOS) {
    const { criteria, source } = await parseReferralQuery(sc.query);
    const { full } = searchServices(services, criteria);
    const returned = full.map((m) => m.name);
    const validSet = new Set(sc.validServices);
    const validReturned = returned.filter((n) => validSet.has(n));
    const invalidReturned = returned.filter((n) => !validSet.has(n));
    const returnedSet = new Set(returned);
    const missedValid = sc.validServices.filter((n) => !returnedSet.has(n) && byName.has(n));
    results.push({
      scenarioId: sc.id,
      name: sc.name,
      query: sc.query,
      returned,
      validReturned,
      invalidReturned,
      missedValid,
      validReferralRate: returned.length ? validReturned.length / returned.length : 0,
      invalidReferralRate: returned.length ? invalidReturned.length / returned.length : 0,
      coverage: sc.validServices.length ? validReturned.length / sc.validServices.length : 0,
      parserSource: source,
    });
  }

  const totalReturned = results.reduce((a, r) => a + r.returned.length, 0);
  const totalValidReturned = results.reduce((a, r) => a + r.validReturned.length, 0);
  const totalValid = results.reduce((a, r) => a + SCENARIOS.find((s) => s.id === r.scenarioId)!.validServices.length, 0);

  const timings = (
    await pool.query(`SELECT selected_after_ms FROM referral_searches WHERE selected_after_ms IS NOT NULL`)
  ).rows as { selected_after_ms: number }[];
  const sorted = timings.map((t) => t.selected_after_ms).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;

  return {
    scenarios: results,
    overall: {
      validReferralRate: totalReturned ? totalValidReturned / totalReturned : 0,
      invalidReferralRate: totalReturned ? (totalReturned - totalValidReturned) / totalReturned : 0,
      coverage: totalValid ? totalValidReturned / totalValid : 0,
      scenariosRun: results.length,
    },
    timeToValidReferral: {
      sampleCount: sorted.length,
      medianMs: median,
      note:
        sorted.length > 0
          ? 'Median time from search start to a caseworker selecting a service, measured from live usage.'
          : 'No selections recorded yet — use the frontline search and choose a service to collect samples.',
    },
    ranAt: new Date().toISOString(),
  };
}

// ---- Verification evaluation ----
export interface VerificationEvalResult {
  plantedChanges: number;
  detectedChanges: number;
  changeDetectionRecall: number;
  falsePositives: number;
  falsePositiveRate: number;
  extractionAccuracy: number;
  verificationLatencyMs: number;
  details: {
    service: string;
    field: string;
    plantedValue: string;
    detected: boolean;
    extractedValue?: string;
    extractedCorrectly?: boolean;
  }[];
  ranAt: string;
}

const PLANT_PLAN: { field: VerifiedField; line: RegExp; value: string }[] = [
  { field: 'opening_hours', line: /Opening hours:.*/, value: 'Opening hours: Mon–Fri 10am–2pm' },
  { field: 'phone', line: /Phone:.*/, value: 'Phone: 02 9000 1111' },
  { field: 'eligibility', line: /Eligibility:.*/, value: 'Eligibility: Adults in the local area' },
  { field: 'opening_hours', line: /Opening hours:.*/, value: 'Opening hours: Mon–Thu 9am–4pm' },
  { field: 'phone', line: /Phone:.*/, value: 'Phone: 02 9000 2222' },
  { field: 'opening_hours', line: /Opening hours:.*/, value: 'Opening hours: Tue–Sat 10am–3pm' },
  { field: 'eligibility', line: /Eligibility:.*/, value: 'Eligibility: Anyone in need of support' },
  { field: 'phone', line: /Phone:.*/, value: 'Phone: 02 9000 3333' },
];

export async function runVerificationEval(): Promise<VerificationEvalResult> {
  // Plant controlled changes in local source fixtures for the first 8 services
  // (ids 1–8; the two seeded drift records 9 & 13 are outside this set).
  const planted = await pool.query<{ service_id: number; content: string; name: string }>(
    `SELECT sf.service_id, sf.content, s.name FROM source_fixtures sf JOIN services s ON s.id = sf.service_id
     WHERE sf.service_id <= 8 ORDER BY sf.service_id`
  );
  const originals: { service_id: number; content: string }[] = [];
  const details: VerificationEvalResult['details'] = [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < planted.rows.length; i++) {
      const row = planted.rows[i];
      const plan = PLANT_PLAN[i];
      originals.push({ service_id: row.service_id, content: row.content });
      const newContent = row.content.replace(plan.line, plan.value);
      await client.query(`UPDATE source_fixtures SET content = $1 WHERE service_id = $2`, [
        newContent,
        row.service_id,
      ]);
      details.push({
        service: row.name,
        field: plan.field,
        plantedValue: plan.value.replace(/^[^:]*:\s*/, ''),
        detected: false,
      });
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  // Run the production verification path
  const { runVerification } = await import('./verify');
  const summary = await runVerification('eval');

  // Collect changes created by this run
  const changes = (
    await pool.query(`SELECT vc.service_id, vc.field, vc.extracted_value, s.name
                      FROM verification_changes vc JOIN services s ON s.id = vc.service_id
                      WHERE vc.verification_run_id = $1`, [summary.runId])
  ).rows as { service_id: number; field: string; extracted_value: string; name: string }[];

  for (const d of details) {
    const svc = planted.rows.find((p) => p.name === d.service)!;
    const hit = changes.find((c) => c.service_id === svc.service_id && c.field === d.field);
    d.detected = Boolean(hit);
    d.extractedValue = hit?.extracted_value;
    d.extractedCorrectly = hit ? hit.extracted_value === d.plantedValue : false;
  }

  const plantedKeys = new Set(planted.rows.map((p, i) => `${p.service_id}:${PLANT_PLAN[i].field}`));
  const falsePositives = changes.filter((c) => !plantedKeys.has(`${c.service_id}:${c.field}`)).length;

  // Clean up: remove changes created by the eval run and restore fixtures
  await pool.query(`DELETE FROM verification_changes WHERE verification_run_id = $1`, [summary.runId]);
  const client2 = await pool.connect();
  try {
    await client2.query('BEGIN');
    for (const o of originals) {
      await client2.query(`UPDATE source_fixtures SET content = $1 WHERE service_id = $2`, [o.content, o.service_id]);
    }
    await client2.query('COMMIT');
  } catch (e) {
    await client2.query('ROLLBACK');
    throw e;
  } finally {
    client2.release();
  }
  await pool.query(`DELETE FROM verification_runs WHERE id = $1`, [summary.runId]);
  const { reconcileStatuses } = await import('./verify');
  await reconcileStatuses();

  const detected = details.filter((d) => d.detected).length;
  const extractedCorrect = details.filter((d) => d.extractedCorrectly).length;
  const n = details.length;
  return {
    plantedChanges: n,
    detectedChanges: detected,
    changeDetectionRecall: n ? detected / n : 0,
    falsePositives,
    falsePositiveRate: summary.servicesChecked ? falsePositives / summary.servicesChecked : 0,
    extractionAccuracy: n ? extractedCorrect / n : 0,
    verificationLatencyMs: summary.latencyMs,
    details,
    ranAt: new Date().toISOString(),
  };
}

export const VERIFICATION_FIELDS = VERIFIED_FIELDS;
