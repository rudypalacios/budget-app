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
- **Auth:** Firebase Authentication — email/password, Google, Facebook
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

## Git conventions
- One branch per SRS stage (or sub-task within a large stage)
- Commit messages reference the stage/FR number where relevant, e.g.
  `feat: implement archive/trash flow (Stage 11, FR-4a-4c)`
- No direct commits to `main` — even solo, work through branches so stages can be
  reviewed/reverted independently

## Known Issues
_(Gaps and deferred items that don't already have a home in the SRS §11 roadmap —
tracked here instead of only living in chat history. Remove an entry once it's
actually resolved.)_

- **Web nav bar doesn't adapt at narrow widths** (`src/components/app-tabs.web.tsx`)
  — tabs overflow instead of wrapping or collapsing into a hamburger/drawer menu.
  Pre-existing Stage 2 gap, surfaced during Stage 5 review, not yet assigned to a
  specific stage.
- **Web add/edit modal renders as full-page navigation, not a dialog overlay**
  — `presentation: 'modal'` (Stage 5) gives native a real slide-up/swipe-to-dismiss
  modal, but on web, `expo-router`'s Stack navigation replaces the page outright
  rather than layering a dialog over the previous screen (confirmed via DOM
  inspection — no `role="dialog"`/`aria-modal`, and the previous route isn't kept
  mounted underneath). Affects `expenses/new`, `expenses/[id]/edit`, `income/new`,
  `income/[id]/edit`, `categories/new`, `categories/[id]/edit`.
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

## Current stage
_(Update this line as work progresses — tells Claude Code where we are without
re-explaining context each session.)_

Stage: **5 — Port/build UI screens per the new UI direction, including persistent sync-status indicator in nav bar**
