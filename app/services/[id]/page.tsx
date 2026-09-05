import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getService } from '@/lib/queries';
import { serviceTypeLabel } from '@/lib/types';

export const dynamic = 'force-dynamic';

function Bool({ v }: { v: boolean | null }) {
  if (v === true) return <span className="badge ok">Yes</span>;
  if (v === false) return <span className="badge plain">No</span>;
  return <span className="badge warn">Unknown</span>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{children}</td>
    </tr>
  );
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getService(Number(id));
  if (!service) notFound();

  const verifiedDays = service.last_verified_at
    ? Math.floor((Date.now() - Date.parse(service.last_verified_at)) / 86400000)
    : null;

  return (
    <div>
      <Link href="/" className="muted">← Back to search</Link>
      <h1>{service.name}</h1>
      <div className="row" style={{ gap: 6 }}>
        {service.service_types.map((t) => (
          <span key={t} className="badge">{serviceTypeLabel(t)}</span>
        ))}
        {service.verification_status === 'verified' && verifiedDays !== null && verifiedDays <= 14 && (
          <span className="badge ok">Verified {verifiedDays === 0 ? 'today' : `${verifiedDays} days ago`}</span>
        )}
        {service.verification_status === 'needs_review' && <span className="badge warn">Change under review</span>}
        {verifiedDays === null && <span className="badge plain">Never verified</span>}
      </div>

      <div className="card">
        <table className="list">
          <tbody>
            <Row label="What it provides">{service.description ?? <span className="muted">Not recorded</span>}</Row>
            <Row label="Eligibility">{service.eligibility ?? <span className="badge warn">Unknown</span>}</Row>
            <Row label="Children accepted"><Bool v={service.children_allowed} /></Row>
            <Row label="Opening hours">{service.opening_hours ?? <span className="badge warn">Unknown</span>}</Row>
            <Row label="Walk-ins allowed"><Bool v={service.walk_in_allowed} /></Row>
            <Row label="Appointment required"><Bool v={service.appointment_required} /></Row>
            <Row label="Referral required"><Bool v={service.referral_required} /></Row>
            <Row label="Address">{service.address ?? <span className="muted">Not recorded</span>}</Row>
            <Row label="Suburb">{service.suburb ?? '—'}</Row>
            <Row label="Phone">
              {service.phone ? <a href={`tel:${service.phone.replace(/\s/g, '')}`}>{service.phone}</a> : <span className="muted">Not recorded</span>}
            </Row>
            <Row label="Email">{service.email ?? <span className="muted">Not recorded</span>}</Row>
            <Row label="Website">
              {service.website ? <a href={service.website} target="_blank" rel="noreferrer">{service.website}</a> : <span className="muted">Not recorded</span>}
            </Row>
            <Row label="Internal notes">{service.internal_notes ?? <span className="muted">None</span>}</Row>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Where this information comes from</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Source: <a href={service.source_url ?? '#'} target="_blank" rel="noreferrer">{service.source_url ?? 'not recorded'}</a>
        </p>
        <p className="muted">
          Data type: {service.source_type === 'csv_import' ? 'Imported from CSV' : 'Sample data (demo)'} ·{' '}
          Last verified: {service.last_verified_at ? new Date(service.last_verified_at).toLocaleString('en-AU') : 'never'}
        </p>
        <div className="note" style={{ marginBottom: 0 }}>
          The caseworker makes the final referral decision. Call the service to confirm details before referring.
        </div>
      </div>
    </div>
  );
}
