/**
 * Synthetic caseload roster — a larger demo directory so client search and
 * the People list feel real. Every profile here is fictional demo data with
 * the same provenance as the Phase 1 seed (all marked synthetic).
 */
export type RosterEntry = {
  ref: string;
  name: string;
  suburb: string;
  needs: string[];
  children?: number;
  languages?: string[];
  note: string;
  status: "open" | "closed";
  contextStatus: "approved" | "draft";
  openedDaysAgo: number;
};

type Raw = Omit<RosterEntry, "ref">;

const RAW: Raw[] = [
  { name: "Maya Thompson", suburb: "Inner West", needs: ["housing_accommodation"], children: 1, note: "Follow-up on housing; has dog Biscuit; safe phone available.", status: "open", contextStatus: "approved", openedDaysAgo: 34 },
  { name: "Jasmine Carter", suburb: "Marrickville", needs: ["dfv_safety", "legal"], note: "AVO matter listed soon; wants court advocacy support.", status: "open", contextStatus: "approved", openedDaysAgo: 21 },
  { name: "Sophie Nguyen", suburb: "Bankstown", needs: ["financial", "employment"], languages: ["english", "vietnamese"], note: "Left controlling relationship; needs financial counselling and work.", status: "open", contextStatus: "approved", openedDaysAgo: 19 },
  { name: "Priya Sharma", suburb: "Parramatta", needs: ["housing_accommodation", "dfv_safety"], children: 3, languages: ["english", "hindi"], note: "Escaping DFV with three kids; needs crisis placement.", status: "open", contextStatus: "approved", openedDaysAgo: 12 },
  { name: "Elena Kowalski", suburb: "Ashfield", needs: ["mental_health_counselling"], note: "Ongoing counselling after leaving violent partner.", status: "open", contextStatus: "approved", openedDaysAgo: 45 },
  { name: "Grace Mbeki", suburb: "Blacktown", needs: ["housing_accommodation", "financial"], children: 2, note: "Overcrowded sharehouse; saving for bond; needs income support.", status: "open", contextStatus: "draft", openedDaysAgo: 8 },
  { name: "Isabella Rossi", suburb: "Leichhardt", needs: ["legal", "dfv_safety"], note: "Property settlement after separation; referred to legal centre.", status: "open", contextStatus: "approved", openedDaysAgo: 27 },
  { name: "Amelia Hartley", suburb: "Newtown", needs: ["aod", "mental_health_counselling"], note: "Alcohol support after DV incident; engaged with counselling.", status: "open", contextStatus: "approved", openedDaysAgo: 52 },
  { name: "Yuki Tanaka", suburb: "Chatswood", needs: ["employment", "financial"], languages: ["english", "japanese"], note: "Rebuilding after returning to Sydney; job-readiness program.", status: "open", contextStatus: "draft", openedDaysAgo: 6 },
  { name: "Fatima Al-Sayed", suburb: "Lakemba", needs: ["dfv_safety", "housing_accommodation"], children: 4, languages: ["english", "arabic"], note: "Large family needs urgent relocation; visa concerns.", status: "open", contextStatus: "approved", openedDaysAgo: 15 },
  { name: "Chloe Bennett", suburb: "Bondi", needs: ["mental_health_counselling", "financial"], children: 1, note: "Post-separation anxiety; needs both counselling and budgeting help.", status: "open", contextStatus: "approved", openedDaysAgo: 33 },
  { name: "Nadia Petrov", suburb: "Campsie", needs: ["legal"], note: "Immigration advice after partner visa breakdown.", status: "open", contextStatus: "draft", openedDaysAgo: 4 },
  { name: "Ruby O'Sullivan", suburb: "Cronulla", needs: ["housing_accommodation"], children: 2, note: "Awaiting community housing; staying with friend short-term.", status: "open", contextStatus: "approved", openedDaysAgo: 40 },
  { name: "Leilani Tupou", suburb: "Liverpool", needs: ["dfv_safety", "aod"], note: "Safety planning plus AOD outreach; police involvement recently.", status: "open", contextStatus: "approved", openedDaysAgo: 18 },
  { name: "Hannah Zhou", suburb: "Hurstville", needs: ["employment"], note: "Resume and interview prep after five years out of workforce.", status: "open", contextStatus: "approved", openedDaysAgo: 60 },
  { name: "Sienna Moretti", suburb: "Five Dock", needs: ["housing_accommodation", "mental_health_counselling"], children: 1, note: "Rental arrears after leaving; needs brokerage and support.", status: "open", contextStatus: "draft", openedDaysAgo: 10 },
  { name: "Aisha Diallo", suburb: "Auburn", needs: ["dfv_safety"], languages: ["english", "french"], note: "Recently disclosed ongoing abuse; safety first, referrals later.", status: "open", contextStatus: "approved", openedDaysAgo: 7 },
  { name: "Charlotte Whitfield", suburb: "Mosman", needs: ["legal", "financial"], note: "High-asset separation; colluding ex-partner complicating matters.", status: "open", contextStatus: "approved", openedDaysAgo: 25 },
  { name: "Thuy Tran", suburb: "Cabramatta", needs: ["financial", "housing_accommodation"], languages: ["english", "vietnamese"], children: 2, note: "Emergency relief plus housing application in progress.", status: "open", contextStatus: "approved", openedDaysAgo: 30 },
  { name: "Emma Larsen", suburb: "Ryde", needs: ["mental_health_counselling"], children: 3, note: "Custody stress; counsellor referral accepted intake.", status: "open", contextStatus: "approved", openedDaysAgo: 38 },
  { name: "Zeynep Aydin", suburb: "Fairfield", needs: ["housing_accommodation", "legal"], languages: ["english", "turkish"], note: "Facing eviction; tribunal date set; legal help booked.", status: "open", contextStatus: "draft", openedDaysAgo: 5 },
  { name: "Olivia Grant", suburb: "Penrith", needs: ["dfv_safety", "employment"], note: "Left regional DV situation; needs work and safe housing.", status: "open", contextStatus: "approved", openedDaysAgo: 22 },
  { name: "Mei Ling Wu", suburb: "Burwood", needs: ["financial"], languages: ["english", "mandarin"], note: "Debt consolidation after financial abuse; documents ready.", status: "open", contextStatus: "approved", openedDaysAgo: 48 },
  { name: "Sara Haddad", suburb: "Greenacre", needs: ["housing_accommodation"], children: 2, languages: ["english", "arabic"], note: "Crisis accommodation waitlist; checking in weekly.", status: "open", contextStatus: "approved", openedDaysAgo: 14 },
  { name: "Bianca Ferreira", suburb: "Wollongong", needs: ["aod"], note: "Residential rehab inquiry; waiting for intake call.", status: "open", contextStatus: "draft", openedDaysAgo: 9 },
  { name: "Imani Williams", suburb: "Mount Druitt", needs: ["dfv_safety", "housing_accommodation"], children: 4, note: "Family of six needs urgent relocation from motel.", status: "open", contextStatus: "approved", openedDaysAgo: 3 },
  { name: "Freya Lindqvist", suburb: "Manly", needs: ["mental_health_counselling", "legal"], note: "Trauma counselling; also wants advice on intervention order.", status: "open", contextStatus: "approved", openedDaysAgo: 29 },
  { name: "Aroha Ngata", suburb: "Redfern", needs: ["employment", "financial"], note: "First job search after long-term abuse; needs confidence.", status: "open", contextStatus: "approved", openedDaysAgo: 17 },
  { name: "Ingrid Halvorsen", suburb: "Crows Nest", needs: ["housing_accommodation"], children: 1, note: "Staying in refuge; needs transitional housing options.", status: "open", contextStatus: "approved", openedDaysAgo: 26 },
  { name: "Kavitha Rao", suburb: "Strathfield", needs: ["legal", "financial"], languages: ["english", "telugu"], note: "Divorce settlement; superannuation split advice needed.", status: "open", contextStatus: "draft", openedDaysAgo: 11 },
  { name: "Tara Wilson", suburb: "Sutherland", needs: ["dfv_safety"], children: 2, note: "Case closed: safe long-term housing found and settled.", status: "closed", contextStatus: "approved", openedDaysAgo: 90 },
  { name: "Ana Silva", suburb: "Kogarah", needs: ["employment"], languages: ["english", "portuguese"], note: "Case closed: secured part-time work and stable rental.", status: "closed", contextStatus: "approved", openedDaysAgo: 120 },
  { name: "Diane Cho", suburb: "Epping", needs: ["mental_health_counselling"], note: "Case closed: counselling completed, follow-up declined.", status: "closed", contextStatus: "approved", openedDaysAgo: 150 },
  { name: "Rosa Delgado", suburb: "Marrickville", needs: ["housing_accommodation", "financial"], children: 1, note: "Case closed: relocated interstate with family support.", status: "closed", contextStatus: "approved", openedDaysAgo: 200 },
  { name: "Katarzyna Nowak", suburb: "Newtown", needs: ["aod", "mental_health_counselling"], note: "Case closed: rehab program finished, aftercare in place.", status: "closed", contextStatus: "approved", openedDaysAgo: 180 },
  { name: "Wei Chen", suburb: "Haymarket", needs: ["legal"], languages: ["english", "mandarin"], note: "Case closed: migration advice resolved.", status: "closed", contextStatus: "approved", openedDaysAgo: 240 },
];

/** Deterministic refs: roster position decides the CASE number. */
export const MOCK_ROSTER: RosterEntry[] = RAW.map((entry, index) => ({
  ...entry,
  ref: `CASE-2026-${String(index + 2).padStart(3, "0")}`,
}));
