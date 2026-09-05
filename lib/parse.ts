import { Criteria, emptyCriteria, SERVICE_TYPE_VALUES, SUBURBS } from './types';
import { llmJson, llmConfigured } from './llm';

export interface ParseResult {
  criteria: Criteria;
  source: 'llm' | 'local';
}

function boolFromText(v: unknown): boolean | null {
  if (v === true || v === 'true' || v === 'yes') return true;
  if (v === false || v === 'false' || v === 'no') return false;
  return null;
}

function sanitize(raw: unknown): Criteria {
  const c = emptyCriteria();
  if (!raw || typeof raw !== 'object') return c;
  const r = raw as Record<string, unknown>;
  if (typeof r.serviceType === 'string' && SERVICE_TYPE_VALUES.includes(r.serviceType)) {
    c.serviceType = r.serviceType;
  }
  if (typeof r.location === 'string' && r.location && Object.keys(SUBURBS).some((s) => s.toLowerCase() === r.location!.toLowerCase())) {
    c.location = Object.keys(SUBURBS).find((s) => s.toLowerCase() === r.location!.toLowerCase())!;
  }
  if (r.urgency === 'today' || r.urgency === 'this_week') c.urgency = r.urgency;
  c.childrenAllowed = boolFromText(r.childrenAllowed);
  c.walkIn = boolFromText(r.walkIn);
  c.appointmentRequired = boolFromText(r.appointmentRequired);
  c.referralRequired = boolFromText(r.referralRequired);
  return c;
}

function localParse(q: string): Criteria {
  const text = q.toLowerCase();
  const c = emptyCriteria();

  if (/emergency accommodation|crisis accommodation|refuge|emergency housing|shelter/.test(text)) {
    c.serviceType = 'emergency_accommodation';
  } else if (/transitional|medium[- ]term housing/.test(text)) {
    c.serviceType = 'transitional_housing';
  } else if (/\bdfv\b|domestic violence|family violence/.test(text)) {
    c.serviceType = 'dfv_service';
  } else if (/legal/.test(text)) {
    c.serviceType = 'legal_assistance';
  } else if (/centrelink|welfare rights|payment support|payment problem/.test(text)) {
    c.serviceType = 'centrelink_support';
  } else if (/health|doctor|nurse|medical/.test(text)) {
    c.serviceType = 'health_service';
  } else if (/food|meal|grocer|hamper/.test(text)) {
    c.serviceType = 'food_assistance';
  } else if (/financial|money|bill relief|emergency relief/.test(text)) {
    c.serviceType = 'financial_assistance';
  }

  for (const s of Object.keys(SUBURBS)) {
    if (new RegExp(`\\b${s.toLowerCase()}\\b`).test(text)) {
      c.location = s;
      break;
    }
  }

  if (/tonight|today|right now|immediately|urgent/.test(text)) c.urgency = 'today';
  else if (/this week/.test(text)) c.urgency = 'this_week';

  if (/no walk[- ]?in|without walk[- ]?in/.test(text)) c.walkIn = false;
  else if (/walk[- ]?in/.test(text)) c.walkIn = true;

  if (/no appointment|without appointment/.test(text)) c.appointmentRequired = false;
  else if (/appointment (needed|required)/.test(text)) c.appointmentRequired = true;

  if (/no referral|without referral|self[- ]?refer/.test(text)) c.referralRequired = false;
  else if (/referral (needed|required)|agency referral/.test(text)) c.referralRequired = true;

  if (/(with|and|has) (two|three|four|\d+|her)? ?(children|kids|child)\b|accepts children/.test(text)) {
    c.childrenAllowed = true;
  } else if (/no children|women only/.test(text)) {
    c.childrenAllowed = false;
  }

  return c;
}

const SYSTEM_PROMPT = `You convert a caseworker's short referral request into structured search parameters for a community services directory.
Return ONLY a JSON object with these keys, using null when not stated:
- serviceType: one of [emergency_accommodation, transitional_housing, food_assistance, legal_assistance, health_service, centrelink_support, dfv_service, financial_assistance]
- location: one of [Redfern, Waterloo, Surry Hills, Newtown, Marrickville, Glebe, Ashfield, Bankstown, Parramatta, Campbelltown, Blacktown] or null
- urgency: "today" | "this_week" | null
- childrenAllowed: boolean | null (true only if children must be accepted)
- walkIn: boolean | null (true if a walk-in is required)
- appointmentRequired: boolean | null (false if "no appointment needed")
- referralRequired: boolean | null (false if "no referral needed")
Never invent values that are not in the request.`;

export async function parseReferralQuery(query: string): Promise<ParseResult> {
  if (llmConfigured()) {
    const raw = await llmJson(SYSTEM_PROMPT, query);
    if (raw) return { criteria: sanitize(raw), source: 'llm' };
  }
  return { criteria: localParse(query), source: 'local' };
}
