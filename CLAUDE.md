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
- **`theme`/`reminders`/`trashRetentionDays` now persist for real but stay
  functionally inert** (Stage 10) — the `users/{uid}` settings-doc store
  built this stage persists the entire Settings form on Save, including
  these three fields (see CLAUDE.md's Settings Save scope decision), but
  nothing in the app actually reads them yet: `_layout.tsx`'s
  `ThemeProvider` still derives light/dark purely from OS `useColorScheme()`
  (deliberately out of scope this stage), and no reminder-scheduling or
  trash-purge engine exists yet to consume `reminders`/`trashRetentionDays`
  (Stage 14 and the new Stage 17 respectively). Not a regression — before
  this stage these three were `useState` placeholders that didn't persist
  at all — but worth flagging since a user editing them in Settings now sees
  a value that *saves* successfully with no visible effect.
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
- **Recurring-instance generation only runs on app launch, not on
  foreground-resume** (Stage 6b) — matches data-model.md §9's literal "On
  app launch, the generator scans..." wording, but `AppState`-based
  foreground-resume triggering isn't wired. If a user leaves the app running
  in the background across a month boundary without a fresh launch, that
  period's instance won't appear until the next cold start. Cheap follow-up
  if this turns out to matter in practice — not implemented preemptively.
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

Stage: **11 — Multi-currency handling** (9a, 9a.1, 9b, and 10 are all
merged to `develop`; 9c remains blocked on Facebook Developer console
setup — see SRS §11). Stage 11 is built and verified on branch
`stage-11-multi-currency`, pending merge to `develop` — see its own
section below for what shipped. Stage 12 (Archive/Trash flows) is next
once this merges.

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
