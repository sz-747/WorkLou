import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import { pool } from '@/lib/db';
import { allServices } from '@/lib/queries';
import { SERVICE_TYPE_VALUES } from '@/lib/types';

export const dynamic = 'force-dynamic';

const HEADER_MAP: Record<string, string> = {
  name: 'name',
  service: 'name',
  servicename: 'name',
  organisation: 'name',
  servicetypes: 'service_types',
  servicetype: 'service_types',
  type: 'service_types',
  types: 'service_types',
  description: 'description',
  what: 'description',
  suburb: 'suburb',
  location: 'suburb',
  address: 'address',
  eligibility: 'eligibility',
  minimumage: 'minimum_age',
  maximumage: 'maximum_age',
  childrenallowed: 'children_allowed',
  acceptschildren: 'children_allowed',
  children: 'children_allowed',
  openinghours: 'opening_hours',
  hours: 'opening_hours',
  walkinallowed: 'walk_in_allowed',
  walkin: 'walk_in_allowed',
  walkinswelcome: 'walk_in_allowed',
  appointmentrequired: 'appointment_required',
  referralrequired: 'referral_required',
  phone: 'phone',
  contact: 'phone',
  email: 'email',
  website: 'website',
  sourceurl: 'source_url',
  source: 'source_url',
  internalnotes: 'internal_notes',
  notes: 'internal_notes',
};

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseBool(v: string): boolean | null {
  if (/^(yes|y|true|1)$/i.test(v.trim())) return true;
  if (/^(no|n|false|0)$/i.test(v.trim())) return false;
  if (/unknown|not stated/i.test(v)) return null;
  return null;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'CSV file required' }, { status: 400 });
  }
  const text = await file.text();

  let records: Record<string, string>[];
  try {
    records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
  } catch (e) {
    return NextResponse.json({ error: `Could not parse CSV: ${(e as Error).message}` }, { status: 400 });
  }

  if (records.length === 0) return NextResponse.json({ error: 'CSV contains no rows' }, { status: 400 });

  // map original headers → canonical columns
  const sampleKeys = Object.keys(records[0]);
  const mapping: Record<string, string | null> = {};
  for (const key of sampleKeys) {
    mapping[key] = HEADER_MAP[normHeader(key)] ?? null;
  }
  const mappedCols = Object.entries(mapping).filter(([, v]) => v).map(([k, v]) => `${k} → ${v}`);

  const errors: { row: number; error: string }[] = [];
  let imported = 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const get = (col: string) => {
        const header = Object.keys(mapping).find((h) => mapping[h] === col && row[h] != null && row[h] !== '');
        return header ? row[header].trim() : null;
      };
      const name = get('name');
      const typesRaw = get('service_types');
      if (!name) {
        errors.push({ row: i + 2, error: 'missing service name' });
        continue;
      }
      let types: string[];
      if (typesRaw) {
        types = typesRaw.split(/[;,|]/).map((t) => t.trim()).filter(Boolean);
        const invalid = types.filter((t) => !SERVICE_TYPE_VALUES.includes(t));
        if (invalid.length > 0) {
          errors.push({
            row: i + 2,
            error: `unknown service type(s): ${invalid.join(', ')} (use: ${SERVICE_TYPE_VALUES.join(', ')})`,
          });
          continue;
        }
      } else {
        errors.push({ row: i + 2, error: 'missing service type' });
        continue;
      }
      await client.query(
        `INSERT INTO services (name, service_types, description, suburb, address, eligibility, minimum_age, maximum_age,
           children_allowed, opening_hours, walk_in_allowed, appointment_required, referral_required,
           phone, email, website, source_url, source_type, internal_notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'csv_import',$18)`,
        [
          name,
          types,
          get('description'),
          get('suburb'),
          get('address'),
          get('eligibility'),
          get('minimum_age') ? Number(get('minimum_age')) : null,
          get('maximum_age') ? Number(get('maximum_age')) : null,
          get('children_allowed') != null ? parseBool(get('children_allowed')!) : null,
          get('opening_hours'),
          get('walk_in_allowed') != null ? parseBool(get('walk_in_allowed')!) : null,
          get('appointment_required') != null ? parseBool(get('appointment_required')!) : null,
          get('referral_required') != null ? parseBool(get('referral_required')!) : null,
          get('phone'),
          get('email'),
          get('website'),
          get('source_url'),
          get('internal_notes'),
        ]
      );
      imported++;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: `Import failed: ${(e as Error).message}` }, { status: 500 });
  } finally {
    client.release();
  }

  await pool.query(`INSERT INTO import_runs (filename, imported_count, rejected_count, errors) VALUES ($1,$2,$3,$4)`, [
    file.name,
    imported,
    errors.length,
    JSON.stringify(errors),
  ]);

  return NextResponse.json({
    imported,
    rejected: errors.length,
    mapping: mappedCols,
    unmappedColumns: Object.entries(mapping).filter(([, v]) => !v).map(([k]) => k),
    errors,
    total: await (await pool.query('SELECT count(*)::int AS n FROM services')).rows[0].n,
  });
}

export async function GET() {
  const services = await allServices();
  return NextResponse.json({ services });
}
