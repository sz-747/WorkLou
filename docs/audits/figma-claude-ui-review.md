# Claude UI/UX review — 2026-09-06

Status: audit ready for review; UI implementation has not started.

## Scope and evidence

Reference: [Lou’s Place / Claude](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ/Lou-s-Place-%E2%80%94-Website-Concepts?node-id=118-2). All 17 top-level frames on this page were retrieved with Figma MCP design context and their returned screenshots inspected. This does not include other pages in the Figma file.

Code baseline: `f97d2b6747c40f9a7b9e646c65d45dee1d406c6f`, the current glossy local preview. Branch `codex/figma-claude-review` was created from fetched main `e8e924ff47ce02f2c58a60b03a8f570c0bb57462`, then fast-forwarded to the preview baseline in an isolated worktree. Main and the original preview branch are not edited.

Evidence includes [raw page metadata](figma-claude-metadata.xml), [frame/section/text/style inventory](figma-claude-inventory.json), current component/page source, and browser spot checks of Today and People. The inventory preserves nested section names and design copy for follow-up work. Screenshots were inspected through MCP, not committed as local artifacts. This is a screen-and-source audit, not a pixel-diff certification or an exhaustive browser interaction test.

Figma OAuth was renewed. Local MCP startup/tool budgets are now 90/180 seconds. Resource discovery, page metadata, and all 17 individual design-context calls succeeded after reconnecting. Small frame requests avoid one oversized page request. This reduces timeout exposure; it cannot guarantee external service availability. Local MCP configuration and OAuth credentials are not repository files.

## Priority definitions

- P1: incorrect client context, misleading completion, or blocked user task.
- P2: layout, information hierarchy, interaction state, or accessibility mismatch.
- P3: visual polish after the flow works.
- Decision: design alternatives or intentional product changes requiring alignment.

## Findings that should lead the implementation

| ID | Priority | Current evidence | Required outcome |
|---|---|---|---|
| F01 | P1 | `QuickExit.tsx` imports MAYA/QUICK_EXIT and takes no client prop. The real `clients/[id]` profile renders it. | Quick exit always belongs to the selected case. Missing plans show an honest empty state. Open plan/print/send must work or be clearly unavailable. No automatic transmission. |
| F02 | P1 | `AskBar.tsx` matches the static Maya SEARCH_RESULT; Run and result actions have no handlers. Amira search returned no result in the local browser spot check. | Search actual cases, preserve the selected case, and route Open/Ask/New note and Run to supported actions. |
| F03 | P1 | `Spotlight.tsx` stores query text but renders unchanged mock groups; result buttons have no actions and Enter is unimplemented. | Filter real destinations, support keyboard selection/Enter/Escape, and open the selected target with case context. |
| F04 | P1 | `Filters.tsx` changes its own active state without a data/query callback. `ClientBar.tsx` uses href="#" and a nonfunctional quick-exit action. | Filters change results; contextual tabs navigate to real case routes and accurately show the active section. |
| F05 | P1 | Profile Open plan links to workflow and says plans are not in the database, while a real `clients/[id]/plan` route exists. File Open links all go to workflow; letter action loses case context. | Connect each action to its relevant object and preserve the case. Remove obsolete availability copy. |
| F06 | P1 | `WorkingView.tsx` Send only sets local state, then claims “Sent · saved to Maya's file as an SMS.” Steps/logs are static; the queue never advances. | Distinguish demo from real work. A success message requires the corresponding persisted event. Existing backend policy is worker-marked sent, never autonomous transmission. |
| F07 | P1 | `DoneView.tsx` keeps choices in useState; refresh resets them. Several detail/file/book actions are inert. Mock paper trail reads like completed work. | Explicitly confirm a choice, persist supported decisions, and derive history from actual events. Label unavailable demo actions. |
| F08 | P1 | `ShelterAsk.tsx` displays the same Maya/results after arbitrary input; Find only reveals static cards. Selection/lock/excluded-result controls do nothing. | Use selected case and supported matching; do not mix mock eligibility with the real directory without a clear demo boundary. |
| F09 | P1 | Today rows are noninteractive text; Mark all read is a paragraph; identity actions have no handlers. | Give actionable items a destination. Only expose supported account/read-state operations. |
| F10 | P2 | `letters/page.tsx` renders nonclickable RailRows; the letters view model reads general case documents. | Define a letter versus a case note, label accurately, and open the underlying document. No standalone Letters frame exists here. |

Sources above are under `src/components/a2/`, `src/app/(a2)/`, and `src/lib/a2/`. Findings distinguish source-confirmed behavior from the limited live browser checks.

## Complete frame coverage

Each row covers the frame's meaningful sections, including variant-specific states.

| Figma frame | Designed sections | Current delta / next work |
|---|---|---|
| [Shelters 136:2](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=136-2) | Context bar; area/eligibility filters; service table with Takes, Beds (how/when), For Maya; discovery request; last-checked rail; call list | P1 filters and context are disconnected. Decision: current Contact/Last checked columns and omitted call list deliberately avoid unsupported capacity/eligibility. Preserve unknowns; introduce those design fields only with provenance and case matching. |
| [Today 136:139](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=136-139) | Heading/subline; unified ask; Needs attention with running task and follow-up links; capacity rail; Letters rail | P1 ask and attention navigation. P2 running task and Letters rail missing. Empty seed lists are valid; do not add fictional work to reproduce density. |
| [Profile · Maya 136:217](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=136-217) | Context tabs; glass profile header/chips; summary with expand/share/review date; timeline/referrals; attention/files; plan progress; quick exit and ask | P1 wrong-case quick exit and misrouted plan/files. P2 unboxed header, missing summary controls and plan progress, different timeline structure. Bind the design to the real case rather than restoring Maya copy. |
| [My clients 136:279](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=136-279) | Full-width table; Mine/All/Overdue/Waiting/Running; Assistant column; Running and Waiting cards below | P1 filters. P2 current narrow table with waiting rail on right. Decision: People naming, Add New Person, and omitted Mine/Running/Assistant reflect current intake and absence of auth/jobs. |
| [Plan · Maya 136:341](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=136-341) | Suggestion toggles/custom addition; reviewed-with history; accept/not-now; grouped client-led actions; quick-exit subset; declined/revisit; freeform action; support letter | Decision: current real plan is a narrow sequential suggestions/actions/services/email workflow. Map existing persistence to these sections before changing layout. Do not replace functional backend work with the mock plan. |
| [Working · with activity 137:27](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=137-27) | Compact ask/runtime; completed/running/queued steps; editable Needs-you draft, Send/Skip; activity and sources rail | P1 fabricated completion and no task progression. P2 header arrangement and completed step icons (currently hollow rings); P3 activity typography should use the referenced mono font. |
| [Working · without activity 137:211](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=137-211) | Same approval/step flow, full-width main card, source footer below | P2 current Hide activity retains the two-column grid with sources on the right. Hiding the rail should reflow the card/footer. |
| [Done 137:400](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=137-400) | Three result cards plus fourth paper-trail column; best fit/lock; Did/Didn't below; add/book/file footer | P1 choice persistence and event truth. P2 paper trail currently below the three cards; action controls inert and semantic emphasis flattened. |
| [Today · search 138:2](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=138-2) | Inline overlay; dimmed underlying panels; client summary left, related files right; Open/Ask/New note | P1 real matching and actions. P2 existing result content is stacked and lacks the designed surrounding dim state. Add no-match/loading/error states using real search behavior. |
| [Today · alerts 138:215](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=138-215) | Alert popover with Open/Mark all read; identity popover with My day/Settings/Log out | Real alert links reach profiles. P1 read/account controls incomplete; identity remains Hannah mock. Decision: updated alert chip styling versus orange badge. |
| [Today · two bars 144:12](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=144-12) | Separate client matcher and task composer; single-client match before execution | Decision: alternative to unified ask. Copy exists in mock constants without a rendered consumer; select the intended entry flow before implementing both. |
| [Today · long ask 144:178](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=144-178) | Expanded multiline composer; confirmed client; Not Maya?; attachment/source chips; run-for-client; dimmed page | P1 context confirmation and execution missing; P2 expanded composer state absent. Define client correction and attachment behavior explicitly. |
| [Shelters · ask 146:47](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=146-47) | Contextual request; three cards with takes/beds/why; choose/lock; excluded reasons; discovery and call list | P1 static response and inert controls. Decision: translate eligibility/capacity only where supported; current embedded mock ask above real directory blurs the boundary. |
| [Profile · quick exit 153:45](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=153-45) | Maya's plan modal; safe place/phone/money/transport/contact/bag/signal with status; review date; Open/Print/Send/Close | P1 selected-case data and actions. P2 status presentation and dialog focus management. Escape/backdrop/Close exist, but focus trap/restore and aria-modal are missing. |
| [States 154:3](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=154-3) | Twenty control families across rest/hover/pressed/focus/disabled | P2 current states page only demonstrates four families, mostly illustrative spans. Build from actual controls to verify their real states; see checklist below. |
| [Done · choosing 171:2](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=171-2) | Current best fit muted; candidate orange outline; explicit confirm/cancel | P1 transient local selection and incomplete lock action. P2 missing conditional card emphasis; nested button-like spans need valid separate controls and Space/Enter handling. |
| [Spotlight 175:94](https://www.figma.com/design/7cmuQrKGi1R0VfBchTfuqZ?node-id=175-94) | Centered dialog; input; grouped shelters/clients/actions/pages; selected row; Enter/Escape hints | P1 actual search and activation. P2 modal focus containment/return, selection semantics and keyboard navigation. Escape is implemented; Enter is not. |

## Shared visual system

Keep the user's current glossy treatment. The existing Instrument Sans, 40px page headings, rounded translucent sheets, warm/cool canvas and orange focus language already align substantially. There is no justification for a wholesale visual reset.

Desktop reference geometry is 1440px wide: content starts at x120; common main/rail widths are 840/320 with 40 gap. Today unified ask is 880px wide. Most frames are 1000px high; States is 1620px. The browser spot check used a narrower window, so these dimensions are reference targets, not proven pixel differences.

| Area | Reference | Current / recommendation |
|---|---|---|
| Navigation | Logo inside left navigation island; Today/My clients/Shelters/Plans/Letters/Follow-ups; separate utility island | Logo is outside; active tab uses a scribble; Letters is absent. Decide retained glossy identity details, restore discoverability of supported pages. |
| Client context | Under global navigation and above the page; active/status-aware case tabs | Often at the bottom; generic Maya fallback on demo routes; no active state. Move and bind context after fixing routes. |
| Buttons | Clear black primary, ghost secondary, orange contextual emphasis | Shared milky-gradient rules flatten primary/secondary distinction. Retain gloss while restoring emphasis. |
| Typography | Instrument Sans; Geist Mono for activity | Main font aligned; activity line styling lacks the referenced mono family. |
| Status | Filled green completion; orange needs-attention/focus; explicit current/candidate states | Some hollow rings and badges replace meaningful state treatment. Use icon/text as well as color. |
| Surfaces | Pale gradient, translucent sheets, warm/cool blur, dots/sparkles | Existing implementation has these ingredients. Compare at matched viewport before tuning opacity, blur, spacing, or highlights. |

State coverage needed: nav link, alerts pill, identity chip, spotlight bar, search island, filter chip, checklist row, plan row, needs-you draft, toggle, table row, result card, popover row, black pill, ghost pill, composer, add suggestion, find housing, search button, spotlight result row. Reference captions specify rest 6%, hover white 16%/2px lift, pressed white 2%, orange 2px focus, disabled 40%, blur 28. Treat these as reference recipes; Figma effect values and CSS backdrop blur need visual calibration rather than mechanical equality. Preserve reduced-motion behavior and make disabled controls semantically disabled.

## Decisions and design contradictions

1. Unified ask versus two-bar entry: both appear as alternatives. Agree on default and expansion path.
2. Glossy evolution versus literal original navigation/buttons: keep gloss as requested, while restoring semantic hierarchy and predictable navigation.
3. Plan structure: reconcile the new persisted plan flow with the older design before replacing either.
4. Real data versus mock density: one synthetic Amira and five seeded services are expected locally. Empty letters/follow-ups and unknown beds are not visual defects. Never invent activity, capacity, eligibility, or account identity to fill a screen.
5. The shelter ask requests no curfew yet recommends Harbour with an 11pm curfew. The Done design says services were not contacted while its paper trail describes a call. Resolve these contradictions rather than reproducing inconsistent facts.
6. Claude contains no dedicated standalone Follow-ups, Letters, intake, plans-picker, or five-stage workflow frames. Their final layouts require additional reference or a deliberate extension of this system.
7. The old visual-direction text prohibited glassmorphism, contradicting this request and the Claude reference. The updated visual section records the user's current direction; existing casework and evidence principles still apply.

## Proposed implementation order and acceptance

1. Case context, navigation, truthful states: F01/F04/F05/F06/F07/F08. Verify switching between two synthetic cases never leaks the previous case's plan/search/history. Reload persisted decisions; verify no action claims transmission without evidence.
2. Search and task entry: F02/F03 and selected composer variant. Verify keyboard/mouse selection, unmatched queries, client correction, cancellation, and meaningful destination.
3. Page structure: Today, clients, profile, plan, shelters, Working and Done, preserving supported backend operations.
4. Shared states and polish: match reference viewport, compare all variants, then verify narrow screens, tab order, dialog focus, visible focus, disabled controls and reduced motion.

Implementation will need focused tests for actual behavior changes; no application tests were added for this documentation-only audit.

## Manual review now

Open the existing [local preview](http://localhost:3000/today). Compare Today, People, the Amira profile, Shelters, Working and Done with their linked frames above. On Amira, inspect Quick exit and Open plan; in search/Spotlight, check real case matching and result activation. Treat mock Send/lock controls as demonstrations, not completed operations.

Record feedback against a finding ID or Figma node, describing expected action and retained styling. The original preview remains the baseline while this separate branch collects the agreed implementation scope. No deployment, schema, or UI changes are part of this audit.
