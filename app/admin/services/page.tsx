'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

interface Service {
  id: number;
  name: string;
  service_types: string[];
  suburb: string | null;
  verification_status: string;
  last_verified_at: string | null;
  source_type: string;
}

interface ImportReport {
  imported: number;
  rejected: number;
  mapping: string[];
  unmappedColumns: string[];
  errors: { row: number; error: string }[];
  total: number;
}

export default function ServicesAdmin() {
  const [services, setServices] = useState<Service[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/import');
    const data = await res.json();
    setServices(data.services);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function doImport() {
    if (!file) return;
    setImporting(true);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: form });
    const data = await res.json();
    setImporting(false);
    setReport(res.ok ? data : null);
    if (res.ok) await load();
  }

  return (
    <div>
      <h1>Services</h1>
      <p className="sub">{services.length} services in the directory. Sample data is clearly labelled; Lou&apos;s real spreadsheet can be imported below.</p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Import CSV</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Column names are auto-detected (e.g. <em>Organisation, Suburb, Opening hours, Accepts children</em>).{' '}
          <a href="/api/import/template" download>Download template</a> to see the expected columns.
        </p>
        <div className="row">
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ maxWidth: 320 }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button onClick={doImport} disabled={!file || importing}>{importing ? 'Importing…' : 'Import'}</button>
        </div>
        {report && (
          <div style={{ marginTop: 12 }}>
            <p>
              <strong>Imported {report.imported}</strong>, rejected {report.rejected}. Directory now has {report.total} services.
            </p>
            {report.mapping.length > 0 && (
              <p className="muted">Mapped: {report.mapping.join(' · ')}</p>
            )}
            {report.unmappedColumns.length > 0 && (
              <p className="muted">Ignored unmapped columns: {report.unmappedColumns.join(', ')}</p>
            )}
            {report.errors.length > 0 && (
              <ul className="plain">
                {report.errors.slice(0, 10).map((e) => (
                  <li key={e.row} className="muted">Row {e.row}: {e.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="list">
          <thead>
            <tr>
              <th>Service</th>
              <th>Suburb</th>
              <th>Status</th>
              <th>Last verified</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/services/${s.id}`}>{s.name}</Link>
                  {s.source_type === 'csv_import' && <span className="badge plain" style={{ marginLeft: 6 }}>CSV</span>}
                </td>
                <td>{s.suburb ?? '—'}</td>
                <td>
                  {s.verification_status === 'verified' && <span className="badge ok">Verified</span>}
                  {s.verification_status === 'needs_review' && <span className="badge warn">Needs review</span>}
                  {s.verification_status === 'unverified' && <span className="badge plain">Unverified</span>}
                </td>
                <td className="muted">
                  {s.last_verified_at ? new Date(s.last_verified_at).toLocaleDateString('en-AU') : 'never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
