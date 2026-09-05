'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Criteria, MatchResult, SERVICE_TYPES, SUBURBS } from '@/lib/types';

const EXAMPLES = [
  'Emergency accommodation tonight for a woman with two children near Redfern.',
  'Food assistance today near Redfern, accepts children.',
  'DFV support in Bankstown, no referral needed.',
];

type Tri = boolean | null;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - Date.parse(iso)) / 86400000);
}

function freshness(m: MatchResult) {
  const d = daysSince(m.lastVerifiedAt);
  if (m.verificationStatus === 'needs_review') return <span className="badge warn">Change under review</span>;
  if (d === null) return <span className="badge plain">Never verified</span>;
  if (d <= 14) return <span className="badge ok">Verified {d === 0 ? 'today' : `${d} day${d > 1 ? 's' : ''} ago`}</span>;
  return <span className="badge warn">Verified {d} days ago</span>;
}

function TriSelect({ label, value, onChange }: { label: string; value: Tri; onChange: (v: Tri) => void }) {
  return (
    <div>
      <label>{label}</label>
      <select value={value === null ? 'any' : value ? 'yes' : 'no'} onChange={(e) => onChange(e.target.value === 'any' ? null : e.target.value === 'yes')}>
        <option value="any">Any</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </div>
  );
}

export default function SearchPage() {
  const [notes, setNotes] = useState('');
  const [query, setQuery] = useState('');
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [parserSource, setParserSource] = useState<string | null>(null);
  const [results, setResults] = useState<{ full: MatchResult[]; partial: MatchResult[] } | null>(null);
  const [searchId, setSearchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [chosen, setChosen] = useState<number | null>(null);

  async function runSearch(c?: Criteria) {
    setLoading(true);
    setChosen(null);
    const started = Date.now();
    setStartedAt(started);
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, criteria: c ?? undefined, notes: c ? undefined : notes }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return;
    setCriteria(data.criteria);
    setParserSource(data.parserSource);
    setResults(data.results);
    setSearchId(data.searchId);
  }

  async function choose(serviceId: number) {
    setChosen(serviceId);
    if (searchId) {
      await fetch('/api/search/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchId, serviceId, elapsedMs: Date.now() - startedAt }),
      });
    }
  }

  const upd = (patch: Partial<Criteria>) => setCriteria((c) => (c ? { ...c, ...patch } : c));

  // Notes stay on this device between sessions
  useEffect(() => {
    setNotes(localStorage.getItem('call-notes') ?? '');
  }, []);
  function updateNotes(v: string) {
    setNotes(v);
    localStorage.setItem('call-notes', v);
  }

  return (
    <div className="workspace">
      <aside className="card sideboard">
        <h2 style={{ marginTop: 0 }}>Notes from the call</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Jot things down while you talk. Your notes are matched against services along with the search.
        </p>
        <textarea
          className="notes-canvas"
          value={notes}
          onChange={(e) => updateNotes(e.target.value)}
          placeholder={'e.g.\nTwo kids (4 and 7), eldest school at Redfern\nNeeds somewhere safe tonight\nNo car — walk-in or near transport\nCentrelink payment stopped last week'}
        />
        {notes.trim() && (
          <p className="muted" style={{ margin: '8px 0 0' }}>✓ Your notes will be included in the next search.</p>
        )}
      </aside>

      <div className="main-col">
      <h1>What kind of service are you looking for?</h1>
      <p className="sub">Describe the support needed — in your own words. You can fix any detail below.</p>

      <div className="card">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Emergency accommodation tonight for a woman with two children near Redfern."
        />
        <div className="row" style={{ marginTop: 10 }}>
          <button onClick={() => runSearch()} disabled={loading || !query.trim()}>
            {loading ? 'Searching…' : 'Find services'}
          </button>
          <span style={{ display: 'flex', gap: 8, flexWrap: 1 }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} className="example-chip" onClick={() => setQuery(ex)}>
                {ex.split(' ').slice(0, 4).join(' ')}…
              </button>
            ))}
          </span>
        </div>
      </div>

      {criteria && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>What we understood</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Fix anything we got wrong, then search again. {parserSource === 'local' ? '(Local keyword parser — add an LLM key for smarter parsing.)' : '(Parsed with LLM)'}
          </p>
          <div className="filters">
            <div>
              <label>Need</label>
              <select value={criteria.serviceType ?? ''} onChange={(e) => upd({ serviceType: e.target.value || null })}>
                <option value="">Any type</option>
                {SERVICE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Location</label>
              <select value={criteria.location ?? ''} onChange={(e) => upd({ location: e.target.value || null })}>
                <option value="">Anywhere</option>
                {Object.keys(SUBURBS).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Needed</label>
              <select value={criteria.urgency ?? ''} onChange={(e) => upd({ urgency: (e.target.value || null) as Criteria['urgency'] })}>
                <option value="">No time limit</option>
                <option value="today">Today</option>
                <option value="this_week">This week</option>
              </select>
            </div>
            <TriSelect label="Children accepted" value={criteria.childrenAllowed} onChange={(v) => upd({ childrenAllowed: v })} />
            <TriSelect label="Walk-in possible" value={criteria.walkIn} onChange={(v) => upd({ walkIn: v })} />
            <TriSelect label="Appointment required" value={criteria.appointmentRequired} onChange={(v) => upd({ appointmentRequired: v })} />
            <TriSelect label="Referral required" value={criteria.referralRequired} onChange={(v) => upd({ referralRequired: v })} />
          </div>
          <button className="secondary" style={{ marginTop: 12 }} onClick={() => runSearch(criteria)} disabled={loading}>
            Search with these filters
          </button>
        </div>
      )}

      {results && (
        <>
          <h2>{results.full.length} matching service{results.full.length === 1 ? '' : 's'}</h2>
          {results.full.map((m) => (
            <div key={m.id} className={`card ${chosen === m.id ? 'chosen' : ''}`}>
              <div className="result-head">
                <p className="result-name">{m.name}</p>
                {freshness(m)}
              </div>
              <div className="row" style={{ gap: 6, marginTop: 4 }}>
                <span className="badge plain">{m.suburb ?? '—'}</span>
                {m.distanceKm != null && <span className="badge plain">{m.distanceKm.toFixed(1)} km away</span>}
                {m.childrenAllowed === true && <span className="badge ok">Children welcome</span>}
                {m.childrenAllowed === false && <span className="badge plain">Women only (no children)</span>}
                {m.childrenAllowed === null && <span className="badge warn">Children policy unknown</span>}
                {m.walkInAllowed && <span className="badge plain">Walk-ins</span>}
                {m.appointmentRequired && <span className="badge plain">Appointment needed</span>}
                {m.referralRequired && <span className="badge plain">Referral needed</span>}
              </div>
              <ul className="reasons">
                {m.reasons.map((r) => <li key={r}>✓ {r}</li>)}
              </ul>
              {m.unknowns.length > 0 && (
                <ul className="reasons unknown">
                  {m.unknowns.map((u) => <li key={u}>⚠ {u}</li>)}
                </ul>
              )}
              <p className="meta">
                {m.openingHours ?? 'Hours unknown'} · {m.phone ?? 'no phone listed'}
              </p>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="small" onClick={() => choose(m.id)}>
                  {chosen === m.id ? '✓ Recorded' : 'Choose this service'}
                </button>
                <Link className="btn secondary small" href={`/services/${m.id}`}>View details</Link>
                {m.sourceUrl && <a className="muted" href={m.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a>}
              </div>
            </div>
          ))}

          {results.partial.length > 0 && (
            <>
              <h2>May also suit — check the gaps first</h2>
              {results.partial.map((m) => (
                <div key={m.id} className="card">
                  <div className="result-head">
                    <p className="result-name">{m.name}</p>
                    {freshness(m)}
                  </div>
                  <ul className="reasons unknown">
                    {m.unknowns.map((u) => <li key={u}>⚠ {u}</li>)}
                  </ul>
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="secondary small" onClick={() => choose(m.id)}>Choose this service</button>
                    <Link className="btn secondary small" href={`/services/${m.id}`}>View details</Link>
                  </div>
                </div>
              ))}
            </>
          )}

          {results.full.length === 0 && results.partial.length === 0 && (
            <div className="note">No services match. Try relaxing a filter, or check a different location.</div>
          )}

          <div className="note">
            You make the final decision. This tool suggests services — it never decides what a woman needs or where
            she should go. Information comes from listed sources and may change; call the service to confirm before
            making a referral.
          </div>
        </>
      )}
      </div>
    </div>
  );
}
