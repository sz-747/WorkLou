'use client';

import { useEffect, useState } from 'react';

interface ScenarioResult {
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

interface SearchEval {
  scenarios: ScenarioResult[];
  overall: { validReferralRate: number; invalidReferralRate: number; coverage: number; scenariosRun: number };
  timeToValidReferral: { sampleCount: number; medianMs: number | null; note: string };
  ranAt: string;
}

interface VerificationEval {
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

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function EvaluationPage() {
  const [searchEval, setSearchEval] = useState<SearchEval | null>(null);
  const [verifEval, setVerifEval] = useState<VerificationEval | null>(null);
  const [running, setRunning] = useState<'search' | 'verification' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Background runs (scheduler) persist results; show the latest ones without running anything.
  useEffect(() => {
    fetch('/api/eval/search').then((r) => (r.ok ? r.json() : null)).then(setSearchEval).catch(() => {});
    fetch('/api/eval/verification').then((r) => (r.ok ? r.json() : null)).then(setVerifEval).catch(() => {});
  }, []);

  async function run(kind: 'search' | 'verification') {
    setRunning(kind);
    setError(null);
    const res = await fetch(`/api/eval/${kind}`, { method: 'POST' });
    const data = await res.json();
    setRunning(null);
    if (!res.ok) {
      setError(data.error ?? 'Run failed');
      return;
    }
    if (kind === 'search') setSearchEval(data);
    else setVerifEval(data);
  }

  return (
    <div>
      <h1>Evaluation</h1>
      <p className="sub">
        Real measurements from actual runs against the demo dataset — nothing hard-coded. Numbers update every time you run.
      </p>

      <h2>Search accuracy</h2>
      <div className="row" style={{ marginBottom: 12 }}>
        <button onClick={() => run('search')} disabled={running !== null}>
          {running === 'search' ? 'Running…' : 'Run search evaluation'}
        </button>
        {searchEval && <span className="muted">Ran {new Date(searchEval.ranAt).toLocaleTimeString('en-AU')}</span>}
      </div>

      {searchEval && (
        <>
          <div className="stat-grid" style={{ marginBottom: 12 }}>
            <div className="stat">
              <div className="n">{pct(searchEval.overall.validReferralRate)}</div>
              <div className="l">Valid referral rate (correct services ÷ all returned)</div>
            </div>
            <div className="stat">
              <div className="n">{pct(searchEval.overall.invalidReferralRate)}</div>
              <div className="l">Invalid referral rate (returned services failing a requirement)</div>
            </div>
            <div className="stat">
              <div className="n">{pct(searchEval.overall.coverage)}</div>
              <div className="l">Referral coverage (valid services surfaced ÷ all valid)</div>
            </div>
            <div className="stat">
              <div className="n">
                {searchEval.timeToValidReferral.medianMs != null
                  ? `${(searchEval.timeToValidReferral.medianMs / 1000).toFixed(1)}s`
                  : '—'}
              </div>
              <div className="l">
                Median time to a chosen service ({searchEval.timeToValidReferral.sampleCount} samples)
              </div>
            </div>
          </div>
          {searchEval.scenarios.map((s) => (
            <div key={s.scenarioId} className="card">
              <div className="result-head">
                <strong>{s.scenarioId}: {s.name}</strong>
                <span className="badge">{s.validReturned.length}/{s.validReturned.length + s.missedValid.length} valid surfaced</span>
              </div>
              <p className="muted">“{s.query}”</p>
              <ul className="plain">
                <li>Returned: {s.returned.length > 0 ? s.returned.join(', ') : 'none'}</li>
                {s.invalidReturned.length > 0 && (
                  <li style={{ color: 'var(--warn)' }}>Invalid returned: {s.invalidReturned.join(', ')}</li>
                )}
                {s.missedValid.length > 0 && (
                  <li style={{ color: 'var(--warn)' }}>Missed valid: {s.missedValid.join(', ')}</li>
                )}
                <li className="muted">Parser: {s.parserSource}</li>
              </ul>
            </div>
          ))}
          <p className="muted">{searchEval.timeToValidReferral.note}</p>
        </>
      )}

      <h2>Verification accuracy</h2>
      <div className="row" style={{ marginBottom: 12 }}>
        <button onClick={() => run('verification')} disabled={running !== null}>
          {running === 'verification' ? 'Running…' : 'Plant 8 controlled changes and verify'}
        </button>
        {verifEval && <span className="muted">Ran {new Date(verifEval.ranAt).toLocaleTimeString('en-AU')}</span>}
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        This temporarily plants 8 known changes in the sample sources, runs the real verification workflow, measures
        what it catches, then restores everything.
      </p>

      {verifEval && (
        <>
          <div className="stat-grid" style={{ marginBottom: 12 }}>
            <div className="stat">
              <div className="n">{pct(verifEval.changeDetectionRecall)}</div>
              <div className="l">Change detection recall ({verifEval.detectedChanges}/{verifEval.plantedChanges} caught)</div>
            </div>
            <div className="stat">
              <div className="n">{verifEval.falsePositives}</div>
              <div className="l">False positives ({pct(verifEval.falsePositiveRate)} of checked)</div>
            </div>
            <div className="stat">
              <div className="n">{pct(verifEval.extractionAccuracy)}</div>
              <div className="l">Extraction accuracy (planted value read correctly)</div>
            </div>
            <div className="stat">
              <div className="n">{(verifEval.verificationLatencyMs / 1000).toFixed(1)}s</div>
              <div className="l">Verification latency</div>
            </div>
          </div>
          <table className="list card">
            <thead>
              <tr><th>Service</th><th>Field</th><th>Planted</th><th>Detected</th></tr>
            </thead>
            <tbody>
              {verifEval.details.map((d, i) => (
                <tr key={i}>
                  <td>{d.service}</td>
                  <td>{d.field}</td>
                  <td className="muted">{d.plantedValue}</td>
                  <td>
                    {d.detected
                      ? d.extractedCorrectly
                        ? <span className="badge ok">✓ detected correctly</span>
                        : <span className="badge warn">detected, extraction differs: “{d.extractedValue}”</span>
                      : <span className="badge warn">missed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {error && <div className="note">{error}</div>}
    </div>
  );
}
