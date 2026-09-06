/**
 * Mock data for the A2 design screens (Figma "Claude" page).
 * Every string here is taken verbatim from the frames so the screens match the
 * design exactly. This is presentation-only demo content — it does not touch
 * the Postgres-backed casework flow under / and /women.
 */

export const CASEWORKER = { name: "Hannah Lee", role: "Caseworker", initials: "HL" };

export const TODAY_SUBLINE = "Saturday 6 September · 3 need attention · 1 running";
export const ASK_PLACEHOLDER =
  "Search a client by name or LP number, or say what needs doing";

export type AttentionRow = {
  name: string;
  detail: string;
  meta: string;
  overdue?: boolean;
};

export const NEEDS_ATTENTION: AttentionRow[] = [
  {
    name: "Maya Thompson",
    detail: "Housing follow-up · Harbour House callback",
    meta: "Overdue",
    overdue: true,
  },
  { name: "Jasmine Carter", detail: "Callback after counselling", meta: "13:00" },
  { name: "Sophie Nguyen", detail: "Safety review · safe phone check", meta: "15:00" },
];

export const RUNNING_TASK = {
  label: "Finding housing for Maya",
  elapsed: "a few seconds",
  action: "Open",
};

export const FOLLOW_UPS_DUE: AttentionRow[] = [
  {
    name: "Link2Home referral · Jasmine",
    detail: "sent 1 Sep · day 5",
    meta: "send follow-up",
  },
  {
    name: "Housing NSW appeal · Grace",
    detail: "reply overdue 9 days",
    meta: "Overdue",
    overdue: true,
  },
];


export const LETTERS_TO_WRITE = [
  {
    name: "Support letter · Housing NSW",
    detail: "for Maya · draft from her plan",
    meta: "Draft",
  },
  {
    name: "Referral letter · Leila Ahmed",
    detail: "draft kept · 2 Sep",
    meta: "Draft",
  },
];

/* ── Search dropdown (A2 / Today · search) ───────────────────────────── */

export const SEARCH_QUERY = "Maya";

export const SEARCH_RESULT = {
  initials: "MT",
  name: "Maya Thompson",
  line1: "LP-0248 · Housing follow-up · last contact today 09:25",
  line2: "Dog (Biscuit) · Inner West · safe phone: yes · Centrelink: yes",
  filesLabel: "Linked files",
  files: [
    "Contact note · today",
    "Preferences",
    "Support letter · draft",
    "Emails · 3 referrals",
    "Plan · 2 of 5",
  ],
  actions: ["Open profile", "Ask about Maya"],
  secondary: "New case note",
};

/* ── Alerts panel (A2 / Today · alerts) ──────────────────────────────── */

export const ALERTS = {
  title: "Alerts",
  count: 3,
  items: [
    "Overdue · Maya's housing follow-up · 09:00",
    "Reply · Link2Home answered Jasmine's referral · 09:12",
    "Capacity · Harbour House capacity unknown — call to confirm · Demo status.",
  ],
  markAll: "Mark all read",
};

export const IDENTITY_MENU = {
  line: "Hannah Lee · Caseworker · Lou's Place",
  items: ["My day", "Contributions", "Settings"],
  logout: "Log out",
};

/* ── Two bars / long ask (A2 / Today · two bars, · long ask) ─────────── */

export const TWO_BARS = {
  clientPlaceholder: "Search a client · name or LP number",
  askPlaceholder: "Say what needs doing",
  note: "Matches one client before anything runs.",
};

export const LONG_ASK = {
  confirm: "For Maya Thompson · LP-0248 · confirm",
  notHer: "Not Maya?",
  body: `• Dog Biscuit (staffy cross, 6 yrs) has to come with her, she will not leave him behind
• Night shifts at RPA, Tue to Sat, 21:00 to 07:00, so she cannot take a place with a curfew
• Wants to stay in the Inner West, near her sister in Marrickville
• Shared bank account with her ex, not yet separated, worried he can see transactions
• Centrelink in place, safe phone confirmed today
• Wants a callback, not email, he checks her inbox`,
  chips: ["appointment-notes.txt", "contact-note · today"],
  run: "Run for Maya",
};

/* ── Spotlight (A2 / Spotlight) ──────────────────────────────────────── */

export const SPOTLIGHT = {
  query: "accommodation",
  groups: [
    {
      label: "Shelters",
      items: [
        { title: "Accommodation availability", detail: "Demo status. Capacity is not tracked" },
        { title: "Harbour House", detail: "Current capacity unknown — call to confirm" },
        { title: "Elsie Refuge", detail: "women + children only · capacity unknown" },
      ],
    },
    {
      label: "Clients",
      items: [
        { title: "Maya Thompson", detail: "LP-0248 · shelter callback overdue" },
      ],
    },
    {
      label: "Actions",
      items: [
        {
          title: "Book a Harbour House callback",
          detail: "for Maya · by phone, logged",
        },
      ],
    },
    {
      label: "Pages",
      items: [
        { title: "Shelters", detail: "" },
        { title: "Follow-ups", detail: "" },
      ],
    },
  ],
  footer: "Enter to open · Esc to close · type a name, a shelter, a plan or a letter",
};

/* ── Working (A2 / Working · with / without activity) ────────────────── */

export const WORKING = {
  ask: "Find pet-friendly housing for Maya in the Inner West, close to transport.",
  status: "running 40 s",
  steps: [
    {
      title: "Read Maya's note and preferences",
      detail: "Dog, prefers Inner West, needs bus or train",
      time: "09:26",
      state: "done" as const,
    },
    {
      title: "Searched the housing directory",
      detail: "14 services · 9 in the Inner West",
      time: "09:26",
      state: "done" as const,
    },
    {
      title: "Checking pet policy and vacancy",
      detail: "2 of 3 checked",
      time: "now",
      state: "running" as const,
      lines: [
        "Harbour House · accepts dogs · vacancy unconfirmed",
        "Bridgewell · pet policy on file · checking transport",
        "Cedar Family Support · waiting",
      ],
    },
  ],
  approval: {
    badge: "Needs you",
    title: "Send Maya the shortlist and ask about her dog's size?",
    draft:
      "Hi Maya, I've found three places near Marrickville and Ashfield that take dogs. Before I contact them, can you tell me how big your dog is? I'll set up a callback once you're happy with one.",
    note: "Click to edit · saved to Maya's file as an SMS when sent",
    primary: "Send",
    secondary: "Skip",
    time: "09:28",
  },
  queued: {
    title: "Write the shortlist into Maya's record",
    detail: "After you decide",
    meta: "queued",
  },
  footNote: "Sends and bookings wait for your OK.",
  activity: {
    title: "Activity",
    badge: "Live",
    lines: [
      "09:26  Opened contact note",
      "09:26  Read preferences (yesterday)",
      "09:26  Searched directory: 14",
      "09:27  Filtered Inner West: 9",
      "09:27  Harbour House site: dogs OK",
      "09:27  Vacancy: not stated",
      "09:27  Bridgewell: policy on file",
      "09:27  Cedar: no answer yet",
      "09:27  Checking bus routes",
      "09:28  Drafted message to Maya",
      "09:28  Held it for your OK",
    ],
  },
  sources: {
    title: "Sources",
    items: [
      { name: "Contact note", meta: "Today 09:25" },
      { name: "Preferences", meta: "Reviewed yesterday" },
      { name: "Housing directory", meta: "current directory" },
    ],
  },
  sourcesInline:
    "Sources · Contact note (today 09:25) · Preferences (yesterday) · Housing directory (current)",
};

/* ── Done (A2 / Done, A2 / Done · choosing) ──────────────────────────── */

export const DONE = {
  ask: "Find pet-friendly housing for Maya in the Inner West, close to transport.",
  status: "Done in 1 min 48 s · 5 steps · 1 waited for you",
  options: [
    {
      badge: "Best fit",
      minutes: "6 min",
      walk: "walk to the station",
      name: "Harbour House",
      area: "Marrickville",
      facts: ["Dogs OK", "Vacancy: confirm by phone"],
      link: "Shelter details",
      primary: "Lock in Harbour House",
    },
    {
      minutes: "11 min",
      walk: "walk to the station",
      name: "Bridgewell",
      area: "Ashfield",
      facts: ["Dogs on file", "Pet bond: not stated"],
      link: "Shelter details",
    },
    {
      minutes: "4 min",
      walk: "walk to the station",
      name: "Cedar Family Support",
      area: "Leichhardt",
      facts: ["Capacity unknown — call to confirm", "Pet policy: waiting on a call"],
      link: "Shelter details",
    },
  ],
  did: {
    title: "Did",
    items: [
      "Read Maya's note and preferences",
      "Searched the directory (14)",
      "Checked 3 pet policies",
      "Sent Maya a message at 09:28",
    ],
  },
  didnt: {
    title: "Didn't",
    items: [
      "Did not book anything",
      "Did not change Maya's record",
      "Did not contact the services",
    ],
  },
  nextActions: ["Book the callback", "Add all three to Maya's plan"],
  lockNote: "Locked choices let the assistant act on them.",
  paperTrail: {
    title: "Paper trail",
    items: [
      { name: "Message to Maya", meta: "09:28 · SMS · saved to file" },
      {
        name: "Harbour House",
        meta: "called 09:27 · dogs OK, vacancy unconfirmed · logged",
      },
      { name: "Bridgewell", meta: "policy from file · 09:27" },
      { name: "Cedar", meta: "no answer · try again 14:00" },
    ],
    link: "Open Maya's file",
  },
  chooseNote: "Click a shelter to choose it, then confirm.",
  choosing: {
    badge: "Current best fit",
    lockedLabel: "Locked in",
    confirm: "Make Bridgewell the best fit",
    cancel: "Cancel",
  },
};

/* ── My clients (A2 / My clients) ────────────────────────────────────── */

export const MY_CLIENTS = {
  title: "My clients",
  subline: "8 open · 2 overdue · 3 waiting on a service",
  filters: ["Mine", "All", "Overdue", "Waiting on service", "Running"],
  columns: [
    "Client",
    "Focus",
    "Stage",
    "Last contact",
    "Next follow-up",
    "Attention",
    "Assistant",
  ],
  rows: [
    {
      name: "Maya Thompson",
      focus: "Housing · dog",
      stage: "Shelter callback",
      last: "today 09:25",
      next: "Overdue",
      nextOverdue: true,
      attention: "2",
      assistant: "running · step 3",
    },
    {
      name: "Jasmine Carter",
      focus: "Counselling · housing",
      stage: "Referral sent · Link2Home",
      last: "yesterday",
      next: "day 5 · today",
      attention: "–",
      assistant: "–",
    },
    {
      name: "Sophie Nguyen",
      focus: "Safety · tech",
      stage: "Safety review",
      last: "3 Sep",
      next: "15:00",
      attention: "–",
      assistant: "–",
    },
    {
      name: "Leila Ahmed",
      focus: "Referral letter",
      stage: "Draft kept",
      last: "2 Sep",
      next: "8 Sep",
      attention: "–",
      assistant: "stopped by you",
    },
    {
      name: "Amara Okafor",
      focus: "Nil income accommodation",
      stage: "Searching · 4 shelters asked",
      last: "today",
      next: "today",
      attention: "–",
      assistant: "running · step 2",
    },
    {
      name: "Grace Liu",
      focus: "Unsatisfactory tenant appeal",
      stage: "Waiting on Housing NSW",
      last: "28 Aug",
      next: "Overdue 9 days",
      nextOverdue: true,
      attention: "1",
      assistant: "–",
    },
    {
      name: "Nadia Rahimi",
      focus: "Interpreter · Dari",
      stage: "Intake",
      last: "yesterday",
      next: "Mon",
      attention: "–",
      assistant: "–",
    },
    {
      name: "Priya Nair",
      focus: "Safe phone",
      stage: "Done",
      last: "1 Sep",
      next: "–",
      attention: "–",
      assistant: "–",
    },
  ],
  runningNow: {
    title: "Running now",
    items: [
      { name: "Housing for Maya", detail: "step 3 of 5 · checking pet policy" },
      { name: "Nil-income bed for Amara", detail: "step 2 of 4 · calling Bonnie Support" },
    ],
    action: "Open",
  },
  waiting: {
    title: "Waiting on a service",
    items: [
      {
        name: "Grace Liu",
        detail: "Housing NSW · appeal reply overdue 9 days · by email",
      },
      { name: "Jasmine Carter", detail: "Link2Home · referral day 5 · follow-up today" },
      { name: "Amara Okafor", detail: "Bonnie Support · emailed 3 Sep · no reply yet" },
    ],
    action: "Send follow-up",
  },
};

/* ── Profile (A2 / Profile · Maya) ───────────────────────────────────── */

export const MAYA = {
  initials: "MT",
  name: "Maya Thompson",
  ref: "LP-0248",
  subline: "LP-0248 · with Hannah Lee since 12 Aug · last contact today 09:25",
  chips: [
    "Dog · Biscuit",
    "Inner West",
    "Safe phone · yes",
    "Centrelink · yes",
    "Visa · citizen",
    "Language · English",
  ],
  quickExitNote: "Quick exit opens her escape plan in one click.",
  quickExitButton: "Quick exit plan",
  actions: ["Ask about Maya", "New case note"],
  secondaryAction: "Support letter",
  summary: {
    title: "Summary profile",
    body: "Maya needs a safe place tonight for herself and her dog Biscuit, then a longer-term housing pathway in the Inner West near transport. She has a safe phone and Centrelink in place and shares a bank account with her ex-partner, which she wants separated. Since 12 Aug she has been referred to Link2Home (email chain saved) and three pet-friendly shelters are shortlisted. She declined a shelter with a 10 pm curfew on 2 Sep because she works night shifts; revisit if no bed by Friday.",
    checked: "Checked with Maya · 2 Sep",
    actions: ["Send with a referral", "Expand"],
    note: "Last summarised 2 Sep · updates only when you ask",
  },
  plan: {
    title: "Plan · 2 of 5",
    action: "Open plan",
    nextLabel: "Next",
    next: [
      "Harbour House callback · today · Hannah",
      "Crisis bed fallback · Elsie Refuge · if no callback by 16:00",
    ],
  },
  files: {
    title: "Files",
    note: "by type · newest first",
    items: [
      { name: "Contact notes (6)", detail: "latest today 09:25" },
      { name: "Preferences", detail: "reviewed yesterday" },
      { name: "Support letters (2)", detail: "Housing NSW draft" },
      {
        name: "Emails",
        detail: "Link2Home referral · sent 28 Aug · follow-ups 2 Sep, 7 Sep due · PDF saved",
      },
      { name: "Calls", detail: "Harbour House 09:27 · logged" },
    ],
    action: "Open",
  },
  recentContact: {
    title: "Recent contact",
    link: "All contact notes",
    items: [
      { when: "Today 09:25", what: "Contact note · phoned about Harbour House · Hannah" },
      {
        when: "Yesterday",
        what: "Preferences reviewed with Maya · no curfew, near transport",
      },
      { when: "2 Sep", what: "Plan reviewed together · curfew shelter declined" },
    ],
  },
  referrals: {
    title: "Referrals in flight",
    items: [
      {
        name: "Harbour House · best fit",
        detail: "locked in 09:31 · callback by phone, logged",
      },
      { name: "Link2Home", detail: "day 9 · follow-up 7 Sep · by email" },
      { name: "Harbour House", detail: "callback due today · by phone" },
      { name: "Bridgewell", detail: "emailed yesterday · no reply yet" },
    ],
  },
  attention: {
    title: "Needs attention · for Maya",
    items: [
      { name: "Harbour House callback", detail: "overdue since 09:00" },
      { name: "Link2Home follow-up", detail: "due 7 Sep · email" },
      { name: "Bank account", detail: "Maya to confirm CBA appointment" },
    ],
  },
};

export const QUICK_EXIT = {
  title: "Maya's quick exit plan",
  subline:
    "Updated 2 Sep with Maya · one click from her profile · nothing is sent without her",
  items: [
    {
      name: "Safe place tonight",
      detail: "Harbour House callback today · fallback Elsie Refuge",
    },
    { name: "Safe phone", detail: "second phone · number kept off this screen" },
    { name: "Money", detail: "separate CBA account pending · cash card at Lou’s" },
    { name: "Transport", detail: "train from Marrickville · Opal on the safe phone" },
    {
      name: "Who to call",
      detail: "1800RESPECT · DV Line NSW · police only if she chooses",
    },
    { name: "Bag", detail: "packed · at her sister’s" },
    { name: "Signal", detail: "text “raining” to Hannah means come now" },
  ],
  actions: ["Open the plan", "Print to PDF", "Send to safe phone"],
  close: "Close",
};

/* ── Plan (A2 / Plan · Maya) ─────────────────────────────────────────── */

export const PLAN = {
  title: "Maya's plan",
  subline: "Client-led · reviewed together 2 Sep · 2 of 5 done",
  suggestions: {
    title: "Suggestions",
    chips: [
      "Domestic violence",
      "Homelessness",
      "Dog",
      "Nil income",
      "Visa concern",
      "Shared bank account",
      "Phone unsafe",
    ],
    placeholder: "e.g. Children at school in Ashfield",
    add: "Add",
    note: "Suggestions, not the plan. Maya decides.",
  },
  actions: {
    title: "Actions",
    quickExit: "Quick exit",
    openPlan: "Open the full plan",
    items: [
      {
        name: "Safe place tonight",
        detail: "Harbour House callback today · fallback Elsie Refuge",
      },
      { name: "Safe phone", detail: "second phone · number kept off this screen" },
      { name: "Money", detail: "separate CBA account pending" },
    ],
  },
  groups: [
    {
      label: "Safe tonight",
      items: [
        { name: "Harbour House callback", detail: "today · Hannah · now" },
        {
          name: "Crisis bed fallback · Elsie Refuge",
          detail: "if no callback by 16:00",
        },
      ],
    },
    {
      label: "Housing pathway",
      items: [
        {
          name: "Link2Home referral",
          detail: "sent 28 Aug · follow-up due 7 Sep · email chain saved",
        },
        { name: "Shortlist three pet-friendly shelters", detail: "done today" },
      ],
    },
    {
      label: "Money",
      items: [
        { name: "Separate bank account", detail: "CBA appointment · Maya to confirm" },
        { name: "Centrelink", detail: "in place" },
      ],
    },
    {
      label: "Declined",
      items: [
        {
          name: "Shelter with a 10 pm curfew · declined 2 Sep",
          badge: "why",
          detail: "wants to keep night shifts · revisit if no bed by Friday",
        },
      ],
    },
  ],
  add: {
    label: "Add anything · not from a suggestion",
    placeholder:
      "Talk it through · e.g. Maya wants to keep night shifts, add a no-curfew note to the shelter search",
    button: "Add to plan",
    note: "Stored with the plan · picks up where you left off next time",
  },
  letter: {
    name: "Support letter from this plan",
    detail: "Uses case notes and this plan",
  },
  reviewed: {
    title: "Reviewed with Maya",
    action: "Add a review",
    items: [
      { when: "Today 09:31", what: "Hannah · via assistant · shelter shortlist locked" },
      { when: "2 Sep", what: "together · in person · curfew shelter declined" },
      { when: "26 Aug", what: "phone · Link2Home follow-up agreed" },
      { when: "12 Aug", what: "intake · plan started" },
    ],
  },
  suggested: {
    label: "Suggested",
    name: "Safety plan",
    detail: "from Domestic violence · not in the plan yet",
    actions: ["Add to plan", "Not now"],
  },
};

/* ── Shelters (A2 / Shelters, A2 / Shelters · ask) ───────────────────── */

export const SHELTERS = {
  title: "Accommodation and crisis services",
  subline: "14 services · 9 confirmed this week · for Maya: 3 eligible",
  filters: [
    "Inner West",
    "Women only",
    "Women + children",
    "Pets",
    "Nil income accepted",
    "No curfew",
    "Mixed",
  ],
  columns: ["Shelter", "Area", "Takes", "Availability (how, when)", "For Maya"],
  rows: [
    {
      name: "Harbour House",
      area: "Marrickville",
      takes: "women, pets, curfew 11 pm",
      forMaya: "Eligible",
      eligible: true,
    },
    {
      name: "Bridgewell",
      area: "Ashfield",
      takes: "women + children, pets on file",
      forMaya: "Eligible",
      eligible: true,
    },
    {
      name: "Cedar Family Support",
      area: "Leichhardt",
      takes: "women + children",
      forMaya: "Waiting on a call",
    },
    {
      name: "Elsie Refuge",
      area: "Glebe",
      takes: "women + children only",
      forMaya: "Not eligible · no children",
    },
    {
      name: "Rosa House",
      area: "Newtown",
      takes: "women, no AOD, no pets",
      forMaya: "Not eligible · dog",
    },
    {
      name: "Link2Home",
      area: "statewide",
      takes: "referral line",
      forMaya: "Referral sent 28 Aug",
    },
    {
      name: "Bonnie Support",
      area: "Marrickville",
      takes: "women, nil income accepted",
      forMaya: "Eligible",
      eligible: true,
    },
    {
      name: "Northern Beaches Refuge",
      area: "Manly",
      takes: "women + children",
      forMaya: "Not eligible · no children · far",
    },
  ],
  showAll: "Show all 14 services",
  showAllNote:
    "6 more outside Inner West · capacity is only what a provider confirmed, and when",
  newService: {
    title: "Heard of a new service?",
    placeholder: "Type its name",
    note: "The assistant finds what it does, who it takes, how to refer, and wait times, then adds it here for you to check.",
  },
  lastChecked: {
    title: "Last checked",
    items: [
      "Harbour House · 09:10 · called",
      "Elsie Refuge · 08:50 · called",
      "Bonnie Support · 3 Sep · emailed",
      "Cedar Family Support · 25 Aug · no answer",
    ],
  },
  callList: {
    title: "Call list · today",
    items: [
      { name: "Cedar Family Support", detail: "retry 14:00" },
      { name: "Harbour House", detail: "confirm capacity by 16:00" },
      { name: "Rosa House", detail: "ask about pet bond" },
    ],
  },
  ask: {
    value:
      "Maya: dog, Inner West, no children, Centrelink, needs a bed tonight, no curfew",
    button: "Find shelters",
    resultsTitle: "3 eligible for Maya",
    resultsNote:
      "Demo status. From the ask above — the service data carries wait times, not capacity.",
    results: [
      {
        name: "Harbour House",
        badge: "Eligible",
        area: "Marrickville · Inner West",
        takes: "women, pets, curfew 11 pm",
        capacity: "Current capacity unknown — call to confirm.",
        why: "dog OK · Inner West · no curfew",
        action: "Lock in",
        actionNote: "best fit on what we know — capacity still to confirm",
      },
      {
        name: "Bridgewell",
        badge: "Eligible",
        area: "Ashfield · Inner West",
        takes: "women + children, pets on file",
        capacity: "Current capacity unknown — call to confirm.",
        why: "pets on file · no curfew",
        action: "Choose",
      },
      {
        name: "Bonnie Support",
        badge: "Eligible",
        area: "Marrickville · Inner West",
        takes: "women, nil income accepted",
        capacity: "Current capacity unknown — call to confirm.",
        why: "Centrelink OK · nil income accepted · no curfew",
        action: "Choose",
      },
    ],
    notEligible: "5 not eligible · see why",
    notEligibleNote: "Elsie Refuge, Rosa House and 3 more",
  },
};

/* ── Client context bar, shown on client-scoped screens ──────────────── */

export const CLIENT_BAR = {
  name: "Maya Thompson · LP-0248",
  links: ["Profile", "Quick exit", "Plan", "Shelters", "Referrals", "Notes", "Letters"],
  quickExit: "Quick exit plan",
};

/* ── States (A2 / States) ────────────────────────────────────────────── */

export const STATES = {
  title: "A2 states",
  note: "Every control in the matte recipe · rest / hover / pressed / focus / disabled · rest is white 6% over a 28 blur, hover lifts 2 px to white 16%, pressed drops to white 2%, focus is a 2 px orange ring, disabled is 40%",
  columns: ["Rest", "Hover", "Pressed", "Focus", "Disabled"],
  rows: ["Nav link", "Alerts pill", "Identity chip", "Spotlight bar"],
};
