import { SERVICE_TYPES } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const header = [
    'name',
    'service_types',
    'description',
    'suburb',
    'address',
    'eligibility',
    'children_allowed',
    'opening_hours',
    'walk_in_allowed',
    'appointment_required',
    'referral_required',
    'phone',
    'email',
    'website',
    'source_url',
    'internal_notes',
  ].join(',');
  const example = [
    'Example Community Service',
    SERVICE_TYPES[0].value,
    'What the service provides',
    'Redfern',
    '1 Example St, Redfern NSW 2016',
    'Who can use it',
    'yes',
    'Mon-Fri 9am-5pm',
    'yes',
    'no',
    'no',
    '02 0000 0000',
    'info@example.org',
    'https://example.org',
    'https://example.org/service-page',
    'Notes for staff',
  ].map((v) => (v.includes(',') || v.includes('"') ? `"${v}"` : v)).join(',');
  return new Response(`${header}\n${example}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lous-services-template.csv"',
    },
  });
}
