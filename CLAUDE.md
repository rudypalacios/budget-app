@AGENTS.md

# Project: Personal Budget App (React Native + Web)

## What this is
A personal budget management app, rebuilt from a single-file HTML/JS proof of concept
into a production React Native (Expo) app targeting iOS, Android, and Web from one
codebase. Full requirements live in `docs/SRS-presupuesto-app.md` — always check it
before implementing a feature, and treat it as the source of truth over anything
assumed here.

## Tech stack (locked decisions — do not change without asking)
- **Framework:** Expo (React Native), managed workflow
- **Web:** react-native-web, same codebase as mobile (see SRS NFR-5 for the one
  condition under which we'd reconsider this)
- **Backend/DB:** Firebase — Firestore for data, with offline persistence enabled as
  the local cache (no separate local DB). **SDK is platform-split** (Stage 3
  decision): `@react-native-firebase/firestore` on iOS/Android (full native
  persistent offline cache, survives app restart) + `firebase` JS SDK on web
  (IndexedDB persistent cache). The JS-SDK-only path was rejected because
  Firestore's persistent local cache doesn't support React Native — only an
  in-memory cache, which risks losing offline-entered data if the app is
  killed before reconnecting. This means **native dev requires a custom dev
  client, not Expo Go** — `expo prebuild` + `expo run:ios`/`expo run:android`
  (or EAS Build). `npm run web` still works standalone. Firestore access is
  behind a shared interface in `src/lib/firebase/` (`firestore.ts` native,
  `firestore.web.ts` web) — feature/store code should never import either
  SDK directly.
- **Auth:** Firebase Authentication — email/password (Stage 9a), Google
  (Stage 9b), Facebook (Stage 9c, not yet built). Google sign-in uses
  `@react-native-google-signin/google-signin` on native (the standard native
  sign-in sheet, matching the `@react-native-firebase/auth` pattern already
  used elsewhere) + `firebase/auth`'s `linkWithPopup`/`signInWithPopup` on
  web — same platform-split pattern as Firestore and the date picker. Needs
  a dev-client rebuild after this dependency was added (config plugin
  auto-registered in `app.json` by `expo install`). Requires a Google OAuth
  client registered in the Firebase Console (Authentication → Sign-in
  method → Google) plus an Android SHA-1 fingerprint added there — see
  `src/lib/firebase/auth.ts`'s `signInWithGoogle` for the account-joining
  implementation.
- **State management:** Zustand
- **Charts:** react-native-svg (Stage 5 decision) — the History line chart (FR-7) is
  drawn manually with `Svg`/`Path`/`Line`/`Circle` primitives in
  `src/components/ui/line-chart.tsx`, styled directly from theme tokens. Victory
  Native was passed over to avoid a heavier dependency with less direct control
  over styling and less certain react-native-web support.
- **Language:** TypeScript, strict mode
- **i18n:** structured translation files, Spanish + English at launch, extensible
- **Currency:** never hardcoded — always driven by user's default currency setting
  and per-record currency/exchange-rate fields (see SRS 6.7)
- **Date picker:** `@react-native-community/datetimepicker` (Stage 9a.1 decision) on
  iOS/Android — it does not support react-native-web, so web uses the browser's
  native `<input type="date">` instead. Both are behind a shared
  `src/components/ui/date-picker.tsx` (native) / `date-picker.web.tsx` (web)
  component, same platform-split pattern as Firestore — feature code should
  render `<DatePicker>` and never import the underlying library/DOM element
  directly. Needs a dev-client rebuild after this dependency was added (config
  plugin auto-registered in `app.json` by `expo install`).

## Folder structure conventions
Propose a structure before scaffolding if one doesn't exist yet, but default to
feature-based organization (not type-based) once the app has more than a couple of
screens, e.g.:

```
/app or /src
  /features
    /expenses
    /income
    /budget
    /history
    /auth
    /settings
  /components       (shared, generic UI components only)
  /lib              (firebase config, firestore converters, helpers)
  /store            (zustand stores)
  /localization
  /theme
```

Keep business logic (calculations, Firestore read/write, sync logic) out of components —
components should be presentation-focused, logic should live in hooks/store/lib so it's
testable and shared cleanly between native and web.

## Working process — read this before starting any task
- **One stage at a time.** Work is scoped to the numbered stages in
  `docs/SRS-presupuesto-app.md` section 11 (Build Stages). Don't implement ahead of
  the current stage even if it seems convenient — flag it instead and ask.
- **Plan before code for anything non-trivial.** Propose an implementation plan/diff
  outline first for review, especially for anything touching data model, Firestore
  schema, or security rules. Straightforward, well-specified tasks (e.g. "add this
  field to this form") can go straight to implementation.
- **Ask before:**
  - Adding a new dependency/package
  - Changing anything in the tech stack table above
  - Touching Firestore security rules
  - Changing the data model/schema once real data exists
  - Any decision the SRS doesn't clearly answer
- **Don't ask before:** routine scaffolding, boilerplate CRUD screens, standard
  refactors within an already-agreed structure, writing tests.

## Stage Closeout Checklist
Every stage's completion report must proactively confirm the following,
without being asked — not just narrate what was built:

1. **tsc/lint/tests results stated explicitly**, not implied (e.g. "`tsc
   --noEmit`: clean", "`npm run lint`: clean", "`npm test`: 19/19 passed" —
   not "everything checks out").
2. **Any deviation from the originally-approved plan, listed explicitly**,
   even if it seems minor — additions, drops, or changes in approach, not
   just what was ultimately built.
3. **All work merged to `develop` with a clean tree confirmed** (branch name
   + commit hash) — not left sitting on an unmerged branch presented as done.
4. **Any new external config** (Firestore indexes, security rules, API keys,
   service setup) **confirmed committed/deployable via a checked-in file**,
   not just "done" in a console somewhere.
5. **Known Issues updated** to reflect anything newly discovered or newly
   resolved this stage.

## Code style
- **Priority order when these trade off against each other: readability and
  maintainability > simplicity > cleverness/performance.** Optimize for
  someone unfamiliar with this codebase understanding it in 3 years, not for
  the fewest lines or the most elegant abstraction. If a simpler, slightly
  more verbose version is easier to follow than a clever one-liner, prefer
  the verbose one.
- Follow DRY, but don't force it — a little duplication is better than a
  premature or wrong abstraction. Don't extract a shared helper until the
  same logic actually appears 3+ times.
- Follow KISS — solve the problem actually in front of you, not the general
  case you can imagine needing later. No speculative flexibility, config
  options, or abstraction layers for requirements that don't exist yet.
- TypeScript strict mode, no `any` unless truly unavoidable (comment why if used)
- Functional components, hooks — no class components
- Prefer small, focused components and hooks over large files
- Comment *why*, not *what*, for anything non-obvious (e.g. why an exchange rate is
  stored at entry time rather than computed live — see SRS FR-16)

## Data integrity reminders (from SRS — easy to accidentally violate)
- Deleting a record never hard-deletes immediately — see SRS FR-4a/b/c (Archive → Trash
  → permanent purge with confirmation)
- Deleting/archiving/trashing a recurring definition must not delete its historical
  payment records (FR-4d), and must stop future regeneration (FR-4e)
- Exchange rates are stored per-record at time of entry, never recalculated
  retroactively (FR-16)
- Rolling budget average window is fixed at 6 months (FR-6a) — not user-configurable
- Income now mirrors expenses' paid/unpaid model (FR-5c) — `date` is the
  expected/due date, `paidDate` is when it was actually received; don't conflate
  the two (see `docs/data-model.md` §6)

## Testing strategy
Don't defer testing wholesale — split by volatility, not by "do it all at the end":

- **Write unit tests as you build**, alongside any pure business-logic function —
  these are cheap, stable, and don't churn when the UI changes later:
  - Rolling 6-month average / budget recommendation calc (FR-6a-6d)
  - Currency conversion and exchange-rate handling (FR-14-18)
  - Recurring date regeneration logic — monthly/biweekly/weekly (FR-2, FR-5b)
  - Archive/Trash state transitions — must not delete history, must stop
    regeneration (FR-4a-4e)
- **Test Firestore security rules early**, using the Firebase emulator — a rules
  bug is a security hole, not just an inconvenience, and is unreliable to verify
  by hand.
- **Defer component/UI tests and E2E tests** until the corresponding screens have
  stabilized — these churn heavily during active design/layout iteration, so writing
  them early wastes effort re-writing them as things change.

## Manual Verification Procedures
Steps that can't be automated in CI (real device, real app-kill) but need to
stay repeatable rather than re-derived from memory each time.

### Offline persistence survives an app kill (Stage 7/14)
Confirms NFR-1/FR-10/FR-11 hold under the specific failure mode the
platform-split SDK decision (see Tech stack, `@react-native-firebase/firestore`
vs. the web `firebase` JS SDK) exists to guard against: losing offline-entered
data if the app is killed before reconnecting.

Run on **both** native (dev client — `expo run:ios`/`expo run:android`, not
Expo Go) and web, since they use genuinely different persistent-cache
mechanisms:

1. Launch the app online, let it fully sync (indicator shows "Synced").
2. Turn off connectivity — airplane mode (native) or dev-tools "Offline"
   network throttling / disconnect Wi-Fi (web).
3. While offline, create or edit at least 2-3 records across different
   collections (e.g. add an expense, mark an income paid, edit a category).
   Confirm the sync-status indicator shows "Pending"/"Offline" and the data
   appears immediately in the UI (local-first read).
4. **Force-kill the app** — swipe away from the app switcher (native) or
   fully close the tab/browser process, not just navigate away (web).
5. Relaunch/reopen while still offline. Confirm every change from step 3 is
   still present — this is the step that actually exercises persistent vs.
   in-memory cache; if data from step 3 is missing here, offline durability
   is broken.
6. Restore connectivity. Confirm the indicator returns to "Synced" and the
   changes are now visible from a second, already-synced client (or the
   Firebase console) — proving they actually flushed, not just survived
   locally.

_Note: while testing this on web, you'll likely see a red "Could not reach
Cloud Firestore backend... operating in offline mode" toast — that's Expo's
dev-only LogBox overlay surfacing the Firestore SDK's own benign offline
log via `console.error`; it's expected, doesn't appear in production
builds, and isn't itself a failure._

## Git conventions
- One branch per SRS stage (or sub-task within a large stage)
- Commit messages reference the stage/FR number where relevant, e.g.
  `feat: implement archive/trash flow (Stage 11, FR-4a-4c)`
- No direct commits to `main` — even solo, work through branches so stages can be
  reviewed/reverted independently
- **Never merge a stage/task branch into `develop` automatically, even after
  tsc/lint/tests all pass.** Work stops at "committed to the stage branch,
  verified, ready for review" — merging into `develop` (and pushing that
  merge) is the user's call to make, every stage, no exceptions. Don't
  delete the source branch either. State the branch name + commit hash in
  the completion report and stop there.

## Known Issues
_(Gaps and deferred items that don't already have a home in the SRS §11 roadmap —
tracked here instead of only living in chat history. Remove an entry once it's
actually resolved.)_

- **Unexplained dual-currency miscalculation spotted on one historical
  record, not yet root-caused** (Stage 11 redesign review) — a Payments
  dashboard row showed `-€ 25,12 (Q 14.00)`, but the real EUR→GTQ rate at
  the time (~8.78) implies that conversion should read closer to
  `Q 220.55`. Traced the arithmetic in `formatCurrencyWithConversion`
  (`src/lib/format-currency.ts`) and `amountInDefaultCurrency` computation
  (`addExpense`/`setExpenseInstanceAt` in `src/store/expenses.ts`) and
  found no bug in either — both correctly multiply `amount *
  exchangeRateToDefault` using a rate captured via the (now-removed)
  inline per-transaction fetch/entry flow that existed before this
  stage's redesign. Most likely explanation: a manually-typed rate entered
  in the wrong direction/magnitude in that old inline UI, which the
  redesign's Settings-based, rate-visible-before-use flow should prevent
  going forward — but this wasn't confirmed, since the user explicitly
  asked not to investigate further this stage ("it could be that it
  wasn't saved properly, I'll review it later"). If it recurs under the
  new flow, that would point at a real remaining bug rather than a
  one-off bad manual entry.
- **Anonymous-to-existing-account linking is silent, no merge confirmation**
  (found during Stage 9b closeout, auditing `LoginScenarios.txt`) — when an
  anonymous session with local data tries to link a credential (email,
  Google, and Facebook once built) that already belongs to a **separate,
  pre-existing real account**, `signInWithGoogle`'s
  `auth/credential-already-in-use` fallback (`src/lib/firebase/auth.ts:93-96`,
  `auth.web.ts:92-97`) silently signs into that existing account with zero
  warning, abandoning the anonymous session's local data. The correct fix —
  a session-level "keep your data or start fresh?" prompt, with a real
  category-matching/id-remapping/idempotent-copy merge engine behind
  "keep your data" — is a data-migration problem, not a login-flow tweak,
  and is designed in full in `docs/auth-scenarios.md` §2 as a future
  **Account Data Merge** stage, scheduled once the app is more developed.
  This does *not* apply to the already-correct, unrelated flow where an
  **already-registered** account links a second provider via a
  password-confirmation prompt (`login.tsx:90-100`) — that flow is
  confirmed correct and unaffected.
- **No client-side password-strength validation on sign-up** (Stage 9b
  closeout) — `src/features/auth/use-auth-form.ts:36` only checks that a
  password was typed at all, relying entirely on Firebase's server-side
  `auth/weak-password` rejection. The user-facing message for that code
  (`src/lib/firebase/auth-errors.ts:7-8`, "Password must be at least 6
  characters") is a static assumption baked into the mapping, not derived
  from Firebase Console's actual configured policy, so it could drift if
  that policy ever changes.
- **No "sign in with Google instead" prompt when email/password sign-up
  conflicts with an existing Google-linked account** (Stage 9b closeout) —
  `signUpWithEmail` correctly throws `auth/email-already-in-use` and
  prevents a duplicate account, but the message shown
  (`auth-errors.ts:3-4`, "An account with this email already exists.") is
  generic rather than pointing the user at the provider they actually used.
  Contrast with the equivalent Google-sign-up-conflicts-with-email case,
  which already has a full password-confirmation linking flow
  (`login.tsx:90-100`) — this is the asymmetric, less-built direction of
  the same conflict.
- **Auth-bootstrap failure has no visible/distinct error state** (Stage 9b
  closeout) — `bootstrapSession`'s `status: 'error'` (`src/store/session.ts:42-44`)
  is only ever consumed by `useSyncStatus()` (`src/hooks/use-sync-status.ts:20,28`),
  which treats it identically to `'pending'`. If `ensureSignedIn()` ever
  fails (e.g. anonymous auth disabled server-side, or no network at all on
  first launch), the app would sit in a perpetual "pending" sync state with
  no uid and no explanation to the user.
- **No proactive offline check before an auth attempt** (Stage 9b
  closeout) — sign-in/sign-up/Google sign-in all rely on Firebase's own
  `auth/network-request-failed` rejection after the fact
  (`auth-errors.ts:19-20`) rather than checking `useNetworkStatus()`
  beforehand and short-circuiting with an immediate, clear message.
- **No token-expiry/re-authentication handling anywhere** (Stage 9b
  closeout) — no `reauthenticateWith*` call exists in the codebase. Moot
  today since no sensitive action (e.g. account deletion, which is
  explicitly out of scope per SRS §10) currently requires a freshly
  re-verified session; revisit if/when one is ever built.
- **Amount-field parsing still normalizes comma/period universally, not
  per-locale — a deliberate safety trade-off, not an oversight** (Stage
  9a.1, revisited at Stage 10 closeout) — `src/lib/currency-input.ts`'s
  `parseAmountInput` still treats a typed comma as an alternate decimal
  separator and converts it to a period before `Number()` parsing, exactly
  as before. Stage 10 added a real driving field (`UserSettings.language`,
  since this app has no separate region field — only `es`/`en`) and
  considered branching this function on it, but rejected the obvious
  approach (stripping "." as a thousands separator under `es`) because it
  would silently misparse a plainly-typed decimal like "12.34" as "1234" — a
  100x amount error — for any `es` user who simply uses a period, which
  `sanitizeAmountInput` already allows. True locale-aware grouping needs a
  real input mask constraining what can be typed, not a one-line parse
  change; revisit only as that dedicated feature. `formatCurrency`
  (`src/lib/format-currency.ts`) **is** now locale-aware for *output* only
  (which carries no such ambiguity, since the numeric value is already
  known) — but driven by the **currency being displayed**, not the app's UI
  language: each entry in `SUPPORTED_CURRENCIES`
  (`src/constants/currencies.ts`) carries its own fixed `formatLocale`
  (USD/GTQ → `'en'`-style comma-grouping/period-decimal; EUR → `'es'`-style
  period-grouping/comma-decimal), so a $ amount always reads "$1,234.56" and
  a € amount always reads "€1.234,56" regardless of whether the viewer has
  the app set to Spanish or English — found live (colleague feedback) that
  driving this off `i18n.language` instead made *every* currency flip to
  comma-decimal together whenever the UI was in Spanish, which is wrong: a
  currency's grouping convention isn't a property of the viewer's language.
  `i18n.language` is now only a fallback for a currency outside
  `SUPPORTED_CURRENCIES`, which has no known convention to anchor to.
- **`reminders`/`trashRetentionDays` now persist for real but stay
  functionally inert** (Stage 10; `theme` resolved — see
  fix/ux-polish-round-4 below) — the `users/{uid}` settings-doc store built
  this stage persists the entire Settings form on Save, including these
  fields (see CLAUDE.md's Settings Save scope decision), but nothing in the
  app actually reads them yet: no reminder-scheduling or trash-purge engine
  exists yet to consume `reminders`/`trashRetentionDays` (Stage 14 and the
  new Stage 17 respectively). Not a regression — before Stage 10 these were
  `useState` placeholders that didn't persist at all — but worth flagging
  since a user editing them in Settings now sees a value that *saves*
  successfully with no visible effect.
- **Web add/edit modal renders as full-page navigation, not a dialog overlay**
  — `presentation: 'modal'` (Stage 5) gives native a real slide-up/swipe-to-dismiss
  modal, but on web, `expo-router`'s Stack navigation replaces the page outright
  rather than layering a dialog over the previous screen (confirmed via DOM
  inspection — no `role="dialog"`/`aria-modal`, and the previous route isn't kept
  mounted underneath). Affects `expenses/new`, `expenses/[id]/edit`, `income/new`,
  `income/[id]/edit`, `categories/new`, `categories/[id]/edit`. **Likely
  symptom (Stage 8 browser testing):** opening a `Select`/`OverflowMenu`
  dropdown (both built on `FloatingPanel`, itself a `Modal`) on one of these
  full-page-navigation screens, then immediately submitting and opening a
  *second* one right after, occasionally leaves a stale full-screen
  `FloatingPanel` backdrop (`aria-label="Close menu"`) intercepting clicks
  on the new page — consistent with the previous route's `Modal` not
  tearing down cleanly across the non-overlay page transition. Not
  reliably reproduced by hand (only hit via fast scripted clicks), so
  filed here rather than as its own entry; worth a look whenever the
  overlay-modal primitive above gets built.
- **`eslint-plugin-react-native-a11y` not installed** (Stage 4) — its peer range
  caps at ESLint 8, conflicts with this project's ESLint 9 flat config.
  Accessibility props (`accessibilityRole`/`Label`/`State`) are applied by hand
  across `src/components/ui/*`, not lint-enforced.
- **Native bottom-tab-bar inset (`BottomTabInset` in theme.ts) unverified
  on-device** — added defensively so screen content doesn't render under the
  native tab bar on iOS/Android, but only the web top-bar inset (`TopBarInset`)
  fix has actually been screenshot-verified; native hasn't been checked on a
  simulator/device yet.
- **No "discard changes?" confirmation on form Cancel** (Expense/Income/Category
  forms) — deliberately deferred, not an oversight. `react-native-web`'s
  `Alert.alert()` is a literal no-op (`static alert() {}` —
  `node_modules/react-native-web/src/exports/Alert/index.js`), so a naive
  `Alert.alert()`-based confirm would silently discard unconditionally on web
  while showing a real dialog on native — inconsistent cross-platform behavior,
  worse than no confirmation at all. Needs a real custom confirm-dialog
  component to do properly, which is the same missing primitive as the web
  modal-overlay gap above — worth solving both together rather than building a
  one-off. **That primitive now exists** (`src/components/ui/dialog.tsx`'s
  `Dialog`, built for the Payments Dashboard's confirm-amount-on-mark-paid
  modal — post-Stage-13 review) — this entry stays open since
  discard-changes-on-Cancel itself still isn't built, but a future pass can
  compose it on top of `Dialog` instead of inventing the primitive from
  scratch.
- **Anonymous auth is per-device/per-browser-profile, no cross-device sync
  yet** (Stage 6) — `bootstrapSession` signs in anonymously with no linked
  credential, so each device/browser profile gets its own separate uid and
  therefore its own separate data; there is no shared account across devices
  until Stage 9 links a real credential (email/Google/Facebook) via
  `linkWithCredential`, at which point that one anonymous account's data
  carries over intact. Until then, FR-12 ("same account accessible from
  mobile and web") does not hold — data entered on one device/browser is
  invisible on any other. **Stage 9a is merged** (email/password half);
  **Stage 9b (Google) is built on its stage branch**, pending merge to
  `develop`. Facebook remains Stage 9c, blocked on Facebook Developer
  console setup.
- **No TTL policy enabled yet on `purgeAt`** (Stage 12; Trash screen shipped
  Stage 17, this gap is unchanged by it) — `trashX()` functions set a real
  `purgeAt` on every record they trash, but the Firestore TTL policy that
  would actually auto-delete once that timestamp passes (`docs/data-model.md`
  §13's deployment checklist) hasn't been enabled against the live
  `lighthouse-budget-app` project — that's a manual Google Cloud/Firebase
  Console action (no `gcloud`/`firebase` CLI available in this dev
  environment), held until explicitly confirmed by the user. Until enabled,
  trashed docs accumulate indefinitely instead of auto-expiring after
  `trashRetentionDays`; the Trash screen's manual "Delete permanently" is
  unaffected either way, since that's a direct `deleteDoc()`.
- **Swipe-to-navigate between tabs — raised in round-4 feedback, deliberately
  not built, follow up as its own stage/spike** — native tab navigation
  (`app-tabs.tsx`) uses `expo-router/unstable-native-tabs` (`NativeTabs`),
  which renders the actual OS tab bar controller (UITabBarController on iOS,
  native `BottomNavigationView` on Android), not a JS view. That has two
  consequences worth remembering before picking this up: (1) bottom tab bars
  are tap-only by platform convention on both iOS and Android — swipe-between-
  screens is the top-tabs/carousel pattern, not bottom nav, so this is a
  deliberate UX departure, not just a missing feature; (2) each tab's content
  lives in a separate native-controller-managed view hierarchy, not a shared
  pageable surface, so there's no existing "slide the content with your
  finger" surface to attach to. Two ways forward, neither trivial: (a) attach
  a swipe gesture to each screen's content (`react-native-gesture-handler`/
  `react-native-reanimated` are already dependencies, no new one needed) that
  calls `router.navigate` to the adjacent tab on release — cheap, but reads as
  a jump-cut tab switch, not a finger-follows-content slide; (b) replace
  `NativeTabs` on native with a pager-backed layout (e.g.
  `react-native-pager-view`) driving a custom bottom tab bar UI — gives a real
  sliding feel but is a new dependency (ask first, per the tech-stack table)
  and reverses the just-adopted genuine-native-tab-bar choice. Web explicitly
  doesn't need this — the user confirmed swipe only matters on mobile.
- **Recurring-groups UI doesn't extend to Income or History**
  (Stage 18 redo; narrowed by the `fix/expenses-tab-grouping` follow-up,
  which added full grouping — including drag-and-drop — to both Expenses
  tab sections) — the "Grupo…" row action, grouped-header display, and
  drag-to-group interaction now exist on the Payments Dashboard and both
  Expenses tab sections ("Una vez" and "Recurrentes"). Income stays out
  of grouping entirely, by explicit user decision ("normalmente no se
  agrupan, si se necesita, lo evaluamos"), and History still has no
  grouped view. A grouped expense created/edited from History is still
  fully correct (same document, same `recurringGroupId` field), it just
  isn't shown grouped there.
- **Dashboard's paid toggle is back to `Switch`, not `Checkbox`** (Stage 18
  redo) — the abandoned parent/child design's later live-review rounds had
  swapped this to a `Checkbox` (a deliberate visual preference, unrelated
  to the parent/child data model itself) and reworked the row layout
  around it. The full rollback restored the pre-Stage-18 `Switch`-based row
  along with everything else; whether to reapply the `Checkbox` swap on
  top of this redesign wasn't part of what the user asked for this round —
  flagged here rather than silently deciding either way.
- **Drag-and-drop grouping has no haptic feedback, no live sibling-row
  reflow while dragging, and is unverified end-to-end** (drag-and-drop
  grouping follow-up) — `expo-haptics` isn't installed and would be a new
  dependency, so the drag interaction is visual-only for now (highlight +
  lift + spring-back), not the vibration-on-hover Android's own folder
  gesture has; ask first if that's wanted. Sibling rows don't animate out
  of the way while something is being dragged over them — deliberately
  scoped out as the highest-effort/highest-risk-of-feeling-janky part of
  the original gesture description, to ship the core interaction first.
  More importantly: **this hasn't been exercised against real data at
  all** — the dev sandbox that built it has no real Firebase credentials
  to reach a live Dashboard with. `react-native-gesture-handler`'s `Pan`
  gesture on web via mouse pointer events specifically — the exact risk
  the from-scratch-vs-dependency decision was made to manage — has never
  actually been tried. Verify this before relying on it; see this
  feature's own summary above for the full manual test list. Applies
  equally to the Expenses tab's now-shared drag-and-drop
  (`fix/expenses-tab-grouping`) — same underlying gesture/animation code,
  same unverified status, same missing haptics/reflow.

## Current stage
_(Update this line as work progresses — tells Claude Code where we are without
re-explaining context each session.)_

`git log` on `develop` confirms Stages 9a–17 (through PR #26), round 3/4 UX
polish, the post-Stage-13 review, and the Budget tab's summary-card
restructure (PRs #27/#28) are all merged. 9c (Facebook sign-in) remains
blocked on Facebook Developer console setup — see SRS §11. This section's
older prose speculating about several of these being "pending merge" was
stale by the time Stage 18 started and is not reproduced here — see git
history directly if the exact PR-by-PR order ever matters.

**Stage 18 (Recurring groups) — first design abandoned, rebuilt from
scratch (2026-09-08).** Originally built as "one expense doubles as the
group parent" (`parentExpenseId`/`defaultParentRecurringExpenseId`, a
tri-state paid cascade, archive/trash cascade-or-detach) — went through
many rounds of live-review fixes and even briefly landed on `develop` via
a squash-merged PR #29 (whose title, "docs: plan Stage 18...", undersold
what it actually contained — the full implementation, not just docs).
The user then decided the whole concept didn't match how they think about
grouping ("no me gusta, hagamos revert") and asked for a real named
**recurring group** container instead — Netflix/Disney+/etc. as members
of e.g. "Suscripciones", not one bill secretly standing in for the group.

Handled as a full rollback, not a patch: the abandoned work is preserved
at branch `claude/stage-18-parent-child-abandoned` (tip `1511d98`) for
reference; `develop` itself got a revert commit (`44ee62a`, undoing
`f2ad444`/PR #29) since that squash-merge had put the abandoned code there
too, not just on the feature branch; this branch was then reset onto the
now-genuinely-clean `develop`. See `docs/data-model.md` §11's changelog
(v1.6/v1.7) for the schema-level before/after.

The replacement — a `recurringGroups/{id}` container holding no
amount/date/paid state of its own, with the Payments Dashboard deriving a
combined total and overdue/upcoming/completed placement from its current
members — is built and verified (`tsc`/lint/tests) on branch
`stage-18-recurring-groups` (re-pushed there from
`claude/expense-grouping-categories-bxu05n` once that branch name turned
out to still be associated with the closed/reverted PR #29 — see its own
summary below for why). **PR #30** is open from this branch into
`develop`, not merged — that's the user's call, per the standing
convention.

Two follow-up rounds landed on the same branch/PR after the user's first
live test: a real bug fix (`firestore.rules` had no block for the new
`recurringGroups` collection at all, so every group-create attempt was
silently denied) plus the recurring-groups admin screen the user asked
for — see the `fix/recurring-groups-admin-and-rules-bug` summary below.
Then a UX follow-up: drag-and-drop grouping (drag one expense onto another
to group them, Android-home-screen style, alongside the existing "Grupo…"
menu action) — see `fix/drag-and-drop-grouping` below. Then a scope
extension: the same drag-and-drop grouping now also works on the
Expenses tab's "Una vez" and "Recurrentes" sections, not just the
Dashboard — the drag/group core (`drag-drop-groups.ts`,
`use-row-drag-and-drop.ts`, `recurring-groups.ts`) was genericized over a
new `GroupableItem` structural type to support this without a third
copy-paste, per this project's own 3+-occurrences DRY convention — see
`fix/expenses-tab-grouping` below. **None of the admin screen, the
Dashboard drag-and-drop, or the Expenses-tab drag-and-drop has been
manually verified end-to-end** — this dev sandbox has no real Firebase
credentials to reach live data with; do that (see each summary's own test
list) before relying on any of them.

### Stage 10 summary
- New `users/{uid}` settings-doc store (`src/store/create-document-store.ts`
  + `user-settings.ts`) — Settings now has one real Save button persisting
  the whole form (see the Settings Save scope decision above), replacing
  the old `useState` placeholders.
- `i18next`/`react-i18next`/`expo-localization` added; `src/localization/`
  now holds real `en.json`/`es.json` covering every screen and shared
  component. Device locale is detected on first launch and overridden by
  the real persisted `UserSettings.language` once it loads.
- `defaultCurrency` now actually drives new-record creation (expenses,
  income, quick-expense, recurring definitions) instead of a hardcoded
  `'GTQ'`; changing it batch-marks every recurring expense's cached budget
  recommendation `'stale'` per `docs/data-model.md` §3 (new
  `FirestoreClient.batchUpdate`, implemented on both platforms).
- `formatCurrency` is now locale-aware for output, driven by each currency's
  own fixed convention (not the UI language — see Known Issues);
  `parseAmountInput` deliberately was not made locale-aware for input — see
  the Known Issues
  entry above for why.
- Added SRS §11 Stage 17 (Trash view & restore screen), per user feedback
  during this stage's planning — `trashRetentionDays` becoming a real
  setting surfaced that no stage yet owns the screen to actually use it.

A `LoginScenarios.txt` audit against 9b's implementation (2026-07-28)
found and fixed one native/web parity gap in `signInWithGoogle` (see
`src/lib/firebase/auth.ts`), and surfaced a real, deliberately-deferred
future stage — **Account Data Merge** — not yet numbered/scheduled, whose
full design lives in `docs/auth-scenarios.md` §2. See that file for the
complete scenario-by-scenario audit and the Facebook (9c) forward-looking
requirements it captured for later (§3).

### Stage 11 summary
- The `currency`/`exchangeRateToDefault`/`amountInDefaultCurrency`/
  `rateSource` schema was already fully designed back in Stage 6
  (`docs/data-model.md` §8) — this stage wired real values through every
  write path that previously hardcoded them (`// no multi-currency yet —
  Stage 10` comments across `src/store/expenses.ts`, `incomes.ts`,
  `recurring-expenses.ts`, `recurring-incomes.ts`).
- **Redesigned mid-stage after initial review**: currency setup moved out
  of the transaction forms entirely into a one-time-per-currency
  configuration step — new `users/{uid}/currencies/{code}` collection
  (`docs/data-model.md` §3a, `src/store/currencies.ts`) and a "Manage
  currencies" section in Settings (`src/app/currencies/`) where a
  currency is added once (pick it, fetch/enter its rate). Transaction
  forms (`ExpenseForm`/`IncomeForm`/`RecurringExpenseForm`/
  `RecurringIncomeForm`) then only ever offer a plain pick from that
  pre-configured list via new `src/components/amount-currency-field.tsx`
  — no rate entry/fetch UI per transaction at all, and the picker doesn't
  render when nothing's been configured yet. `CurrencyRateField`
  (currency `Select` + rate `TextField` + "Fetch rate" `Button`) still
  exists but is now exclusively the Settings add/refresh-rate building
  block. Rationale: most records are entered in the default currency, so
  asking for a currency + exchange rate on every entry was disproportionate
  friction for something used rarely.
- Changing `defaultCurrency` now also batch-marks every added currency
  `status: 'stale'` (`markCurrenciesStale`, `src/store/user-settings.ts`,
  mirroring the existing `budgetRecommendation.status` side effect) — a
  stale currency drops out of every transaction-form picker until
  refreshed from its Settings entry, since its rate is relative to the
  *old* default and would silently be wrong for the new one.
- `AmountCurrencyField` lays the amount field and currency picker out
  side by side on web above a new `FormRowBreakpoint` (480px,
  `src/constants/theme.ts`), stacked into a column below it — native is
  always narrower than that, so it always renders as a column with no
  platform-split file needed. Once a non-default currency is picked, the
  picker's own label shows its configured rate (e.g. `Currency (Q 8.78)`)
  via the existing `formatCurrency` convention.
- New `src/lib/exchange-rate.ts` — live-rate fetch via
  `open.er-api.com` (free, no API key), gated behind an explicit "Fetch
  rate" button and `useNetworkStatus()` (disabled offline); manual entry
  is always the field's default state either way (FR-17).
- `src/constants/currencies.ts` expanded from 3 to 15 currencies (added
  MXN, CAD, GBP, COP, ARS, CLP, PEN, BRL, DOP, HNL, CRC, PAB), each
  `formatLocale` verified against `Intl.NumberFormat` for that country's
  real grouping/decimal convention rather than assumed.
- New `formatCurrencyWithConversion` (`src/lib/format-currency.ts`) —
  dual-currency display (e.g. `$ 1.00 (Q 7.62)`) applied to History and
  Payments dashboard rows whenever a record's own currency differs from
  the default; reuses `formatCurrency`'s existing convention for both
  halves.
- Fixed one correctness gap this stage's mixed-currency data would
  otherwise have exposed: `budget.tsx`'s category-actual total now sums
  `amountInDefaultCurrency` and displays in the real `defaultCurrency`
  instead of summing raw `amount` under a hardcoded `'GTQ'` label. The
  "budgeted" side of that screen is still `sample-data.ts` — real
  budget-vs-actual wiring stays Stage 12/13's job. (A separate reported
  miscalculation on one specific historical record was flagged but
  deliberately not investigated this stage, at the user's request — see
  Known Issues.)
- `firestore.rules` gained a new `unchanged('currency')` lock on
  `expenses`/`incomes` update (paralleling the existing
  `exchangeRateToDefault` lock) — `currency` stays mutable on
  `recurringExpenses`/`recurringIncomes`, deliberately not locked there —
  plus a plain owner-only CRUD block for the new `currencies` collection.
  **Deployed to the live Firebase project** (`lighthouse-budget-app`) via
  `firebase deploy --only firestore:rules` — this stage's rules changes
  did not exist in production before that deploy.

### Stage 12 summary
- The `lifecycleState`/`trashedFromState`/`archivedAt`/`trashedAt`/
  `purgeAt` schema and its `firestore.rules` state-machine validation
  (`isValidLifecycleTransition` etc.) were already fully designed and
  deployed back at the data-modeling stage — every `add*`/`setAt` call
  already initialized these fields. This stage wired real
  archive/trash/restore/purge functions on top of that for the first time;
  **no `firestore.rules` changes were needed**.
- New `src/lib/lifecycle-transitions.ts` — pure state-machine math
  (`archiveTransition`/`trashTransition`/`restoreTransition`), unit tested
  in isolation, shared by four new store functions each in
  `expenses.ts`/`incomes.ts`/`recurring-expenses.ts`/
  `recurring-incomes.ts` (`archiveX`/`trashX`/`restoreX`/`purgeX`).
  `trashX` reads `trashRetentionDays` from `useUserSettingsStore` to
  compute `purgeAt`, mirroring the existing synchronous cross-store-read
  pattern in `user-settings.ts`'s `markBudgetRecommendationsStale`.
- **Scope decision, confirmed with the user during planning**: only
  Archive and Delete(→Trash) got UI this stage, added to every existing
  `OverflowMenu` (`expenses.tsx`/`income.tsx`'s recurring-definition and
  one-time rows, plus the Payments Dashboard's per-instance rows in
  `(tabs)/index.tsx`). Restore/Purge are engine + tests only — no UI —
  since SRS Stage 17 is explicitly where the cross-type browse/restore/
  purge screen lands. See Known Issues.
- **Fixed a real, previously-silent gap this stage's testing surfaced**:
  `createCollectionStore`'s `subscribe()` has no server-side query filter,
  so every store's `items` already contained every document ever created,
  unfiltered — before this stage, only `categories/index.tsx` and the two
  screens' recurring-definition sections filtered by `lifecycleState` at
  all. Archiving/trashing a record would have flipped its Firestore field
  with zero visible effect. Added `lifecycleState === 'active'` filtering
  to `expenses.tsx`/`income.tsx`'s one-time sections, `budget.tsx`'s
  category-actual total, and — centrally — `buildPaymentRows`
  (`src/lib/payments-dashboard.ts`), which both the Payments Dashboard and
  History already share, so both are covered by the one change.
- New minimal toast primitive (`src/store/toast.ts` +
  `src/components/ui/toast.tsx`, mounted once in `_layout.tsx`) gives
  Archive/Delete a visible confirmation ("moved to Archive"/"moved to
  Trash") now that a row simply disappearing from its list would otherwise
  be the only feedback. Deliberately a small custom store, not a toast
  library — see the user's explicit reasoning in this stage's planning
  session for why a dependency wasn't worth it here specifically.
- Extracted `toTimestamp` (previously duplicated across all four
  `expenses.ts`/`incomes.ts`/`recurring-expenses.ts`/
  `recurring-incomes.ts`) to `src/lib/timestamp.ts`; `expenses.ts`/
  `incomes.ts` re-export it unchanged so existing external imports
  (`expenses/[id]/edit.tsx`, `income/[id]/edit.tsx`) didn't need to change.
- **Firestore TTL policy on `purgeAt` intentionally not enabled yet** —
  see Known Issues. This is the one piece of this stage's originally
  planned scope not executed, pending the user's explicit go-ahead on a
  live production Console change.

### Stage 13 summary
- Two-part scope, confirmed with the user during planning: **Part A**
  (FR-6a-6d, the stage's literal title) — per-recurring-expense 6-month
  rolling average + accept/dismiss budget recommendations. **Part B**
  (general FR-6, folded in at the user's request after reviewing the
  plan) — real per-category budgeted amounts on the Budget tab, replacing
  the hardcoded `sampleBudgets` placeholder, plus a per-recurring-expense
  breakdown reachable from each category card, since the user pointed out
  a single category total can hide which specific bill actually drifted
  (e.g. "Services" masking that only the Electrical bill changed).
- **Part A**: new `src/lib/budget-recommendation.ts`
  (`computeBudgetRecommendation`, unit tested in isolation, same
  pure-function/store-wiring split as `lifecycle-transitions.ts`) plus
  three new `recurring-expenses.ts` store functions —
  `recomputeBudgetRecommendation` (queries the definition's last 6 paid
  instances per `docs/data-model.md` §9's spec), `acceptBudgetRecommendation`,
  `dismissBudgetRecommendation`. Recompute is triggered from
  `expenses.ts`'s `setExpensePaid`/`updateExpense`/`restoreExpense`
  (whenever the touched record is a recurring instance) and from
  `updateRecurringExpense` (when its own `amount` changes). A new
  `recomputeStaleBudgetRecommendations`, called on mount from both the
  Expenses and Budget tabs, resolves the bulk `status: 'stale'` write
  Stage 11 already made on `defaultCurrency` change into a real recompute
  (data-model.md §9's "re-evaluated at read time" requirement). New shared
  `src/components/budget-recommendation-badge.tsx` renders the
  accept/dismiss UI once, reused on both the Expenses tab row and the
  Budget tab's per-category breakdown (Part B) rather than duplicated.
  **Design decision**: `docs/data-model.md` §9's "lets a dismissal
  re-surface once the average drifts further" was underspecified —
  implemented as "stays dismissed unless the new average is farther from
  the budgeted amount than it was at the moment of dismissal," not simply
  "changed at all."
- **Part B**: new `Category.monthlyBudget: number | null` field
  (`src/types/firestore.ts`, `docs/data-model.md` §4) — manually set, but
  the category-edit form pre-fills it with a suggestion
  (`suggestCategoryMonthlyBudget` in `budget-recommendation.ts`: sum of
  that category's active recurring-expense amounts, converted to
  `defaultCurrency`) when unset. Deliberately not a live derivation —
  the user's stated goal was catching *total* real spend (recurring **and**
  one-time expenses combined) exceeding what they expect, which a
  recurring-only sum would undercount. `budget.tsx`'s existing
  `actualForCategory` already summed both kinds correctly and needed no
  change. New `src/components/category-budget-card.tsx` extracts each
  category card into its own component: a summary (budgeted/actual/
  over-budget) by default, with an in-place accordion (not a modal/dialog)
  revealing the per-recurring-expense breakdown on tap — the accordion
  choice deliberately avoids this codebase's documented, still-open web
  modal/dialog-overlay gap (see Known Issues) rather than building the
  missing primitive as a side effect of this stage.
- `sample-data.ts`'s `sampleBudgets`/`SampleBudgetLine` removed (nothing
  imports them anymore); `sampleMonthlyTotals` is untouched, still used by
  `history.tsx`'s FR-7 chart — a different, still-out-of-scope aggregate.
- `expenses.test.ts`/`recurring-expenses.test.ts` needed a new
  `jest.mock('@/store/session', ...)` (mirroring the existing
  `@/store/user-settings` mock already in both files) — `recomputeBudgetRecommendation`
  reads `useSessionStore`, and without the mock, loading it transitively
  pulled in the real `@react-native-firebase/app` native module, which
  Jest can't load. Also had to keep `expenses.ts`'s `restoreExpense`
  **not** `async` (chaining via `.then()` instead) despite adding an
  await-driven recompute after its write — an `async function`'s
  not-currently-trashed guard would otherwise throw as a rejected Promise
  instead of synchronously, breaking the existing
  `expect(() => restoreExpense(...)).toThrow()` test and crashing the
  Jest worker on the unhandled rejection.
- **Manually verified end-to-end against the live `lighthouse-budget-app`
  project** (`npm run web` + a scripted Playwright session, since the user
  confirmed the account had no real data yet and wanted a full DB reset
  afterward anyway — test records prefixed `ZZ_TEST*`, left in place for
  that planned reset rather than individually cleaned up). Confirmed
  working with zero console errors: creating a recurring expense shows no
  badge with no paid history; editing a generated instance's amount +
  marking it paid surfaces the recommendation chip with the correct
  rolling-average message; **Accept** updates the budgeted amount, clears
  the badge, and toasts; **Dismiss** leaves the amount untouched, clears
  the badge, and toasts; the Budget tab shows real per-category
  budgeted/actual/remaining totals (not `sampleBudgets`); the accordion
  expands to the correct per-recurring-expense breakdown with the same
  badge reused inline; the category-edit form's Monthly budget suggestion
  correctly tracks the recurring expense's current `amount` (50 before
  Accept, 150 after); the Add Category screen renders the new field
  cleanly with no regression.
- **This verification pass caught a real bug**: `recomputeBudgetRecommendation`'s
  query (`recurringExpenseId ==`, `paid ==`, `orderBy date`) had no
  matching Firestore composite index, so every call threw
  `failed-precondition` as an unhandled promise rejection — the
  recommendation engine would have silently never worked for any user.
  Fixed by adding the index to `firestore.indexes.json` (commit
  `3e3f52a`) and deploying it to the live project via
  `firebase deploy --only firestore:indexes`, run by the user after
  Claude Code's auto-mode classifier correctly blocked doing it
  autonomously (a live production-infrastructure change). Confirmed
  enabled in the Firebase console (3 indexes total) before re-verifying.

### fix/post-stage-13-review summary

Branch stacked on `stage-13-budget-recommendations` (not `develop` — item
7 depends on that branch's not-yet-merged `budget.tsx`/`Category.monthlyBudget`
work), per the user's explicit direction to keep this batch of fixes
separate rather than piling onto Stage 13 itself. Seven gaps found during
live review of Stage 13, spanning several already-shipped stages:

- **One-time expense/income date field relabeled** "Due date" → "Date"
  (`expenses.form.date`/`income.form.date`, `expense-form.tsx`/
  `income-form.tsx`) — a one-time entry can be past, present, or future
  (e.g. money borrowed to repay later), so "due" was misleading.
  **Bundled alongside**: `addExpense`/`addIncome` (`expenses.ts`/
  `incomes.ts`) now stamp `paidDate` from the entered `date` rather than
  `new Date()` when created already-paid — a retroactive log entry (e.g.
  "yesterday's coffee, already paid") should carry yesterday's paidDate,
  not today's. `setExpensePaid`/`setIncomeReceived` (the live toggle, on
  Dashboard and the two new tab toggles below) deliberately keep stamping
  "now" — that's a real-time action, not a backdated log.
- **"Payments" renamed "Dashboard"** (`nav.payments`, `payments.title`) —
  display-string only; internal identifiers (`payments-dashboard.ts`,
  `usePaymentsDashboard`, the `payments.*` i18n namespace itself) are
  unchanged, deliberately, to avoid pure-churn renames.
  Both native (`app-tabs.tsx`) and web (`app-tabs.web.tsx`) tab bars
  already drove off `nav.payments`, so no code changes were needed beyond
  the string values.
- **Recurring generation now includes the current month's occurrence even
  when its due day already passed** (`recurring-schedule.ts`'s
  `computeMonthlyOccurrenceDates`) — e.g. creating a due-day-1 recurring
  expense on the 2nd used to generate nothing until next month; it now
  generates immediately, showing as overdue. **This reverses a documented
  Stage 6b decision** (the removed guard, `if (occurrence >=
  normalizedStartDate)`, was explicitly locked in by a test named `'never
  generates an occurrence before startDate'`) — done per this session's
  explicit user request, not a bug that was silently patched; the test
  was renamed and its expectation flipped accordingly, with a comment
  explaining the reversal so a future reader doesn't mistake this for an
  accidental regression. Traced (not just patched) to confirm the fix is
  narrowly scoped: both affected branches (first-ever generation and the
  catch-up-from-`lastGeneratedDate` branch) only ever differed in this one
  edge case; removing the guard entirely was correct, not a partial fix.
- **Mark paid/received directly on the Expenses/Income tabs**, not just
  the Dashboard — added a `Switch` + status `Chip` to each one-time row in
  both tabs' "One-time" sections (recurring instances aren't listed
  individually on these screens, so nothing to add there). Reuses the
  exact same `setExpensePaid`/`setIncomeReceived` functions the Dashboard
  already calls — no new store logic. Since a row shown here is by
  definition still unpaid (the existing list filter already excludes paid
  ones), this is a simple always-off toggle: mark it paid, it disappears
  from the list on the next render, no new local state needed. Each
  screen's header comment was reframed from "config-only... lives
  exclusively on the Payments tab" to reflect this broadened (but still
  primarily planning-focused) scope.
- **Budget tab now relates income to expenses.** New "Income vs. Expenses"
  card (`budget.tsx`) showing money actually **received** this month
  (not expected/upcoming — confirmed with the user: this answers "do I
  literally have this much right now," not a projection) minus money
  actually **paid**, net colored green ("left to spend") or red
  ("overspent"). **Bundled alongside, confirmed with the user**: this
  also fixed a pre-existing, unrelated gap where `actualForCategory`/
  `totalActual` summed *all* paid expenses ever with no date filtering,
  despite the "this month" label — both the expense totals and the new
  income figure are now scoped to the current calendar month via
  `src/lib/cycle.ts`'s `getCurrentCycleRange()`/`isWithinCycle()` (already
  the established, tested utility for this — reused, not reinvented),
  keyed by **`paidDate`**, matching the same documented convention
  already used by `payments-dashboard.ts`'s `groupPaymentRows` ("a
  payment settled today for a 3-month-old bill belongs to *this* cycle").
  The per-recurring-expense 6-month rolling average (Stage 13) is
  deliberately left un-scoped — a separate, intentional multi-month
  calculation.
- **tsc/lint/tests**: all clean — `npx tsc --noEmit` clean, `npm run
  lint` clean, `npm test` 20/20 suites, 165/165 tests (one test renamed
  and its expectation flipped for the generation-logic reversal above; no
  new tests added for the tab-level paid/received toggles or the
  Dashboard rename, consistent with this project's testing strategy of
  deferring UI-level coverage and relying on manual verification instead).
- **Manually verified end-to-end on the live project** (same throwaway
  `ZZ_TEST*`-record approach as Stage 13, per the user's standing
  go-ahead) — confirmed all seven items working with zero console errors,
  including the paidDate-backdating fix (a coffee logged as "yesterday,
  already paid" correctly shows paidDate = yesterday on the Dashboard,
  not today) and the income-vs-expenses math (Q100 received − Q15 spent
  → "Q85.00 left to spend", correctly green).

### fix/ux-polish-round-4 summary

Branch stacked on `fix/ux-polish-round-3` (also still unmerged), per the
same keep-each-review-round-separate convention as
`fix/post-stage-13-review`. Five items from a live-review feedback round:

- **Real theme switching, finally wired** — resolves the "`theme` ...
  stays functionally inert" Known Issue. New `useResolvedColorScheme()`
  (`src/hooks/use-theme.ts`) is now the one place that combines
  `UserSettings.theme` with the OS scheme (`'light'`/`'dark'` pass
  through directly; `'system'` falls back to the existing
  `use-color-scheme.ts`/`.web.ts` OS hooks) — both `useTheme()` (drives
  `ThemedText`/`ThemedView` and every themed component) and
  `_layout.tsx`'s `expo-router` `ThemeProvider` (drives native
  navigation chrome) now read from it, where previously each read the raw
  OS scheme independently and neither ever looked at the saved setting.
- **Recurring-instance generation now re-runs without a full app
  relaunch** — resolves the "generation only runs on app launch" Known
  Issue (reported as: new-cycle recurring items only appeared after
  fully closing and reopening the app; pulling to refresh or switching
  tabs did nothing). `_layout.tsx` now also re-runs the same catch-up
  scan (`runRecurringGeneration`) on `AppState` foreground-resume and on
  network reconnect (via `useNetworkStatus`), and `usePullToRefresh`
  (`src/hooks/use-pull-to-refresh.ts`) gained an optional `onPull`
  callback, wired to `runRecurringGeneration` on the Dashboard, Expenses,
  Income, and History tabs — so pulling to refresh is now a real action
  on those screens, not the purely cosmetic affordance it was before.
  `runRecurringGeneration`'s existing idempotency (deterministic-ID
  `setAt` writes) and in-flight guard made this safe to re-trigger
  liberally without extra de-duplication logic.
- **Fixed the underlying offline-hang bug this same generation gap was
  compounding** — resolves the "Creating a new recurring expense/income
  while offline hangs the Save button indefinitely" Known Issue.
  `expenses/new.tsx`/`income/new.tsx`'s immediate-generation-on-create
  call (`generateExpenseInstancesForDefinition`/
  `generateIncomeInstancesForDefinition`) now only runs when
  `useNetworkStatus()` reports online, since its `getDocs()` call never
  resolves offline; skipping it while offline is safe now that the
  reconnect trigger above exists to pick up the missed instance as soon
  as the device is back online, instead of requiring a full relaunch.
- **History screen now groups by month with a collapsible accordion per
  month** (`(tabs)/history.tsx`'s new `HistoryMonthGroup`) — same
  chevron-rotate accordion idiom as `category-budget-card.tsx`'s
  per-category breakdown (Stage 13), applied here per-month instead. The
  most recent month starts expanded and every older month starts
  collapsed, so the list doesn't grow into one long undifferentiated
  scroll as new months regenerate — each collapsed month is still one tap
  away, not hidden.
- **Swipe-to-navigate between tabs was raised and deliberately not built
  this round** (mobile only — web doesn't need it) — see the Known Issues
  entry above for the full finding: native tabs render the genuine OS tab
  bar controller, not a JS view, which rules out a cheap fix and makes
  this a real architecture decision (fake jump-cut swipe on top of
  `NativeTabs` vs. a pager-backed replacement that needs a new dependency).
  Worth a dedicated stage/spike.
- **tsc/lint/tests**: all clean — `npx tsc --noEmit` clean, `npm run
  lint` clean, `npm test` 23/23 suites, 176/176 tests.
  `themed-text.test.tsx` needed a new `jest.mock('@/store/user-settings',
  ...)` (same transitive-native-module idiom as the Stage 13
  `@/store/session` mocks in `expenses.test.ts`/
  `recurring-expenses.test.ts`), since `ThemedText` → `useTheme()` now
  reads `useUserSettingsStore` as a hook.
- Not yet manually verified end-to-end on a device/browser against the
  live project (unlike Stage 13/round 2/round 3) — do that before
  merging, especially the offline-hang fix and the AppState
  foreground-resume trigger, which aren't practically exercisable by
  `tsc`/`jest` alone.

### Stage 17 summary

- **Two separate destinations, not tabs/filters in one screen** — new
  `src/app/archive/index.tsx` and `src/app/trash/index.tsx`, per the
  user's explicit Gmail-style-mailboxes direction during planning (a
  single-screen-with-tabs design was proposed first and rejected). Each is
  a flat list across every applicable record type, sorted newest-first,
  with a small type-badge `Chip` per row for organization rather than
  per-type sub-screens. Both are reached from Settings' existing "Data"
  section via two new manage rows (same `Pressable`→`Card` pattern as
  Categories/Currencies), not a new tab.
- New `src/lib/lifecycle-records.ts` (pure, unit-tested) —
  `collectArchivedRecords`/`collectTrashedRecords` do the cross-collection
  filtering (no new Firestore query/index needed — every store already
  streams all lifecycle states client-side, confirmed during planning
  research), `daysUntilPurge` backs the Trash screen's "N days until
  permanent deletion" line. New `src/store/lifecycle-actions.ts` dispatches
  restore/purge by `LifecycleRecordType` to the correct per-collection
  store function — kept in `store/`, not `lib/`, since it orchestrates
  other stores rather than being pure logic.
- Restoring a trashed record can land it back in **either** `active` or
  `archived` (whatever `trashedFromState` was) — UI/toast copy says
  "Restored", never assumes "restored to active". Restoring a recurring
  definition also immediately calls `runRecurringGeneration(uid)` (a real,
  previously-unhandled gap found during planning: `restoreRecurringExpense`/
  `restoreRecurringIncome` only flipped Firestore fields and would
  otherwise wait for the next app-foreground/launch/reconnect scan to
  backfill a missed period).
- Trash rows carry a confirm `Dialog` before permanent delete (composed
  the same way `confirm-amount-modal.tsx` already does) — the one
  genuinely destructive action in this stage, unlike the existing
  no-confirm Archive/Delete-to-trash actions elsewhere. Added a real
  `danger` variant to `src/components/ui/button.tsx` for this (reused by
  both the Trash screen and the new category-delete dialog below) rather
  than duplicating an inline style override in two places.
- **Categories gain a real permanent-delete action** — raised by the user
  during plan review, not part of the SRS line as originally read. Added
  to the Categories screen itself (not the new Archive/Trash screens,
  since Categories already owns Edit and the active/archived toggle), new
  `deleteCategory` in `src/store/categories.ts`, gated on
  `canDeleteCategory` (`lifecycle-records.ts`) finding **zero** references
  to the category across all four record collections and **every**
  lifecycle state — active, archived, and trashed-but-not-yet-purged all
  count as blockers, since a trashed-but-not-purged record is still
  historical data that needs a valid `categoryId` to point to. Categories
  themselves still have no trashed state at all (unchanged) — this is a
  real hard delete, gated entirely on the dependency check rather than
  going through any archive/trash lifecycle.
- Archive screen includes categories (restore-only, no purge button —
  none exists for that type); Trash screen deliberately excludes them
  entirely (`Category.lifecycleState` can't express 'trashed'). Categories
  have no `archivedAt` field at all, so the Archive screen falls back to
  `updatedAt` for "Archived on" — documented inline in
  `lifecycle-records.ts` since it's a real, if minor, precision gap (any
  future edit to an already-archived category would also bump this date).
- **tsc/lint/tests**: all clean — `npx tsc --noEmit` clean, `npm run lint`
  clean, `npm test` 24/24 suites, 187/187 tests (11 new, all in the new
  `lifecycle-records.test.ts`).
- Deviation from the approved plan: none beyond the category-delete
  feature itself, which was added *during* plan review (not after) at the
  user's request — the plan the user approved already included it.
- **Not yet manually verified end-to-end on a device/browser** — this
  stage is UI-heavy (two new screens, a new confirm-dialog flow, a new
  category-delete path) and none of that is exercised by `tsc`/`jest`
  alone. Do that before merging: archive/restore one of each type
  (including a recurring definition, to confirm generation actually
  resumes); trash/restore/purge an expense/income/recurring definition;
  attempt to delete a category that's still referenced (including only by
  an archived or trashed-but-not-purged record) and confirm it's blocked
  with the right count, then delete one with zero references.
- Firestore TTL policy on `purgeAt` is still not enabled in production —
  unchanged by this stage (see Known Issues); this screen's manual
  "Delete permanently" works regardless.
- Committed to branch `stage-17-trash-archive` (off `develop`), commit
  `a1ce047`, clean tree. Not merged — per the standing convention, that's
  the user's call.

### Stage 18 summary — Recurring groups (rebuilt design)

Second attempt at Stage 18, from scratch on a genuinely clean base — see
"Current stage" above for why the first design (one expense as group
parent) was abandoned and how the rollback was done (a real `git revert`
on `develop` itself, not just a reset of this feature branch, since the
abandoned design had briefly landed on `develop` via a squash-merged PR).

- **Schema**: new `users/{uid}/recurringGroups/{id}` collection
  (`src/types/firestore.ts`'s `RecurringGroup`) — `name` + the standard
  `TrashableLifecycle` fields only, no amount/date/paid state of its own
  (`docs/data-model.md` §11). `RecurringExpense` gained
  `recurringGroupId: string | null` (persistent default, inherited by
  every instance generated from it); `ExpenseRecordShared` (both
  `OneTimeExpense` and `RecurringExpenseInstance`) gained the same field
  directly, so a one-time expense or an already-generated instance can
  also be assigned/reassigned/cleared independently of its definition's
  default. No `firestore.rules` change — neither field is locked.
- **Store**: new `src/store/recurring-groups.ts` — plain CRUD + the same
  archive/trash/restore/purge lifecycle every other definition-like
  collection has, modeled directly on `recurring-incomes.ts` (the
  simplest existing example). No cascade logic anywhere — a group holds
  no state to cascade, which is the whole point of this redesign versus
  the abandoned parent/child model. New `setExpenseGroupId` in
  `expenses.ts` — a plain field update usable on either expense `kind`,
  since `recurringGroupId` is common to the `ExpenseRecord` union (unlike
  `skipped`/`skippedAt`, no cast needed).
- **Pure logic**: new `src/lib/recurring-groups.ts` —
  `computeGroupSubtotal` (sum of members' `amountInDefaultCurrency`),
  `groupBucket` (`'completed'` once every member is paid/skipped, else
  `'overdue'`/`'upcoming'` from its still-unpaid members — a partial
  payment leaves the group open, carrying its full membership rather than
  just the unpaid remainder), and `buildDashboardSections`, which runs
  after `payments-dashboard.ts`'s existing three-bucket grouping and folds
  each active group's members (gathered across all three buckets, since a
  partially-settled group can have members in more than one) into a
  single header entry. Unit tested in `recurring-groups.test.ts`.
- **Recurring generation**: `generateExpenseInstancesForDefinition` copies
  `recurringGroupId` straight from the definition onto each new instance —
  a direct copy, not the ID-synthesis trick the abandoned design needed
  (that existed only because its "parent" was itself a per-cycle
  instance; a `RecurringGroup` has one stable id forever).
- **UI**: `(tabs)/index.tsx`'s Dashboard renders one `Card` per group
  (name, member count, combined total, chevron-accordion revealing
  members — same expand/collapse idiom `category-budget-card.tsx` already
  established) alongside the existing plain-row cards for ungrouped
  entries; group members render with the exact same row markup as any
  other row (no visual nesting/connector work needed, since they're
  already contained inside the header's own accordion body). New shared
  `src/components/recurring-group-field.tsx` (a `Select` over active
  groups + inline "create new group" — used by `ExpenseForm`,
  `RecurringExpenseForm`, and a new `GroupPickerDialog` for the
  Dashboard's row-level "Grupo…" action) so the create-inline flow isn't
  built three times. Unlike the abandoned design, the group picker is
  wired into recurring-expense **creation**, not just edit
  (`ExpenseForm`'s `isRecurring` branch), since nothing about this model
  makes that harder.
- **tsc/lint/tests**: all clean — `npx tsc --noEmit` clean (the one
  pre-existing, unrelated `@/global.css` error, confirmed present on
  `develop` before this work), `npm run lint` clean, `npm test` 26/26
  suites, 207/207 tests (17 new, across `recurring-groups.test.ts` in both
  `src/lib/` and `src/store/`).
- Deliberately deferred, not silently dropped: no dedicated
  recurring-groups admin screen (rename/archive a group outside the
  create-inline flow) — see Known Issues. The Switch→Checkbox swap from
  the abandoned design's later live-review rounds was **not** carried
  forward (this rebuild restored the plain `Switch` from before that
  round) — flagged for the user to say whether they still want it
  reapplied on top of this redesign.
- **Not yet manually verified end-to-end on a device/browser** — do that
  before merging: create a group, add a recurring and a one-time expense
  to it, confirm the header's combined total and expand/collapse; mark
  one member paid (partial — header stays open) then the rest (header
  moves to completed); reassign/clear a member's group via "Grupo…";
  archive a member directly (no cascade prompt, unlike the abandoned
  design); confirm creating a new recurring expense with a group already
  shows it grouped on the Dashboard immediately.
- Committed to branch `claude/expense-grouping-categories-bxu05n` (off the
  reverted `develop`), clean tree — see git log for the commit hash.
  Re-pushed to a fresh branch, `stage-18-recurring-groups`, once the
  original branch name turned out to still be associated with PR #29
  (closed/merged, then reverted) — GitHub was showing that stale
  association, confusing for opening a new PR. **PR #30** opened from
  `stage-18-recurring-groups` into `develop`. Not merged — per the
  standing convention, that's the user's call.

### fix/recurring-groups-admin-and-rules-bug summary

Two items from the user's first live test of the branch above, both fixed
on the same `stage-18-recurring-groups` branch (pushed as a follow-up
commit to PR #30, not a separate branch):

- **Real bug found: `firestore.rules` had no block for the new
  `recurringGroups` collection at all** — every other collection
  (`recurringExpenses`, `currencies`, etc.) has one, but it was missed
  when this stage was built. Firestore denies reads/writes by default with
  no matching rule, so `addRecurringGroup` was throwing
  `permission-denied` on every attempt — this is what the user hit
  ("wasn't able to save the groups... didn't close"). Added a
  `recurringGroups/{id}` block mirroring `recurringExpenses`'s exactly
  (owner-only + the same `isValidNewLifecycle`/`isValidLifecycleTransition`
  state-machine checks) — no new validation logic needed, since
  `RecurringGroup` has no snapshot fields to lock the way `expenses`/
  `incomes` do. **Not yet deployed** to the live `lighthouse-budget-app`
  project — same as every prior rules change in this repo's history, that
  deploy (`firebase deploy --only firestore:rules`) is a manual step for
  the user to run, no `firebase` CLI available in this dev environment.
- **Real gap found alongside it: `RecurringGroupField`'s inline
  "create new group" flow had no error handling** — `handleCreate` awaited
  `addRecurringGroup` with no try/catch, so a rejected promise (this
  permission error, or any future failure) left `isCreating` stuck `true`
  forever with zero feedback — exactly the "didn't close" symptom, and it
  would have silently done the same for any other write failure even
  after the rules fix. Now wrapped in try/catch with a toast
  (`recurringGroups.createFailed`) and an `isSaving` guard disabling both
  buttons mid-request.
- **The actual "where do I manage groups" ask**: new
  `src/app/recurring-groups/index.tsx` — same active/archived-toggle +
  permanent-delete-confirm-`Dialog` pattern `categories/index.tsx` already
  established, plus inline rename via a second `Dialog`. `RecurringGroup`
  carries a real `'trashed'` state (unlike `Category`), but this screen
  deliberately doesn't expose it as its own step — "Delete permanently"
  calls `trashRecurringGroup` then `purgeRecurringGroup` in one action,
  since `firestore.rules` only allows purge from `'trashed'`; from the
  user's side it's a single confirm. Deleting a group never touches its
  members' own `recurringGroupId` — a member pointing at a since-deleted
  group id simply isn't in `buildDashboardSections`' `activeGroups` list,
  so it silently renders as a plain ungrouped row, same as an
  archived/trashed group's members already do (`src/lib/recurring-groups.ts`).
  Reached from a new "Recurring groups" section in Settings, same
  `Pressable`→`Card` row as Categories/Currencies.
- **tsc/lint/tests**: all clean — `npx tsc --noEmit` clean (the one
  pre-existing, unrelated `@/global.css` error), `npm run lint` clean,
  `npm test` 26/26 suites, 208/208 tests (unchanged — no new tests this
  round; the admin screen follows the existing convention of deferring
  UI-level coverage to manual verification, matching every other
  `*/index.tsx` admin screen in this codebase, none of which have a test
  file).
- **Still not manually verified end-to-end in a browser** — the rules fix
  in particular can't be confirmed working from `tsc`/`jest` alone, since
  it's Firestore's own server-side enforcement; needs the rules deploy
  above plus an actual create-a-group attempt against the live project.

### fix/drag-and-drop-grouping summary

Android-home-screen-style shortcut for the same grouping feature: drag one
expense row onto another to group them, instead of only via the "Grupo…"
menu picker (which stays, unchanged, as the non-drag path).

- **Dependency decision, researched not guessed**: SortableJS is DOM-only
  (no RN native support) — rejected outright, would only ever cover web.
  Searched current RN drag-and-drop options; the closest fit
  (`react-native-reanimated-dnd`, has real drop-to-merge collision
  detection) has no confirmed `react-native-web` support in its docs — a
  real risk for an app that must behave the same on both. **Built from
  scratch on `react-native-gesture-handler` + `react-native-reanimated`
  instead — zero new dependencies** (both were already in `package.json`
  but, confirmed via `grep`, genuinely unused anywhere until this round;
  `src/app/_layout.tsx` now wraps the navigator in
  `GestureHandlerRootView` for the first time, required for gestures to
  register at all, especially on Android).
- **Pure logic, unit-tested**: new `src/lib/drag-drop-groups.ts` —
  `resolveDropAction` (drop-target → what happens: `createGroup`,
  `assignToGroup`, `clearGroup`, or `noop`; simplified during design so
  every action only ever mutates the *dragged* row's own
  `recurringGroupId`, never the target's — dragging a grouped row onto an
  ungrouped one always forms a fresh group with the target rather than
  also reassigning the target), `suggestGroupName` (shared category name,
  or `null` for the caller's translated fallback), `findRowUnderPoint`
  (plain point-in-rect collision, no gesture library needed to test it).
- **Gesture orchestration**: new `src/hooks/use-row-drag-and-drop.ts` owns
  the bounds registry (every draggable row/group-header registers its
  measured on-screen rect via `onLayout`/`measureInWindow`, same idiom
  `Select`'s `FloatingPanel` anchoring already used) and the dragged row's
  shared values — but never calls a store function itself; it hands the
  resolved `DropAction` back to the Dashboard screen, which owns the
  actual `setExpenseGroupId`/`addRecurringGroup` calls and the
  create-group name-confirmation dialog. New `src/components/ui/drag-handle.tsx`
  (small grip icon + its own `Gesture.Pan()`) is the confirmed-with-the-user
  UX choice — an explicit handle on **both** web and native, not
  long-press-anywhere like Android's icons, since mouse long-press fights
  with text-selection/scroll on web.
- **`(tabs)/index.tsx`'s rows became real components** (`PaymentRowItem`,
  `GroupHeaderRow`), extracted out of the previous plain render-function
  closures — required, not optional: `useAnimatedStyle`/`useSharedValue`
  can't be called from inside a `.map()` callback (Rules of Hooks). Drop
  semantics confirmed with the user: drop on an ungrouped row → new group,
  name confirmed via a dialog first (new shared
  `src/components/ui/group-name-dialog.tsx`, also used to refactor
  `recurring-groups/index.tsx`'s existing rename dialog onto the same
  component — same shape, now its 2nd/3rd occurrence); drop on any grouped
  row or a group's header → joins directly, no dialog; drop outside any
  target while already grouped → leaves the group; everything else is a
  no-op. No live reflow of sibling rows while dragging, and no haptics
  (`expo-haptics` isn't installed and would be a new dependency) —
  deliberately scoped out of this first pass, not silently dropped; see
  Known Issues.
- **tsc/lint/tests**: all clean — `npx tsc --noEmit` clean (the one
  pre-existing, unrelated `@/global.css` error), `npm run lint` clean,
  `npm test` 27/27 suites, 227/227 tests (19 new, all in
  `drag-drop-groups.test.ts` — the pure logic; the gesture/animation code
  itself has no automated coverage, consistent with this project's
  established convention).
- **Could not manually verify end-to-end in this session** — attempted via
  `npm run web` + a Playwright driver script; the dev server bundled this
  code successfully with zero Metro/bundler errors (1556+ modules,
  confirming no syntax/import/type issue reaches runtime), but this dev
  environment has no real Firebase project credentials (`.env` only has
  `.env.example`'s placeholders), so the app can't get past
  `auth/invalid-api-key` to reach real synced data to actually drag. Real
  verification needs to happen against a deployed preview or a local dev
  environment with real credentials, same as this project's standing
  practice for every prior UI-heavy stage. **Do this before merging** —
  drag an ungrouped expense onto another (name dialog appears, confirm →
  both grouped), drag a third onto the new group's header (joins, no
  dialog), drag a member out of an expanded group onto the plain list
  (removed), drag a member from one group onto a different group's header
  (moved), and confirm a normal (non-drag) interaction — toggling a row's
  paid `Switch` — still works with no regression. Test on **both** web and
  native if at all possible: web pointer-event behavior for
  `react-native-gesture-handler`'s `Pan` gesture is the specific risk this
  whole dependency decision was made to manage, and it has never
  actually been exercised.

### fix/expenses-tab-grouping summary

Extends the same drag-and-drop grouping mechanism to the Expenses tab —
raised by the user after the Dashboard round shipped ("this is something
that should also be available for expenses and income, not just for the
dashboard"). Scope, confirmed via clarifying questions:

- **Income stays out of grouping entirely** ("Omitamos el income por el
  momento, basado en el punto de que normalmente no se agrupan") — nothing
  in this round touches `incomes`/`recurringIncomes`.
- **Both** Expenses-tab sections get full drag-and-drop, not just "Una
  vez" — the user explicitly rejected a first draft that left
  "Recurrentes" untouched ("Recurrentes should be able to group too"),
  then confirmed via a follow-up question: "Drag-and-drop completo, igual
  que 'Una vez'/Dashboard".
- **The "does a recurring group replicate each cycle?" concern turned out
  to already be solved, not a new gap** — confirmed in detail by the
  user's own explanation: a recurring definition's own `recurringGroupId`
  (set via its form's "Grupo" field, or now this tab's drag UI) already
  copies onto every instance `generateExpenseInstancesForDefinition`
  generates, each cycle, automatically (built in the original Stage 18
  rebuild). An instance's (or one-time expense's) own `recurringGroupId`,
  set ad hoc via drag/picker, is a separate, visualization-only override
  that never writes back to the definition — "el grupo es justamente
  esto, una utilidad de visualización a nivel de UI." No code change was
  needed for this part; it already worked as intended.

**Why generalized, not copy-pasted a third time**: a "Recurrentes" row is
a `RecurringExpense` *definition* — no `paid`/`date`/`skipped` (a
definition is never itself "paid"; only its generated instances are), so
it can't reuse the Dashboard's row component as-is, and its group
subtotal means something different ("this group's combined monthly
amount," not a per-cycle actual/expected total). But the actual grouping
*mechanics* — collision detection, drop resolution, subtotal math — only
ever touch four fields (`id`, `categoryId`, `amountInDefaultCurrency`,
`recurringGroupId`), identical in shape across `PaymentRow` and a
definition. With three call sites now needing this (Dashboard, "Una vez",
"Recurrentes"), this crosses this project's own "don't extract until 3+
occurrences" DRY line for real.

- **`src/lib/drag-drop-groups.ts`**: introduced `GroupableItem` (the
  four-field structural type above); `resolveDropAction`/`DropTarget`/
  `suggestGroupName` are now generic over `T extends GroupableItem`.
  Dropped the old `row.direction !== 'expense'` guard from
  `resolveDropAction` — moved to registration time instead (see
  `DraggableRowContainer` below): a row is only ever registered as a drop
  target if it's already known to be groupable, so the resolver no longer
  re-checks. `drag-drop-groups.test.ts` gained a `RecurringExpense`-shaped
  fixture and four new cases proving the generic holds for a second,
  structurally different type; the old income-guard test was removed
  (the behavior it checked moved, and is now covered by registration-time
  tests instead — see below).
- **`src/hooks/use-row-drag-and-drop.ts`**: `useRowDragAndDrop<T extends
  GroupableItem>` — same hook, generic over `T` throughout (bounds
  registry, dragged-row ref/shared-value, `onDropResolved` callback type).
  No behavior change for the Dashboard's existing `PaymentRow` usage.
- **`src/lib/recurring-groups.ts`**: `GroupSection<T>` is now generic;
  `DashboardBucket`/`buildDashboardSections` stay `PaymentRow`-specific —
  the three-bucket (overdue/upcoming/completed) concept only makes sense
  for actual payment rows, not a definition that's never "paid." New
  `groupRowsIntoSections<T extends GroupableItem>` — the single-list
  equivalent the Expenses tab's flat sections use — shares its
  gather-members-by-group-id loop with `buildDashboardSections` via one
  new internal helper (`gatherMembersByGroupId`) so that part isn't
  duplicated either.
- **New `src/components/draggable-row-container.tsx`** —
  `DraggableRowContainer<T extends GroupableItem>`: the drag-registration/
  lift-animation/`DragHandle` shell, extracted out of the Dashboard's
  previously-inline `PaymentRowItem`. Takes a `groupable: boolean` prop
  (the old `row.direction === 'expense'` condition, generalized) that
  governs *both* whether the drag handle renders and whether the row
  registers as a drop target at all — this is where the
  no-longer-in-`resolveDropAction` guard now lives. `PaymentRowItem`
  (extracted to `src/components/payment-row-item.tsx`) and
  `GroupHeaderRow` (extracted to `src/components/group-header-row.tsx`,
  now generic over `T`) both moved out of `(tabs)/index.tsx` into shared
  files so the Expenses tab can render identical markup.
- **New `src/components/recurring-definition-row-item.tsx`** —
  `RecurringDefinitionRowItem`, the "Recurrentes" row content (name, due
  day, amount, `BudgetRecommendationBadge`, its existing Edit/Archive/
  Delete `OverflowMenu` plus a new "Grupo…" item), wrapped in the same
  `DraggableRowContainer`. Also exports `GroupableRecurringExpense` (a
  `WithId<RecurringExpense>` plus a computed
  `amountInDefaultCurrency: amount * exchangeRateToDefault` field — no
  separate adapter class, just an inline computed field) and
  `toGroupableRecurringExpense`, both reused by `expenses.tsx`.
- **New `src/hooks/use-group-drag-orchestration.ts`** —
  `useGroupDragOrchestration<T extends GroupableItem & { name: string }>`:
  the drop-resolved → assign/clear-directly-or-open-name-dialog glue,
  previously wired by hand in `(tabs)/index.tsx`, now shared by all three
  call sites. Parameterized by two screen-supplied callbacks
  (`assignGroup(id, groupId)`, `createGroupAndAssign(name, aId, bId)`) so
  the hook itself never calls a store function directly, matching
  `use-row-drag-and-drop.ts`'s existing "orchestration knows nothing about
  Firestore" split.
- **`(tabs)/index.tsx`**: rewritten to use the new shared
  `PaymentRowItem`/`GroupHeaderRow`/`useGroupDragOrchestration` instead of
  its previous local definitions — verified behavior-identical (full
  tsc/lint/test pass, same drop semantics) before moving on, so the
  extraction itself carried no functional risk into the two new call
  sites.
- **`(tabs)/expenses.tsx`**: both sections rewired.
  - **"Una vez"**: one-time expenses now go through the new
    `expenseToPaymentRow` (factored out of `payments-dashboard.ts`'s
    `buildPaymentRows`, which now calls it too — one mapping, not two) +
    `groupRowsIntoSections` + its own `useGroupDragOrchestration`
    (`assignGroup` = `setExpenseGroupId`, `createGroupAndAssign` =
    `addRecurringGroup` + two `setExpenseGroupId` calls) + a new "Grupo…"
    `OverflowMenu` item + the existing `GroupPickerDialog`. **Side effect,
    not separately requested**: reusing `PaymentRowItem` upgrades this
    section's amount display from plain `formatCurrency` to
    `formatCurrencyWithConversion` (shows the default-currency equivalent
    when a row's own currency differs), matching the Dashboard — a
    natural consequence of sharing the component.
  - **"Recurrentes"**: each active definition wrapped via
    `toGroupableRecurringExpense` + `groupRowsIntoSections` + its own
    `useGroupDragOrchestration` (`assignGroup` = `updateRecurringExpense(id,
    { recurringGroupId })`, already existed — no new store function;
    `createGroupAndAssign` = `addRecurringGroup` + two
    `updateRecurringExpense` calls) + a new "Grupo…" `OverflowMenu` item.
    Group header's subtotal is the group's combined *monthly amount*
    (each member's `amount * exchangeRateToDefault`), not a per-cycle
    actual — a real difference from the Dashboard's group subtotal,
    documented inline in `recurring-definition-row-item.tsx`.
  - Both sections' create-group name dialogs and "Grupo…" pickers are
    fully independent per section (separate `useGroupDragOrchestration`
    instances) — grouping a one-time expense and grouping a recurring
    definition are unrelated actions that happen to share a
    `recurringGroups` collection and UI pattern, not a single combined
    flow.
- **tsc/lint/tests**: all clean — `npx tsc --noEmit` clean, `npm run
  lint` clean, `npm test` 27/27 suites, 230/230 tests (3 new, in the
  genericized `drag-drop-groups.test.ts`; no new tests for the
  Expenses-tab wiring itself or the extracted components, consistent with
  this project's convention of deferring UI-level coverage to manual
  verification).
- **Could not manually verify end-to-end in this session** — same
  no-real-Firebase-credentials limitation as the prior drag-and-drop
  round (`.env` only has `.env.example` placeholders). **Do this before
  merging**, on both the Expenses tab's "Una vez" and "Recurrentes"
  sections, on both web and native: drag two ungrouped rows together
  (name dialog → both grouped), drag a third onto the new group's header
  (joins, no dialog), drag a member out of an expanded group (removed),
  drag a member from one group onto a different group's header (moved);
  confirm a "Recurrentes" definition grouped this way shows its
  next-generated instance already grouped on the Dashboard with no extra
  step (the "replication" behavior confirmed to already work, per above);
  confirm the "Grupo…" menu picker still works as the non-drag path on
  both sections; confirm the Dashboard itself is unchanged after the
  `PaymentRowItem`/`GroupHeaderRow` extraction (paid toggle, skip, archive/
  delete, existing drag-and-drop all still behave identically).
