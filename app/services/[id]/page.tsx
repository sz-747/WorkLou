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
        {/* What a caseworker needs first: what it does, who fits, when, how to reach */}
        {service.description && <p style={{ marginTop: 0, fontSize: '1.05em' }}>{service.description}</p>}
        {service.eligibility && (
          <p style={{ marginBottom: 6 }}>
            <strong>Who it&rsquo;s for:</strong> {service.eligibility}
          </p>
        )}
        <p style={{ marginBottom: 12 }}>
          <strong>Open:</strong>{' '}
          {service.opening_hours ?? <span className="badge warn">Hours unknown — call to check</span>}
        </p>

        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {service.children_allowed === true && <span className="badge ok">Children welcome</span>}
          {service.children_allowed === false && <span className="badge plain">No children</span>}
          {service.walk_in_allowed === true && <span className="badge ok">Walk-ins OK</span>}
          {service.appointment_required === false && <span className="badge ok">No appointment needed</span>}
          {service.referral_required === false && <span className="badge ok">No referral needed</span>}
          {service.appointment_required === true && <span className="badge plain">Appointment needed</span>}
          {service.referral_required === true && <span className="badge plain">Referral needed</span>}
        </div>

        <div className="row" style={{ gap: 10, marginTop: 14, alignItems: 'center' }}>
          {service.phone && (
            <a className="btn" href={`tel:${service.phone.replace(/\s/g, '')}`}>Call {service.phone}</a>
          )}
          {service.website && (
            <a className="btn secondary" href={service.website} target="_blank" rel="noreferrer">Website ↗</a>
          )}
        </div>
        {(service.address || service.suburb) && (
          <p className="muted" style={{ marginBottom: 0, marginTop: 10 }}>
            {[service.address, service.suburb].filter(Boolean).join(', ')}
          </p>
        )}
      </div>

      {/* Secondary details — only when asked for */}
      <details className="card" style={{ paddingTop: 12 }}>
        <summary>More access details</summary>
        <table className="list" style={{ marginTop: 8 }}>
          <tbody>
            <tr><th scope="row">Children accepted</th><td><Bool v={service.children_allowed} /></td></tr>
            <tr><th scope="row">Walk-ins allowed</th><td><Bool v={service.walk_in_allowed} /></td></tr>
            <tr><th scope="row">Appointment required</th><td><Bool v={service.appointment_required} /></td></tr>
            <tr><th scope="row">Referral required</th><td><Bool v={service.referral_required} /></td></tr>
            <tr>
              <th scope="row">Email</th>
              <td>{service.email ?? <span className="muted">Not recorded</span>}</td>
            </tr>
          </tbody>
        </table>
      </details>

      <details className="card" style={{ paddingTop: 12 }}>
        <summary>Where this information comes from</summary>
        <p className="muted" style={{ marginTop: 8, marginBottom: 4 }}>
          Source: <a href={service.source_url ?? '#'} target="_blank" rel="noreferrer">{service.source_url ?? 'not recorded'}</a>
        </p>
        <p className="muted" style={{ marginTop: 0, marginBottom: 4 }}>
          Data type: {service.source_type === 'csv_import' ? 'Imported from CSV' : 'Sample data (demo)'} ·{' '}
          Last verified: {service.last_verified_at ? new Date(service.last_verified_at).toLocaleString('en-AU') : 'never'}
        </p>
        {service.internal_notes && <p className="muted" style={{ marginTop: 0 }}>Internal notes: {service.internal_notes}</p>}
      </details>

      <div className="note">
        You make the final decision. Call the service to confirm details before making a referral —
        information may have changed since it was last checked.
      </div>
    </div>
  );
}
