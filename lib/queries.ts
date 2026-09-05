import { pool } from './db';
import type { ServiceRow } from './types';

export async function allServices(): Promise<ServiceRow[]> {
  return (await pool.query<ServiceRow>(`SELECT * FROM services ORDER BY name`)).rows;
}

export async function getService(id: number): Promise<ServiceRow | null> {
  const res = await pool.query<ServiceRow>(`SELECT * FROM services WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

export async function getFixture(serviceId: number): Promise<string | null> {
  const res = await pool.query(`SELECT content FROM source_fixtures WHERE service_id = $1`, [serviceId]);
  return res.rows[0]?.content ?? null;
}
