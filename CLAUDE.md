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
- **Amount-field parsing normalizes comma/period universally, not per-locale**
  (Stage 9a.1) — `src/lib/currency-input.ts`'s `parseAmountInput` treats a
  typed comma as an alternate decimal separator and converts it to a period
  before `Number()` parsing, so both "12.34" and "12,34" work as valid
  decimal entry today. This is a simple universal normalization, not real
  locale-aware masking (e.g. it doesn't distinguish a thousands-grouping
  comma from a decimal comma, and can't yet, since there's no per-user
  region/locale setting to disambiguate against). Revisit once Stage 10
  (Localization) adds a region setting to Settings — at that point the input
  mask and `formatCurrency` (`src/lib/format-currency.ts`, which has the same
  "revisit for richer locale formatting" note) should both read from it, and
  ideally share one centralized parse/format pair driven by the user's
  region rather than each guessing independently.
- **Creating a new recurring expense/income while offline hangs the Save
  button indefinitely** (found in Stage 7 sync validation) — `expenses/new.tsx`
  and `income/new.tsx`'s recurring branch calls
  `generateExpenseInstancesForDefinition`/`generateIncomeInstancesForDefinition`
  immediately after creating the definition, so that period's instance
  appears without waiting for the next launch's catch-up scan. That
  generation call's first step, `getLastExpenseInstanceDate`/
  `getLastIncomeInstanceDate` (`src/store/expenses.ts`,
  `src/store/incomes.ts`), is a one-shot `getDocs()` query — reproduced live
  (Playwright, web build): while offline, this query never resolves (not
  even a fast rejection), so the async `handleSubmit` never finishes, and
  the Save button (with its Stage 6b-colleague-feedback pending/spinner
  state) spins forever with no error shown to the user. The underlying
  `addRecurringExpense`/`addRecurringIncome` write itself isn't lost — it's
  sitting in Firestore's offline queue like any other write and does flush
  once reconnected (confirmed: the definition appears correctly after
  reconnecting) — but the user gets no feedback and can't back out cleanly
  while offline. Contrast with **editing** an existing recurring
  expense/income while offline, which works correctly (no `getDocs()` in
  that path) — this is specifically the immediate-generation-on-create step.
  Not fixed as part of Stage 7 (a validation stage, not meant to carry new
  behavior changes) — needs its own small fix (e.g. skip/timeout the
  immediate-generation attempt when offline and let the next launch's
  catch-up scan pick it up instead) in a later stage.
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
  one-off. Revisit once that primitive exists.
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
- **`users/{uid}` settings-doc store deferred to Stage 10** (Stage 6) — the
  approved Stage 6 plan included a `createDocumentStore` for `UserSettings`
  alongside the collection stores; deliberately cut instead, since
  `settings.tsx` still uses local `useState` placeholders (no real consumer
  exists until Stage 10 wires localization/default-currency to it) and Stage 10
  is already the roadmap's named home for this data. Not a silent cut this
  time — flagged and confirmed before proceeding. **Decision for when Stage 10
  builds this store** (colleague feedback review, Stage 6b): Settings follows
  the same explicit Save-button pattern as Expenses/Income/Categories — apply
  and persist on Save, not autosave-on-change, and no separate "pending sync"
  state. Use the shared `Button` component's built-in pending/disabled state
  (see `src/components/ui/button.tsx`) rather than inventing a new pattern.
- **Recurring-instance generation only runs on app launch, not on
  foreground-resume** (Stage 6b) — matches data-model.md §9's literal "On
  app launch, the generator scans..." wording, but `AppState`-based
  foreground-resume triggering isn't wired. If a user leaves the app running
  in the background across a month boundary without a fresh launch, that
  period's instance won't appear until the next cold start. Cheap follow-up
  if this turns out to matter in practice — not implemented preemptively.
- **`amountInDefaultCurrency` isn't recomputed when `amount` is edited**
  (pre-existing since Stage 6, newly reachable in Stage 6b) — editing an
  expense/income's `amount` via `updateExpense`/`updateIncome` never
  recalculates `amountInDefaultCurrency` (`amount * exchangeRateToDefault`),
  so it goes stale after any edit. Applied equally to one-time records since
  Stage 6; Stage 6b's generated `RecurringExpenseInstance` docs additionally
  snapshot `amountInDefaultCurrency` to the *budgeted* amount at generation
  time (since `amount` is null until paid — data-model.md §6), which is
  never corrected once a real `amount` is set either. Not user-visible yet
  (Budget/History screens read `amount` directly, not
  `amountInDefaultCurrency` — see `src/app/(tabs)/index.tsx`), but will need
  fixing before Stage 11 (multi-currency) or any feature that aggregates via
  `amountInDefaultCurrency` instead of `amount`.
- **No archive/trash UI for recurring definitions yet** (Stage 6b) — the
  "Recurring" section on the Expenses/Income tabs (`src/app/(tabs)/expenses.tsx`,
  `income.tsx` — folded in from the old standalone `/recurring-expenses`,
  `/recurring-incomes` management screens as part of the Stage 8.1 Add/Manage
  consolidation) only ever shows `lifecycleState: 'active'` definitions;
  archiving is Stage 12's job. The generation engine
  (`src/store/recurring-generation.ts`) already filters
  `lifecycleState === 'active'` per FR-4e, so archiving will correctly stop
  regeneration as soon as that UI exists — nothing to change in the
  generation logic itself when Stage 12 lands.

## Current stage
_(Update this line as work progresses — tells Claude Code where we are without
re-explaining context each session.)_

Stage: **9b — Google sign-in** (9a and 9a.1 are merged; 9b is built and
verified on branch `stage-9b-google-signin`, pending merge to `develop`;
9c remains blocked on Facebook Developer console setup — see SRS §11).
Stage 10 (localization + default currency) is planned and ready to resume
once 9b is merged.

A `LoginScenarios.txt` audit against 9b's implementation (2026-07-28)
found and fixed one native/web parity gap in `signInWithGoogle` (see
`src/lib/firebase/auth.ts`), and surfaced a real, deliberately-deferred
future stage — **Account Data Merge** — not yet numbered/scheduled, whose
full design lives in `docs/auth-scenarios.md` §2. See that file for the
complete scenario-by-scenario audit and the Facebook (9c) forward-looking
requirements it captured for later (§3).
