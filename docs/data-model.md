# Firestore Data Model

**Status:** Approved — Stage 1 deliverable (see `docs/SRS-presupuesto-app.md` §11)
**Version:** 1.4
**Date:** 2026-07-07

This document is the source of truth for the Firestore schema. It formalizes the collections, document shapes, and design decisions needed to satisfy the functional requirements in `docs/SRS-presupuesto-app.md` §6 (FR-1 through FR-20). TypeScript types (`src/types/firestore.ts`) and security rules (`firestore.rules`) are derived from this document, not the other way around — if they ever disagree, this document wins and the code should be updated to match.

---

## 1. Architectural decision: instances live in top-level collections, not subcollections

Recurring **definitions** (`recurringExpenses`, `recurringIncomes`) and their generated **occurrences** are modeled as two separate top-level collections under the user, linked by a `recurringExpenseId`/`recurringIncomeId` reference field — not as `recurringExpenses/{id}/instances/{instanceId}` subcollections.

Reasoning:

- FR-7/FR-8 (history chart + chronological month list) and FR-6 (budget vs. actual per category/period) need **all spendable records in a date range**, mixing recurring-generated instances and one-time entries together, sorted by date. A single top-level `expenses` collection (discriminated by a `kind` field) lets that run as one query with one composite index, and lets Firestore's offline cache persist one queryable local set — important for full offline support (FR-10, NFR-1) without stitching together multiple collections' caches or `collectionGroup` queries.
- It satisfies FR-4d/FR-4e structurally, for free: an instance snapshots its own `name`/`categoryId`/`budgetedAmount`/`currency`/`exchangeRateToDefault` at generation time. Archiving/trashing the parent *definition* only flips the definition's own state (governs future generation) — it can never cascade-affect instance documents, because they're independent documents in a different collection.
- Personal-scale data (dozens–low hundreds of records/year) doesn't need subcollection isolation for scaling reasons.

## 2. Collection map

All data is nested under `users/{uid}` so a single security rule (`request.auth.uid == uid`) covers the whole account (NFR-7), and each device's SDK can scope its offline listeners to the whole account.

```
users/{uid}                                    — profile + settings doc
users/{uid}/categories/{categoryId}
users/{uid}/recurringExpenses/{recurringExpenseId}
users/{uid}/recurringIncomes/{recurringIncomeId}
users/{uid}/expenses/{expenseId}               — one-time expenses + recurring expense instances
users/{uid}/incomes/{incomeId}                 — one-time income + recurring income instances
```

---

## 3. `users/{uid}` — profile + settings

| Field | Type | Notes |
|---|---|---|
| `defaultCurrency` | `string` (ISO 4217) | FR-14 |
| `language` | `'es' \| 'en'` | NFR-4 |
| `theme` | `'light' \| 'dark' \| 'system'` | NFR-3 |
| `trashRetentionDays` | `number` | default `30`; drives `purgeAt` on trashed docs (§8) |
| `reminders` | `{ enabled: boolean, leadDays: number, timeOfDay: string \| null }` | FR-19/20 global default |
| `createdAt` / `updatedAt` | `Timestamp` | |

Single doc, read via one listener at app start, cached for full offline access (FR-10).

**Side effect on write:** when `defaultCurrency` changes, every `recurringExpenses/{id}.budgetRecommendation.status` in the account must be set to `'stale'` in the same logical operation (batched write), since `rollingAverageAmount`/`suggestedBudgetedAmount` are cached in the old default currency (§7, resolved decision #4).

---

## 4. `users/{uid}/categories/{categoryId}`

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | display name |
| `type` | `'expense' \| 'income' \| 'both'` | which pickers it appears in |
| `color` | `string \| null` | hex, for chart/UI accent |
| `icon` | `string \| null` | icon key |
| `order` | `number` | manual sort in dropdowns |
| `isSystemDefault` | `boolean` | seeded on account creation vs. user-created |
| `lifecycleState` | `'active' \| 'archived'` | Active/Archived only — **no Trash**. Categories are referenced by id from historical expense/income records; a purge path risks orphaning history. Archiving (hide from pickers, stay referenceable) is sufficient. |
| `createdAt` / `updatedAt` | `Timestamp` | |

**Indexed on:** `(type, lifecycleState, order)` — populating dropdowns.

---

## 5. Recurring definitions

### `users/{uid}/recurringExpenses/{id}`

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | |
| `categoryId` | `string` | ref to `categories` |
| `amount` | `number` | current budgeted amount, in `currency` — a live, editable template value |
| `currency` | `string` (ISO 4217) | |
| `exchangeRateToDefault` | `number` | rate for the *current* budgeted amount; re-editable |
| `dueDay` | `number` (1–31) | see §9 for month-end clamping rule |
| `startDate` | `Timestamp` | first period this recurrence applies |
| `lifecycleState` | `'active' \| 'archived' \| 'trashed'` | controls future generation only (FR-4e) |
| `trashedFromState` | `'active' \| 'archived' \| null` | restore target (FR-4b) |
| `archivedAt` / `trashedAt` | `Timestamp \| null` | |
| `purgeAt` | `Timestamp \| null` | `trashedAt + trashRetentionDays`; drives Firestore TTL auto-purge (§8) |
| `remindersEnabled` | `boolean \| null` | `null` = inherit `users/{uid}.reminders.enabled` |
| `reminderLeadDays` | `number \| null` | `null` = inherit global default |
| `budgetRecommendation` | `object` | see §7 |
| `createdAt` / `updatedAt` | `Timestamp` | |

**Indexed on:** `lifecycleState` (list active definitions needing generation), `categoryId`.

**Editing after future instances exist:** already-generated instances are left untouched (snapshot-at-generation model, §6). A definition edit (amount, `dueDay`, currency, etc.) only takes effect starting with the *next* generation cycle.

### `users/{uid}/recurringIncomes/{id}`

Same shape as above minus `budgetRecommendation`/reminder fields, plus:

| Field | Type | Notes |
|---|---|---|
| `frequency` | `'monthly' \| 'biweekly' \| 'weekly'` | FR-5 |
| `dayOfMonth` | `number \| null` | used when `frequency === 'monthly'` |
| `anchorDate` | `Timestamp \| null` | used for `'weekly'`/`'biweekly'` to compute occurrence dates (+7/+14 days from anchor) |

---

## 6. One-time records + generated instances

### `users/{uid}/expenses/{id}` and `users/{uid}/incomes/{id}`

Both collections share this shape (expenses adds budget-specific fields):

| Field | Type | Notes |
|---|---|---|
| `kind` | `'oneTime' \| 'recurringInstance'` | discriminator |
| `recurringExpenseId` / `recurringIncomeId` | `string \| null` | `null` when `kind === 'oneTime'` |
| `name` | `string` | snapshot at creation/generation, editable afterward without touching the definition |
| `categoryId` | `string` | snapshot |
| `date` | `Timestamp` | expense: due date. Income: **expected/due date** (FR-5c) — pre-filled from the recurrence schedule but editable; distinct from `paidDate` below, so a projection can tell "expected" apart from "received" |
| `currency` | `string` | |
| `exchangeRateToDefault` | `number` | captured once at write time, never recalculated (FR-16) |
| `amountInDefaultCurrency` | `number` | denormalized `amount * exchangeRateToDefault`, computed once — avoids reconverting on every aggregate read (FR-18) |
| `rateSource` | `'manual' \| 'fetched'` | FR-17 provenance |
| `budgetedAmount`, `budgetedCurrency` *(expenses only)* | `number \| null`, `string \| null` | snapshot of the recurring definition's `amount`/`currency` at generation time; `null` for `kind === 'oneTime'` (no separate "budget" concept for a one-time purchase) |
| `amount` | `number \| null` | present on **both** collections. Expenses: for `oneTime`, the entered amount (required); for `recurringInstance`, the actual paid amount, `null` until `paid === true`. Incomes: the expected/received amount, editable to match what actually arrived |
| `paid` | `boolean` | applies to **both** collections and **both** `kind` values (FR-3 parity for expenses; FR-5c for income) — expenses: an upcoming/unpaid bill can be logged before it's paid; income: distinguishes expected-but-not-received from received, for projections |
| `paidDate` | `Timestamp \| null` | set when marked paid/received; on income, this is when it actually arrived, separate from the expected `date` above |
| `lifecycleState` | `'active' \| 'archived' \| 'trashed'` | independent per-instance, never cascaded from the parent definition (FR-4e) |
| `trashedFromState` | `'active' \| 'archived' \| null` | |
| `archivedAt` / `trashedAt` | `Timestamp \| null` | |
| `purgeAt` | `Timestamp \| null` | trash auto-purge (§8) |
| `createdAt` / `updatedAt` | `Timestamp` | |

**Document ID strategy:** recurring instances use a **deterministic ID** — `expenses/{recurringExpenseId}_{yyyy-MM}` for monthly expenses, `incomes/{recurringIncomeId}_{yyyy-MM-dd}` for income (date-keyed, since weekly/biweekly can produce multiple occurrences per month). Two devices independently generating "this period's instance" both write to the same doc ID — idempotent, consistent with last-write-wins (NFR-6), no server-side dedup/Cloud Functions needed (Spark plan, NFR-2). One-time records use random auto-IDs.

**Indexed on:** `(lifecycleState, date)` (active list + Archive/Trash views), `(recurringExpenseId, paid, date)` on `expenses` and `(recurringIncomeId, paid, date)` on `incomes` (rolling average + per-definition drill-down — the income variant isn't queried by anything yet, listed for consistency since `incomes` now carries `paid` too, see §6 v1.3), `(categoryId, date)` (budget-vs-actual, FR-6).

**History/reports:** FR-7/FR-8 run as one query each against `expenses`/`incomes`, filtered by `lifecycleState == 'active'` and a `date` range; `kind` just tags display (icon/label). No separate merge step between one-time and recurring-instance records.

---

## 7. Archive/Trash lifecycle (FR-4a–4e)

Single enum `lifecycleState: 'active' | 'archived' | 'trashed'` per document (not two booleans), on every record type that supports it (definitions, instances, one-time records — **not** categories, see §4), plus `trashedFromState` to remember the restore target and `purgeAt` for auto-expiry:

- **FR-4a (archive):** `lifecycleState → 'archived'`, `archivedAt` set. Normal-view queries filter `== 'active'`; Archive view filters `== 'archived'`.
- **FR-4b/4c (trash/restore/purge):** `lifecycleState → 'trashed'`, `trashedFromState` set, `trashedAt` + `purgeAt` set. Restore reads `trashedFromState` back into `lifecycleState`, clears trash fields. Manual purge = `deleteDoc()` on that document only — nothing cascades, since instances/history are separate documents, not children.
- **FR-4d:** guaranteed structurally — a definition and its instances are different documents in different collections.
- **FR-4e:** instance generation only scans `recurringExpenses`/`recurringIncomes` docs with `lifecycleState == 'active'`; archived/trashed definitions are skipped, while already-generated instances keep their own independent `lifecycleState`.

**Trash retention:** auto-purge after N days, not manual-only. `users/{uid}.trashRetentionDays` (default `30`, user-configurable) drives a `purgeAt` timestamp field set whenever a document is trashed. A Firestore TTL policy on `purgeAt` auto-deletes expired trash — free on Spark, no Cloud Functions required (NFR-2).

Changing `trashRetentionDays` is **not retroactive** — only items trashed after the change use the new value; items already in Trash keep the `purgeAt` computed at the time they were trashed.

> **Deployment note:** `purgeAt` only auto-deletes documents if a **Firestore TTL policy** is enabled on that field for each collection. This is not something `firestore.rules` or the TypeScript types create automatically — it must be enabled manually per collection (`recurringExpenses`, `recurringIncomes`, `expenses`, `incomes`) via the Firebase console or `gcloud firestore fields ttls update`. See §12 (Deployment checklist).

---

## 8. Exchange rate handling (FR-14–18)

- Default currency lives once, on `users/{uid}.defaultCurrency`.
- Every expense/income document (a definition's *current* amount, and every instance/one-time record) carries its own `currency` + `exchangeRateToDefault` + denormalized `amountInDefaultCurrency`.
- **Immutability boundary:** a recurring definition's `amount`/`currency`/`exchangeRateToDefault` are mutable (it's a live plan the user edits), but once an instance is generated, those values are copied into `budgetedAmount`/`budgetedCurrency`/`exchangeRateToDefault` on the instance and never touched again by later definition edits. Once an instance/one-time record is written, its own rate/converted-amount are never recalculated — even if the default currency later changes or a fresh rate is fetched for a *new* record. This satisfies FR-16 exactly.
- If the user changes `defaultCurrency` itself, historical `amountInDefaultCurrency` values on existing records are **not** rewritten — old reports keep converting via each record's stored rate into what was the default currency *at the time*. (Budget recommendation caches are the one exception that must react to this change — see §3 and §7's `status: 'stale'`.)

---

## 9. 6-month rolling average & budget recommendations (FR-6a–6d)

**Computed on-the-fly from `expenses` documents, with a denormalized cache for cross-device UX** — not the reverse. The Firebase Spark (free) plan has no Cloud Functions (even within free quota, deploying one requires Blaze), so there's no backend trigger to maintain a server-side aggregate; everything runs client-side. At personal scale, this query is effectively free and offline-capable (FR-10 compliant):

```
query(expenses,
  where('recurringExpenseId', '==', id),
  where('paid', '==', true),
  orderBy('date', 'desc'),
  limit(6))
```

### Denormalized cache — `recurringExpenses/{id}.budgetRecommendation`

Exists only to (a) show recommendation badges across many recurring expenses without N separate queries, and (b) persist accept/dismiss state consistently across devices (FR-6d, FR-12).

```
budgetRecommendation: {
  rollingAverageAmount: number | null,        // in default currency
  sampleSize: number,                          // up to 6; fewer if <6 months of paid history
  computedAt: Timestamp | null,
  suggestedBudgetedAmount: number | null,
  status: 'none' | 'pending' | 'dismissed' | 'accepted' | 'stale',
  dismissedAt: Timestamp | null,
  dismissedAtAverageAmount: number | null,     // lets a dismissal re-surface once the average drifts further
}
```

Recomputed client-side whenever a relevant instance is marked paid/edited/restored, and re-evaluated at read time against the live query result to catch drift missed by a stale cache (e.g. an edit made on another device before this device reconnects). `status: 'stale'` is set in bulk across every recurring expense when `users/{uid}.defaultCurrency` changes (§3), and cleared on next recompute.

### Drift threshold (FR-6b/6c)

A recommendation is surfaced when **both** conditions hold:

1. `|rollingAverageAmount - budgetedAmount| / budgetedAmount > ROLLING_AVERAGE_DRIFT_PERCENT` (default `0.10`, i.e. 10%)
2. `|rollingAverageAmount - budgetedAmount| > ROLLING_AVERAGE_DRIFT_FLOOR` (default `20`, in default currency)

Both conditions must hold to avoid noise from small swings on small recurring bills (e.g. a $5 bill swinging 15% is a $0.75 difference — not worth surfacing). Both values are named, tunable constants defined once in code (not hardcoded inline in the calculation function) — see `src/types/firestore.ts`.

### Month-end clamping (`dueDay`)

When `dueDay` (e.g. `31`) doesn't exist in a given month, clamp to the last valid day of that month (e.g. `dueDay = 31` in February → Feb 28 or 29).

### Generation lookahead — catch-up/backfill

Instance generation is **not** lazy/current-period-only. On app launch, the generator scans each active recurring definition from its `startDate` (or last-generated period, whichever is later) forward through the current period and generates every missed instance, so budget tracking has no silent gaps if the app wasn't opened for several months. The "last generated period" is derived by querying `expenses`/`incomes` for the max `date` where `recurringExpenseId`/`recurringIncomeId == id` — cheap given the deterministic ID scheme (§6), no extra field required.

---

## 10. Reminders (FR-19/20)

Two-tier config: `users/{uid}.reminders.{enabled, leadDays}` (global default) and `recurringExpenses/{id}.{remindersEnabled, reminderLeadDays}` (nullable = inherit global) as a per-expense override. Delivery itself (local scheduled notifications, e.g. via `expo-notifications`) is out of scope for the data model, but constrains it: Spark has no server push, so scheduling must be derivable entirely from fields already present (`date`, `paid`, reminder settings) — no additional collection needed.

---

## 11. Open design decisions (not yet resolved — revisit before they become load-bearing)

1. **Actual-paid currency diverging from budgeted currency**: modeled as allowed (an instance's `amount`/`currency` are independent from `budgetedAmount`/`budgetedCurrency`), since a user might budget in one currency but actually pay in another that period. The SRS doesn't address this scenario explicitly.
2. **Budget change history/versioning**: no dedicated "budget changed from X to Y on date Z" log exists — each generated instance implicitly preserves the budgeted amount at that time via its own `budgetedAmount` snapshot, but there's no explicit version list if a future chart needs to show *when within a month gap* a budget changed.
3. **Schema versioning**: per SRS §10, explicitly deferred/out of scope — no `schemaVersion` field exists on any document; future breaking changes will need an ad hoc migration.

---

## 12. Deployment checklist

Steps that don't happen automatically from `firestore.rules` or app code deploys — must be done manually (once per environment/project):

- [ ] **Enable Firestore TTL policy on `purgeAt`** for each of: `recurringExpenses`, `recurringIncomes`, `expenses`, `incomes` (per-user subcollections — TTL policies are configured per collection group, so this covers all `users/{uid}/...` instances at once). Without this, trashed documents accumulate forever instead of auto-purging per `trashRetentionDays` (§7).
- [ ] Deploy `firestore.rules` (`firebase deploy --only firestore:rules`).
- [ ] Create composite indexes as query patterns are implemented and Firestore's console/CLI flags them as missing (see per-collection "Indexed on" notes in §4–§6 for the expected set: `(type, lifecycleState, order)` on `categories`; `lifecycleState` and `categoryId` on `recurringExpenses`/`recurringIncomes`; `(lifecycleState, date)`, `(categoryId, date)` on both `expenses`/`incomes`, plus `(recurringExpenseId, paid, date)` on `expenses` and `(recurringIncomeId, paid, date)` on `incomes`).

---

## 13. Change log

- **1.0 (2026-07-07):** Initial approved model for Stage 1.
- **1.1 (2026-07-07):** Added TTL deployment note (§7) and deployment checklist (§13) — `purgeAt` requires manually enabling a Firestore TTL policy per collection; this isn't created automatically by rules or app code.
- **1.2 (2026-07-07):** Fixed §6 field scoping, caught while writing `src/types/firestore.ts` — `amount` was mistakenly tagged "(expenses only)" (incomes need it too, to record the received/expected amount); `paid`/`paidDate` were untagged and read as shared, but income has no paid/unpaid concept (FR-5c's editable `date` already covers "when income arrived").
- **1.3 (2026-07-07):** SRS FR-5c updated to add a paid/received toggle for income (projection support — expected vs. actually received). `paid`/`paidDate` now apply to `incomes` too, mirroring `expenses` exactly; `date` on income is redefined as the expected/due date only, distinct from `paidDate`. Supersedes 1.2's income-has-no-paid-gate note.
- **1.4 (2026-07-07):** Doc cleanup — fixed section numbering (skipped straight from §11 to old §13, no §12; renumbered to §12/§13). Added the `(recurringIncomeId, paid, date)` index note alongside the existing `(recurringExpenseId, paid, date)` one in §6 and §12, for consistency now that `incomes` carries `paid` too (v1.3) — not queried by anything yet.
