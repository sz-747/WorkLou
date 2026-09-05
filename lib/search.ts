import { Criteria, MatchResult, ServiceRow, SUBURBS } from './types';

const DAY_PREFIXES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toResult(s: ServiceRow, distance: number | null): MatchResult {
  return {
    id: s.id,
    name: s.name,
    serviceTypes: s.service_types,
    suburb: s.suburb,
    distanceKm: distance,
    reasons: [],
    unknowns: [],
    childrenAllowed: s.children_allowed,
    openingHours: s.opening_hours,
    walkInAllowed: s.walk_in_allowed,
    appointmentRequired: s.appointment_required,
    referralRequired: s.referral_required,
    phone: s.phone,
    website: s.website,
    sourceUrl: s.source_url,
    lastVerifiedAt: s.last_verified_at,
    verificationStatus: s.verification_status,
  };
}

interface Grade {
  result: MatchResult;
  grade: 'full' | 'partial';
  distance: number | null;
}

function evaluate(s: ServiceRow, c: Criteria, now: Date): Grade | null {
  if (c.serviceType && !s.service_types.includes(c.serviceType)) return null;

  const r = toResult(s, null);
  r.reasons.push(`Provides the type of support needed`);

  // children
  if (c.childrenAllowed === true) {
    if (s.children_allowed === true) r.reasons.push('Accepts women with children');
    else if (s.children_allowed === false) return null;
    else r.unknowns.push('Children policy unknown — call to confirm');
  } else if (c.childrenAllowed === false) {
    if (s.children_allowed === true) return null;
    else if (s.children_allowed === false) r.reasons.push('Women only (no children)');
    else r.unknowns.push('Children policy unknown');
  }

  // location
  let distance: number | null = null;
  if (c.location) {
    const loc = SUBURBS[c.location as keyof typeof SUBURBS];
    if (s.latitude == null || s.longitude == null) {
      r.unknowns.push(`Distance from ${c.location} unknown`);
    } else if (loc) {
      distance = distanceKm(loc[0], loc[1], s.latitude, s.longitude);
      if (distance <= 8) r.reasons.push(`${distance.toFixed(1)} km from ${c.location}`);
      else if (distance <= 20) r.unknowns.push(`About ${distance.toFixed(0)} km from ${c.location} — further away`);
      else return null;
    }
  }

  // urgency
  const hours = (s.opening_hours || '').toLowerCase();
  if (c.urgency === 'today') {
    if (!hours) {
      r.unknowns.push('Opening hours unknown — call to confirm');
    } else {
      const today = DAY_PREFIXES[now.getDay()];
      if (/24|daily|7 days/.test(hours) || hours.includes(today.toLowerCase())) {
        r.reasons.push('Open today');
      } else {
        return null;
      }
    }
  } else if (c.urgency === 'this_week') {
    if (!hours) r.unknowns.push('Opening hours unknown — call to confirm');
    else if (DAY_PREFIXES.some((d) => hours.includes(d.toLowerCase())) || /24|daily/.test(hours)) {
      r.reasons.push('Open this week');
    } else {
      r.unknowns.push('Weekly hours unclear');
    }
  }

  // walk-in / appointment / referral
  if (c.walkIn === true) {
    if (s.walk_in_allowed === true) r.reasons.push('Walk-ins accepted');
    else if (s.walk_in_allowed === false) return null;
    else r.unknowns.push('Walk-in policy unknown');
  }
  if (c.appointmentRequired === false) {
    if (s.appointment_required === false) r.reasons.push('No appointment needed');
    else if (s.appointment_required === true) return null;
    else r.unknowns.push('Appointment policy unknown');
  }
  if (c.referralRequired === false) {
    if (s.referral_required === false) r.reasons.push('No referral needed');
    else if (s.referral_required === true) return null;
    else r.unknowns.push('Referral policy unknown');
  }

  r.distanceKm = distance;
  return { result: r, grade: r.unknowns.length ? 'partial' : 'full', distance };
}

function sortKey(m: MatchResult): (string | number)[] {
  return [m.distanceKm ?? 999, m.lastVerifiedAt ? -Date.parse(m.lastVerifiedAt) : Infinity, m.name];
}

export function searchServices(
  services: ServiceRow[],
  criteria: Criteria,
  now = new Date()
): { full: MatchResult[]; partial: MatchResult[] } {
  const full: MatchResult[] = [];
  const partial: MatchResult[] = [];
  for (const s of services) {
    const g = evaluate(s, criteria, now);
    if (!g) continue;
    (g.grade === 'full' ? full : partial).push(g.result);
  }
  full.sort((a, b) => cmp(sortKey(a), sortKey(b)));
  partial.sort((a, b) => cmp(sortKey(a), sortKey(b)));
  return { full, partial };
}

function cmp(a: (string | number)[], b: (string | number)[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}
