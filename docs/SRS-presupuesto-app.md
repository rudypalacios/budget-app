# Software Requirements Specification (Simplified)
## Personal Budget Management App — React Native + Web Rebuild

**Version:** 1.1 (Draft)
**Date:** July 6, 2026
**Owner:** Rudy

---

## 1. Purpose

Rebuild the existing single-file HTML budget app into a React Native application (Expo) that runs on mobile (iOS/Android) and web from one codebase, works fully offline, and syncs data to the cloud automatically when internet is available.

## 2. Scope

The app is a personal finance tool for tracking income and expenses. It covers recurring and one-time expenses, recurring and one-time income, payment status, archiving, budget-vs-actual comparisons, and historical analysis with charts. It is single-user (no multi-tenant/team features). Currency and language are configurable rather than fixed, and the app supports multi-currency records converted back to a single default currency for budgeting and reporting.

## 3. Current State (Baseline)

Existing prototype: single HTML file, vanilla JS, localStorage, dark theme with green accents — treated as a proof of concept, not a design template. Features already implemented and to be preserved/ported:

- Recurring monthly expenses with due dates, paid/unpaid status, auto-regeneration each month
- One-time expense logging with categories
- Recurring income with frequency (monthly, biweekly, weekly) and day-of-month
- Budget vs. actual comparison with visual alerts
- History tab: SVG line chart (actual paid, budget, rolling average) + chronological payment list grouped by month
- Centralized category list (`CATEGORIAS`) as single source of truth
- Mobile-responsive UI: hamburger menu, slide-in panel, compact stats table

## 4. UI Direction

The POC's visual style (dark + green) is not carried forward as a requirement. The rebuilt app should instead prioritize:

- A modern, clean, professional look following standard UX/UI conventions — navigation placement, button hierarchy, spacing, and touch-target sizes that match patterns users already recognize from well-designed apps.
- Comfortable readability and low visual fatigue, suitable for both younger and older users.
- Mobile-first layout. React Native/Expo covers much of this by default, but layout still needs deliberate review at tablet/web breakpoints.
- Theming support (see NFR-3) instead of one fixed color scheme.

## 5. Target Architecture

| Layer | Choice |
|---|---|
| App framework | React Native (Expo) |
| Web target | react-native-web — shared codebase by default (see NFR-5 for when to reconsider) |
| Local storage | Firestore offline persistence (built-in cache) |
| Cloud backend / sync | Firebase (Firestore) |
| Auth | Firebase Authentication — email/password plus Google and Facebook sign-in |
| Charts | react-native-svg or Victory Native |
| State management | Zustand (or Redux) reading/writing through Firestore's offline-first API |
| Hosting (web) | Static export, hosted separately from current orangehost.com (Firebase Hosting or similar, free tier) |

**Note:** orangehost.com (current PHP/MySQL hosting) is not used for this project — Firestore replaces the need for a custom backend/API.

## 6. Functional Requirements

### 6.1 Expense Management
- FR-1: User can create, edit, delete recurring expenses (name, category, amount, due day).
- FR-2: Recurring expenses auto-regenerate each month.
- FR-3: User can mark a recurring expense as paid/unpaid, with paid date.
- FR-4: User can create, edit one-time expenses with category and date.
- FR-4a: User can **archive** a one-time or recurring expense instead of deleting it. Archived records are hidden from normal views but remain fully intact and retrievable from an Archive view.
- FR-4b: Deleting a record does not remove it immediately — it moves to a **Trash bin** (soft delete). Items in Trash can be restored to active/archived state, or permanently purged from Trash.
- FR-4c: Permanent purge from Trash is irreversible. Before confirming, the app must clearly communicate that the action cannot be undone, and offer Archive as an alternative to deleting in the first place.
- FR-4d: Deleting or trashing a recurring expense/income **definition** never removes its historical payment records — past paid amounts remain intact in History/reports even if the recurring definition itself is later deleted.
- FR-4e: An archived or trashed recurring expense/income definition **stops generating new instances** going forward, while all previously generated instances and their history remain untouched.

### 6.2 Income Management
- FR-5: User can create, edit, delete recurring income (name, amount, frequency: monthly/biweekly/weekly, day-of-month).
- FR-5a: User can also create, edit, delete **one-time** income records (not tied to a recurrence).
- FR-5b: Recurring income, like recurring expenses, auto-regenerates each period.
- FR-5c: The regenerated `date` for recurring income represents the **expected/due date**, pre-filled from the recurrence schedule but editable. Income also has a **paid/received toggle** (mirroring FR-3's expense paid/unpaid, for consistency), with an associated `paidDate` captured when marked received — separate from the expected date. This lets future projections distinguish income that's expected but not yet received from income actually in hand, rather than conflating the two into a single editable date.

### 6.3 Budget Tracking
- FR-6: App shows budget vs. actual spending per category/period with visual alerts when overspending.

### 6.3a Budget Recommendations
- FR-6a: For recurring expenses whose actual paid amount varies month to month (e.g. an electric bill), the system calculates a **rolling average** of actual amounts over the last **6 months**.
- FR-6b: When the rolling average diverges meaningfully from the currently budgeted amount, the app surfaces a visible **recommendation** to adjust the budget up or down to match the average — e.g. "Budgeted Q200, average actual is Q250 — consider updating your budget."
- FR-6c: This recommendation is shown both when creating a new recurring expense with a matching history (suggesting a realistic starting budget) and on existing recurring expenses whose average has drifted from the current budget.
- FR-6d: User can accept the recommendation (auto-updates the budgeted amount) or dismiss it and keep the current budget.

### 6.4 History & Analysis
- FR-7: History view shows a line chart of actual paid, budgeted, and rolling average over time.
- FR-8: History view lists past payments grouped chronologically by month.

### 6.5 Categories
- FR-9: A single, centrally managed category list feeds all dropdowns/selectors app-wide.

### 6.6 Offline & Sync
- FR-10: All read/write operations work fully offline using local cache.
- FR-11: Changes made offline sync automatically to Firestore once connectivity returns, without user intervention.
- FR-12: The same account/data is accessible from both the mobile app and the web version.
- FR-12a: A persistent **sync status indicator** (synced / pending / offline) is shown in the top navigation bar, next to the title/icon/hamburger menu, visible on every screen.

### 6.7 Multi-Currency
- FR-14: User sets a single app-wide **default currency**, used for all budgets, totals, and history/reports.
- FR-15: Each expense or income record can optionally be entered in a **different currency** than the default.
- FR-16: When a record's currency differs from the default, the user provides (or fetches) an **exchange rate**, which is stored with that record permanently — later rate changes do not retroactively alter past records or historical reports.
- FR-17: If online, the user may optionally fetch a current exchange rate from a free public rate source as a convenience; manual entry always remains available and is required for offline use.
- FR-18: Budget-vs-actual and history views calculate totals in the default currency (using each record's stored rate), while still displaying the record's original currency and amount.

### 6.8 Authentication
- FR-13: User can log in with username/password **or** via Google or Facebook sign-in, to enable cross-device sync.

### 6.9 Reminders
- FR-19: App can send a reminder for upcoming/due recurring expenses (e.g. a day before or on the due date).
- FR-20: Reminders are **configurable and can be turned on or off**, globally and/or per recurring expense.

## 7. Non-Functional Requirements

- NFR-1: **Offline-first** — no feature should require connectivity to function; sync is transparent.
- NFR-2: **Cost** — must stay within free tiers (Firebase Spark plan, Expo free tier); no paid hosting/services.
- NFR-3: **Theming** — app supports light and dark themes at launch, built to accommodate more themes later. Themes change color/accent palette only (following solid, tasteful color-design practice) — not font, size, spacing, headers, or layout.
- NFR-4: **Localization & currency** — UI supports Spanish and English at launch, structured so additional languages can be added via translation files. Default currency is a user-configurable setting, not hardcoded to GTQ (see FR-14 through FR-18 for multi-currency handling).
- NFR-5: **Codebase sharing** — mobile and web share one codebase (via react-native-web) by default. If a real technical limitation surfaces (e.g., a mobile-only or web-only capability that can't be reasonably shared), assess at that point whether a split into separate apps with a shared Firebase backend is warranted, rather than assuming a single codebase always works.
- NFR-6: **Data integrity** — conflict resolution uses last-write-wins based on timestamps (acceptable for single-user, low-conflict use case).
- NFR-7: **Security** — Firestore security rules restrict all reads/writes to the authenticated owner's own data only; no other account can access it, across all devices.

## 8. Out of Scope

- Multi-user/shared budgets or team accounts
- Bank account integration / automatic transaction import
- Native payment processing

## 9. Migration Notes

- Existing localStorage data structure will be mapped to Firestore collections (expenses, income, categories, payments) as part of Stage 1 (data model formalization).
- No automatic migration tool is planned unless Rudy has existing data he wants carried over — to be confirmed when reaching that stage.

## 10. Considered, Not Included Yet

These were discussed and deliberately deferred rather than overlooked — worth revisiting later:

- Search & filter for expenses/income/history (paused — no clear need identified yet)
- Data export/backup (CSV/PDF) — planned for later
- Accessibility polish (font scaling, contrast ratios)
- Full account/data deletion (distinct from per-record Trash)
- Pagination/virtualization for long history lists
- Schema versioning strategy for future data-model changes

## 11. Build Stages (Roadmap)

1. Formalize data model (categories, expenses, income, payments, archive/trash state, exchange rates, history)
2. Expo + react-native-web project scaffold
3. Configure Firestore with offline persistence + security rules (owner-only access)
4. Design system: theming (light/dark), layout, and component library
5. Port/build UI screens per the new UI direction, including persistent sync-status indicator in nav bar
6. State layer (Zustand) wired to Firestore
6b. Recurring definitions: management UI (create/edit recurringExpenses and
    recurringIncomes) + instance generation, including the generation-lookahead
    catch-up logic and month-end `dueDay` clamping (FR-1, FR-2, FR-5, FR-5b;
    see docs/data-model.md §9). Must land before Stage 12, since that stage's
    rolling-average query depends on recurring instances already existing in
    `expenses`/`incomes`.
7. Firestore sync validation (no custom sync code needed)
8. Firebase Auth integration (email/password + Google + Facebook)
9. Localization setup (Spanish + English) and default currency setting
10. Multi-currency handling: per-record currency, stored exchange rate, optional live-rate fetch
11. Archive/Trash flows: archive, soft-delete to Trash, restore, permanent purge with confirmation, regeneration stops on archive/trash
12. Budget recommendation engine: rolling average calculation and budget-adjustment suggestions
13. Reminders: configurable due-date notifications (global and per-expense toggle)
14. Offline/reconnect testing
15. Deployment (EAS build for mobile, static web export)

---

*This document is a living draft and will be refined as each stage is completed.*