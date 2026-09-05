export const SERVICE_TYPES = [
  { value: 'emergency_accommodation', label: 'Emergency accommodation' },
  { value: 'transitional_housing', label: 'Transitional housing' },
  { value: 'food_assistance', label: 'Food assistance' },
  { value: 'legal_assistance', label: 'Legal help' },
  { value: 'health_service', label: 'Health service' },
  { value: 'centrelink_support', label: 'Centrelink support' },
  { value: 'dfv_service', label: 'DFV support' },
  { value: 'financial_assistance', label: 'Financial assistance' },
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number]['value'];

export const SERVICE_TYPE_VALUES = SERVICE_TYPES.map((t) => t.value) as string[];

export function serviceTypeLabel(v: string): string {
  return SERVICE_TYPES.find((t) => t.value === v)?.label ?? v;
}

export const SUBURBS = {
  Redfern: [-33.893, 151.205],
  Waterloo: [-33.9, 151.21],
  'Surry Hills': [-33.886, 151.212],
  Newtown: [-33.897, 151.178],
  Marrickville: [-33.898, 151.147],
  Glebe: [-33.879, 151.185],
  Ashfield: [-33.886, 151.127],
  Bankstown: [-33.917, 151.03],
  Parramatta: [-33.814, 151.001],
  Campbelltown: [-34.065, 150.814],
  Blacktown: [-33.771, 150.906],
} as const;

export interface Criteria {
  serviceType: string | null;
  location: string | null;
  urgency: 'today' | 'this_week' | null;
  childrenAllowed: boolean | null;
  walkIn: boolean | null;
  appointmentRequired: boolean | null;
  referralRequired: boolean | null;
}

export function emptyCriteria(): Criteria {
  return {
    serviceType: null,
    location: null,
    urgency: null,
    childrenAllowed: null,
    walkIn: null,
    appointmentRequired: null,
    referralRequired: null,
  };
}

export interface ServiceRow {
  id: number;
  name: string;
  service_types: string[];
  description: string | null;
  suburb: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  eligibility: string | null;
  minimum_age: number | null;
  maximum_age: number | null;
  children_allowed: boolean | null;
  opening_hours: string | null;
  walk_in_allowed: boolean | null;
  appointment_required: boolean | null;
  referral_required: boolean | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  source_url: string | null;
  source_type: string;
  last_verified_at: string | null;
  verification_due_at: string | null;
  verification_status: string;
  internal_notes: string | null;
}

export interface MatchResult {
  id: number;
  name: string;
  serviceTypes: string[];
  suburb: string | null;
  distanceKm: number | null;
  reasons: string[];
  unknowns: string[];
  childrenAllowed: boolean | null;
  openingHours: string | null;
  walkInAllowed: boolean | null;
  appointmentRequired: boolean | null;
  referralRequired: boolean | null;
  phone: string | null;
  website: string | null;
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  verificationStatus: string;
}
