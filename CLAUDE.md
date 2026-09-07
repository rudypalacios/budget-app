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
- **Expense grouping (Stage 18) UI is Payments Dashboard-only** — the store
  layer (`setExpenseGroupParent`, the paid cascade, `archiveOrTrashExpenseGroup`,
  restore cascade — all in `src/store/expenses.ts`) works for every expense
  regardless of where it's touched, but the actual UI to use it ("Add to
  group.../Remove from group" in the row's overflow menu, the grouped-subtotal/
  "Part of X" caption, and the archive/trash cascade-or-detach dialog) was
  only wired into `src/app/(tabs)/index.tsx` (the Dashboard) this stage —
  deliberately, given the time this stage already took, rather than spread
  thin across every screen with less verification on each. The Expenses tab's
  "One-time" section, the Income tab, and History still only have the plain
  (non-cascade-aware) archive/trash actions and no group-picker entry point.
  A grouped expense created/edited on the Dashboard is still fully correct
  and visible everywhere else (it's the same document), it just can't be
  *grouped or ungrouped* from those other screens yet. Extending the same
  wiring (already generic — `findActiveChildren`/`eligibleGroupParents`/
  `computeGroupedSubtotal` in `src/lib/expense-grouping.ts`, plus the two new
  `GroupPickerDialog`/`GroupCascadeDialog` components) to Expenses/Income/
  History is straightforward follow-up, not a redesign.
- **"Agrupar con" (`defaultParentRecurringExpenseId`) is edit-only, not on
  the recurring-expense creation form** — `RecurringExpenseForm` (used by
  `src/app/recurring-expenses/[id]/edit.tsx`) has the picker, but
  `src/app/expenses/new.tsx`'s `ExpenseForm` (used to create a brand-new
  recurring expense, via its `isRecurring` toggle) does not — a new
  recurring expense is always created ungrouped, and grouping it is a
  second step (Edit it right after, or use the Dashboard's ad hoc "Add to
  group" once its first instance exists). Scoped out to keep this stage's
  UI surface manageable; straightforward to add to `ExpenseForm` later
  following the same pattern.

## Current stage
_(Update this line as work progresses — tells Claude Code where we are without
re-explaining context each session.)_

Stage: **17 — Trash view & restore screen** (built on branch
`stage-17-trash-archive`, pending merge — see its own summary below).
9a-12 are merged to `develop`; 9c remains blocked on Facebook Developer
console setup — see SRS §11. Stage 12's own section below still documents
what shipped there.

Stage 13 is built and verified on branch `stage-13-budget-recommendations`
(off `develop`), pending merge — see its own summary below for what
shipped. A round of user review against that branch surfaced seven
smaller product/UX gaps spanning several already-shipped stages (date
labels, a recurring-generation edge case, Dashboard naming, mark-paid
placement, income-aware budgeting) — fixed on branch
`fix/post-stage-13-review`, stacked on top of `stage-13-budget-recommendations`
per the user's explicit direction to keep this work separate. See its own
summary below.

Two further rounds of live-review UX polish followed, both still pending
merge: **round 3** (`fix/ux-polish-round-3`, commit `3ce04b2`) — input
trimming, category emoji icons, categories-admin list counts, and
cross-screen display consistency; see that commit's message for the full
breakdown, not duplicated here. **round 4** (`fix/ux-polish-round-4`) —
see its own summary below.

**Note found while starting Stage 17 (2026-08-07):** `git log` on
`develop` shows Stage 13, round 3, and round 4 above are actually already
merged (PRs #19–#24), plus two more merged branches this section never
got a paragraph for — `fix/dashboard-category-ux-review` (PR #22) and
`fix/google-signin-account-picker` (PR #21). This section's prose above
was never updated after those merges landed and is stale; left as-is here
rather than silently rewritten, since reconstructing exactly what each
merged PR contained isn't something to guess at — flag for the user to
confirm/rewrite this section's history whenever convenient.

Stage 17 — Trash view & restore screen — is built and verified
(`tsc`/lint/tests, not yet live-verified in a browser/device) on branch
`stage-17-trash-archive` (off `develop`), commit `a1ce047`, pending merge.
See its own summary below.

**Note found while starting Stage 18 (2026-09-07):** `git log` on
`develop` confirms Stage 17 above is also already merged (PR #26), plus
further merged work this section never got paragraphs for — PR #25
(`fix/cross-currency-budget-recommendation`), a Trash/Archive UI feedback
round (bulk select, Move to Trash, dialog/menu overflow fixes), and two
PRs restructuring the Budget tab's summary cards (#27, #28, "settled/
pending grid + balance footer"). Same situation as the Stage 17 note
above: left as-is rather than reconstructed from memory — flag for the
user to confirm/rewrite this whole section's history whenever convenient.

**Stage 18 — Expense grouping** is built and verified (`tsc`/lint/tests,
not yet manually verified in a browser) on branch
`claude/expense-grouping-categories-bxu05n` (off `develop` — Stage 17 and
everything through PR #28 is included), commit `123fcf3`, pending merge.
See its own summary below.

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

### Stage 18 summary

Scope confirmed with the user across several rounds of back-and-forth
before any code: a group parent's own `amount` stays fully manual/
independent (never derived from or locked by its children — the parent's
real total, e.g. an actual credit-card statement, is typically larger
than what's individually tracked); the paid cascade is a two-way
"select-all checkbox" (parent action cascades down to active children,
any child's own paid change recomputes the parent as AND-of-children);
archiving/trashing a parent with children needs an explicit cascade-or-
detach choice; and — confirmed last, closing the one item left open in
`docs/data-model.md` §12 — restoring a parent also restores its still-
non-active children.

- **Schema**: `Expense.parentExpenseId: string | null` (self-referencing
  FK within `expenses`, expenses-only — not on `incomes`) and
  `RecurringExpense.defaultParentRecurringExpenseId: string | null` (the
  persistent "Agrupar con" default), both in `src/types/firestore.ts` per
  `docs/data-model.md` §5/§6/§11. No new collection, no new Firestore
  index (§11's "compute at read time from the already-live listener"
  rationale — same pattern as §7/§13), no `firestore.rules` changes
  (neither field is locked, and rules don't enumerate an allowed-field
  whitelist).
- New `src/lib/expense-grouping.ts` (pure, unit-tested) —
  `findActiveChildren`/`computeGroupedSubtotal`/`canGroupUnder`/
  `eligibleGroupParents`/`computeParentPaidFromChildren`, same lib/-vs-
  store/ split as `lifecycle-transitions.ts`. `canGroupUnder`/
  `eligibleGroupParents` enforce FR-21a's single-level rule (a child can't
  be chosen as a parent; something that already has children can't become
  a child) — reused as-is for the recurring-definition "Agrupar con"
  picker too (`RecurringExpenseForm`), by mapping
  `defaultParentRecurringExpenseId` into the same generic shape.
- `src/store/expenses.ts` gained `setExpenseGroupParent` (assign/clear,
  throws on a single-level violation as a defensive backstop — the UI's
  picker is expected to only ever offer valid choices),
  `archiveOrTrashExpenseGroup` (cascade vs. detach-then-apply, one
  function backing both the Archive and Delete-to-trash actions), and a
  cascade layer inside `setExpensePaid`
  (`applyExpenseGroupPaidCascade`) and `setExpenseGroupParent` itself
  (group membership changing also recomputes whichever parent(s) it
  affects). All of these read one upfront store snapshot and never re-read
  store state after their own writes — the collection listener that backs
  `items` isn't guaranteed to have caught up yet (same race
  `updateRecurringExpense` already documented for
  `recomputeBudgetRecommendation`), so every cascade computes from what it
  already knows plus the value it's about to write, not a re-read.
- `src/store/recurring-generation.ts`'s `generateExpenseInstancesForDefinition`
  sets a new instance's `parentExpenseId` by *synthesizing* the parent
  definition's own deterministic instance ID for the same cycle
  (`{parentId}_{yyyy-MM}`) — no lookup/query needed, and it's correct even
  if generation processes the child before the parent within the same
  scan, since both defs converge on the same eventual IDs either way.
  Forward-only by construction: this only ever runs for a newly generated
  instance (the existing `setAt` idempotency already guarantees
  already-generated periods are never revisited), matching FR-21c's
  "changing the default doesn't retroactively relink past instances."
- **Found and fixed a real pre-existing bug while building the restore
  cascade**: `restoreTransition` (`src/lib/lifecycle-transitions.ts`) only
  ever handled trashed→X (it required `trashedFromState`, which is `null`
  on a merely-archived record) — every `restoreX` store function
  (`restoreExpense`/`restoreIncome`/`restoreRecurringExpense`/
  `restoreRecurringIncome`) inherited this, so clicking **Restore** on the
  Archive screen (Stage 17) for *any* record type has been throwing at
  runtime since that screen shipped; only Trash-screen restores (which are
  always genuinely trashed) worked. Not something this stage set out to
  touch — found because `restoreExpense` needed to correctly restore an
  archived parent's archived children. Fixed `restoreTransition` to branch
  on the record's actual current `lifecycleState` (trashed→X as before,
  archived→active directly), and updated all four `restoreX` call sites'
  guards accordingly (`lifecycleState === 'active'` instead of
  `!trashedFromState`).
- `restoreExpense` (no longer just engine-only — this is its first real
  caller, via the Archive/Trash screens' existing `restoreLifecycleRecord`)
  also restores every child still sitting in a non-`'active'`
  `lifecycleState` under the record being restored, each through its own
  `restoreTransition` (own `trashedFromState`) — kept the existing
  deliberately-not-`async`/synchronous-throw shape (`.then()` chaining)
  so the pre-existing `expect(() => restoreExpense(...)).toThrow()` guard
  test stays valid.
- **UI, scoped to the Payments Dashboard this stage** (see Known Issues
  for the explicit scope limitation) — `(tabs)/index.tsx` gained: an "Add
  to group…"/"Remove from group" `OverflowMenu` action on every expense
  row (new `GroupPickerDialog`, a plain pressable list of
  `eligibleGroupParents`); an archive/trash cascade-or-detach confirmation
  whenever the target has active children (new `GroupCascadeDialog`,
  composed on the existing `Dialog` primitive, same shell as
  `ConfirmRecordsDialog`); and per-row grouping cues — a child renders
  indented with a `"└─▸ "` prefix on its own name line plus a "Part of
  {{parent}}" caption, a parent shows "{{count}} grouped: {{subtotal}}" —
  computed at render time, never stored. (First pass shipped only the
  captions and missed the indent/marker entirely — caught by the user's
  own manual QA pass, fixed in commit `9c5135d`.) **Second round of user
  feedback after seeing it live**: the caption-only version still didn't
  match the Google-Keep-style reference the user actually wanted — a child
  needed to visually sit *directly under* its parent, not just carry a
  "Part of X" label wherever plain date-sort happened to place it, and a
  fully-checked group needed to move into the completed section together,
  same as Keep's checked-items behavior. Fixed in commit (see git log) by
  adding `orderRowsWithGroupedChildren` (`src/lib/payments-dashboard.ts`,
  called from `groupPaymentRows`) — after the normal date/action-timestamp
  sort, each bucket's rows get a second pass that moves a parent's active
  children to sit directly after it. This is bucket-local, not global: a
  child only moves next to its parent when both landed in the *same*
  bucket (overdue/upcoming/completed) to begin with — a child whose parent
  is in a different bucket (e.g. parent already paid, child not) keeps its
  own sorted position, since there's no parent row there to nest under.
  With real adjacency now known, the connector glyph is genuine too:
  `"├─▸"` when more siblings are still adjacent below in this bucket,
  `"└─▸"` for the last (or only) one — no longer a single flat glyph for
  every child.
- `RecurringExpenseForm` gained an "Agrupar con" `Select` (edit-only, see
  Known Issues) wired through `recurring-expenses/[id]/edit.tsx` — a
  `NO_GROUP_PARENT` sentinel (`''`) stands in for `null` since `Select`'s
  value type can't be nullable.
- New `grouping` i18n namespace (`en.json`/`es.json`) plus three new
  `recurringExpense.form.*` keys for the picker.
- **tsc/lint/tests**: all clean — `npx tsc --noEmit` clean (one
  pre-existing, unrelated `@/global.css` module-resolution error,
  confirmed present on `develop` before this stage's changes via
  `git stash`), `npm run lint` clean, `npm test` 25/25 suites, 220/220
  tests (33 new: `expense-grouping.test.ts` in full, plus new cascade/
  restore-fix cases in `expenses.test.ts` and the extended
  `lifecycle-transitions.test.ts`).
- Deviations from the approved plan: (1) the ASCII-tree connector only
  distinguishes middle/last siblings *within the same status bucket* — a
  child whose parent landed in a different bucket still can't nest under
  it, an inherent limit of the overdue/upcoming/completed bucket model
  rather than something worth a larger sort-logic rework for; (2) the UI
  was wired onto the Dashboard only, not also Expenses/Income/History, to
  keep this stage's verification manageable — both disclosed above and in
  Known Issues, not silently dropped.
- **Not yet manually verified end-to-end on a device/browser** — see the
  QA test-case list handed to the user alongside this summary. Do that
  before merging.
- Committed to branch `claude/expense-grouping-categories-bxu05n` (off
  `develop`), commit `123fcf3`, clean tree. Not merged — per the standing
  convention, that's the user's call.
