# Firestore Data Model

**Status:** Approved — Stage 1 deliverable (see `docs/SRS-presupuesto-app.md` §11)
**Version:** 1.6
**Date:** 2026-08-01

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

**Side effect on write:** when `defaultCurrency` changes, every `recurringExpenses/{id}.budgetRecommendation.status` in the account must be set to `'stale'` in the same logical operation (batched write), since `rollingAverageAmount`/`suggestedBudgetedAmount` are cached in the old default currency (§7, resolved decision #4). Stage 11's redesign extends this same side effect to §3a below.

---

## 3a. `users/{uid}/currencies/{code}` (Stage 11 redesign)

One doc per currency the user has configured for use — **doc ID is the ISO 4217 currency code itself** (deterministic, like recurring-instance IDs in §6), so a given currency can only ever be added once and existence-checks/removal are a plain path lookup, no query needed.

| Field | Type | Notes |
|---|---|---|
| `exchangeRateToDefault` | `number` | rate FROM this currency TO `defaultCurrency` — same direction/semantics as the per-record field of the same name (§8) |
| `rateSource` | `'manual' \| 'fetched'` | provenance of the configured rate |
| `status` | `'ok' \| 'stale'` | `'stale'` set in bulk when `defaultCurrency` changes (same batched-write side effect as §3 above); a stale currency is excluded from every currency picker until refreshed |
| `createdAt` / `updatedAt` | `Timestamp` | |

**Not referenced by ID from any other document.** Every expense/income/recurring-definition record still snapshots its own `currency` + `exchangeRateToDefault` directly and immutably at write time, exactly as §8 describes — this collection only exists to drive *which currencies are offered* when creating/editing a record, and to hold the rate that gets copied into that record at that moment. Removing or staling an added currency here therefore never affects any already-written record or already-existing recurring definition using that currency — only what's offered going forward.

Rationale for moving rate entry here instead of inline on every transaction form (the original Stage 11 shape): most records are entered in the default currency, so asking for a currency + exchange rate on every single entry was disproportionate friction for something used rarely. Configuring a currency once here, then just picking from that short list on every transaction afterward, matches actual usage far better.

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
| `monthlyBudget` | `number \| null` | in `defaultCurrency`, manually set (Stage 13, FR-6). Compared against actual spend — recurring instances **and** one-time expenses combined — on the Budget tab. The category-edit form pre-fills it with a suggestion (sum of that category's active `recurringExpenses` amounts, converted to `defaultCurrency`) when unset, but the value itself stays a plain editable number, not a live derivation — deliberately, since one-time spending isn't captured by that sum. |
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
| `defaultParentRecurringExpenseId` | `string \| null` | see §11 — persistent group-parent default; each newly generated instance inherits the link to that cycle's parent instance. `null` = ungrouped |
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
| `parentExpenseId` *(expenses only)* | `string \| null` | see §11 — self-referencing FK to another `expenses/{id}`, the group parent. `null` = ungrouped. Not present on `incomes` (grouping is expenses-only, §11) |
| `skipped`, `skippedAt` *(recurring instances only)* | `boolean`, `Timestamp \| null` | `kind === 'recurringInstance'` only — `false`/`null` for `kind === 'oneTime'` (Stage 8, Payments Dashboard, §13). Marks a single generated occurrence as intentionally not going to be paid this period, without affecting the parent definition, its generation schedule, or any other instance. Orthogonal to `paid`/`paidDate`, same relationship those two have to `lifecycleState`: `lifecycleState` governs whether the doc is visible at all (active/archived/trashed), `paid` governs payment status, `skipped` governs whether this occurrence counts toward due/overdue — a skipped instance is still `lifecycleState: 'active'` and still appears in History. Setting `paid: true` on a skipped instance also clears `skipped`/`skippedAt` (paying an occurrence implies it's no longer being skipped); the reverse isn't true (marking unpaid doesn't touch `skipped`). |
| `createdAt` / `updatedAt` | `Timestamp` | |

**Document ID strategy:** recurring instances use a **deterministic ID** — `expenses/{recurringExpenseId}_{yyyy-MM}` for monthly expenses, `incomes/{recurringIncomeId}_{yyyy-MM-dd}` for income (date-keyed, since weekly/biweekly can produce multiple occurrences per month). Two devices independently generating "this period's instance" both write to the same doc ID — idempotent, consistent with last-write-wins (NFR-6), no server-side dedup/Cloud Functions needed (Spark plan, NFR-2). One-time records use random auto-IDs.

**Indexed on:** `(lifecycleState, date)` (active list + Archive/Trash views), `(recurringExpenseId, paid, date)` on `expenses` and `(recurringIncomeId, paid, date)` on `incomes` (rolling average + per-definition drill-down — the income variant isn't queried by anything yet, listed for consistency since `incomes` now carries `paid` too, see §6 v1.3), `(categoryId, date)` (budget-vs-actual, FR-6). `parentExpenseId` needs **no new Firestore index** — same as §7's lifecycle filtering, grouping/cascade logic runs client-side against the `expenses` collection's already-live real-time listener, not a fresh query.

**History/reports:** FR-7/FR-8 run as one query each against `expenses`/`incomes`, filtered by `lifecycleState == 'active'` and a `date` range; `kind` just tags display (icon/label). No separate merge step between one-time and recurring-instance records.

---

## 7. Archive/Trash lifecycle (FR-4a–4e)

Single enum `lifecycleState: 'active' | 'archived' | 'trashed'` per document (not two booleans), on every record type that supports it (definitions, instances, one-time records — **not** categories, see §4), plus `trashedFromState` to remember the restore target and `purgeAt` for auto-expiry:

- **FR-4a (archive):** `lifecycleState → 'archived'`, `archivedAt` set. Normal-view queries filter `== 'active'`; Archive view filters `== 'archived'`.
- **FR-4b/4c (trash/restore/purge):** `lifecycleState → 'trashed'`, `trashedFromState` set, `trashedAt` + `purgeAt` set. Restore reads `trashedFromState` back into `lifecycleState`, clears trash fields. Manual purge = `deleteDoc()` on that document only — nothing cascades, since instances/history are separate documents, not children.
- **FR-4d:** guaranteed structurally — a definition and its instances are different documents in different collections.
- **FR-4e:** instance generation only scans `recurringExpenses`/`recurringIncomes` docs with `lifecycleState == 'active'`; archived/trashed definitions are skipped, while already-generated instances keep their own independent `lifecycleState`.
- **Grouped expenses (§11):** archiving/trashing an expense that has active children (`parentExpenseId == thisId`) is not a plain state transition — the user is prompted to cascade the action to every child or detach them first. See §11 for the full rule.

**Trash retention:** auto-purge after N days, not manual-only. `users/{uid}.trashRetentionDays` (default `30`, user-configurable) drives a `purgeAt` timestamp field set whenever a document is trashed. A Firestore TTL policy on `purgeAt` auto-deletes expired trash — free on Spark, no Cloud Functions required (NFR-2).

Changing `trashRetentionDays` is **not retroactive** — only items trashed after the change use the new value; items already in Trash keep the `purgeAt` computed at the time they were trashed.

> **Deployment note:** `purgeAt` only auto-deletes documents if a **Firestore TTL policy** is enabled on that field for each collection. This is not something `firestore.rules` or the TypeScript types create automatically — it must be enabled manually per collection (`recurringExpenses`, `recurringIncomes`, `expenses`, `incomes`) via the Firebase console or `gcloud firestore fields ttls update`. See §14 (Deployment checklist).

---

## 8. Exchange rate handling (FR-14–18)

- Default currency lives once, on `users/{uid}.defaultCurrency`.
- Every expense/income document (a definition's *current* amount, and every instance/one-time record) carries its own `currency` + `exchangeRateToDefault` + denormalized `amountInDefaultCurrency`.
- **Immutability boundary:** a recurring definition's `amount`/`currency`/`exchangeRateToDefault` are mutable (it's a live plan the user edits), but once an instance is generated, those values are copied into `budgetedAmount`/`budgetedCurrency`/`exchangeRateToDefault` on the instance and never touched again by later definition edits. Once an instance/one-time record is written, its own rate/converted-amount are never recalculated — even if the default currency later changes or a fresh rate is fetched for a *new* record. This satisfies FR-16 exactly.
- If the user changes `defaultCurrency` itself, historical `amountInDefaultCurrency` values on existing records are **not** rewritten — old reports keep converting via each record's stored rate into what was the default currency *at the time*. (Budget recommendation caches are the one exception that must react to this change — see §3 and §7's `status: 'stale'`.)
- **Where a record's rate value comes from (Stage 11 redesign):** a user configures a currency once in Settings → `currencies/{code}` (§3a) — picking it and fetching/entering its rate there. Every expense/income/recurring-definition creation or edit screen then only offers currencies already configured in §3a (plus the default currency itself, implicitly rate `1`), and copies that currency's current `exchangeRateToDefault`/`rateSource` into the record being written. There is no per-transaction rate entry or live-fetch UI anymore — FR-17's live-fetch convenience lives entirely in the §3a configuration screen instead of on every transaction form.

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

## 11. Expense grouping (FR-21–FR-21f, Stage 18)

Lets a user associate one expense with another as its **group parent** —
e.g. Netflix/Disney+/Google Cloud each individually tracked, but grouped
under a shared credit card expense — without merging them into one
record. Expenses only (§6's `parentExpenseId`); income is out of scope
for this stage.

**No new collection.** `parentExpenseId` is a self-referencing field
within the existing `expenses` collection (§6) — a child is a completely
normal expense document that happens to point at another one. **Single
level only**: the assignment UI refuses to let an expense that already
has a non-null `parentExpenseId` be picked as a parent for something
else, so a parent is never itself a child.

### Assignment — two paths

1. **Ad hoc** — an "Add to group... / Remove from group" action in the
   overflow menu of any expense row (Payments Dashboard, Expenses tab,
   History), picking any other active, non-child expense as parent. Sets/
   clears `parentExpenseId` directly on that one document.
2. **Persistent, via the recurring template** —
   `recurringExpenses/{id}.defaultParentRecurringExpenseId` (§5) points at
   another recurring definition. When `generateExpenseInstancesForDefinition`
   creates a new instance and the definition has this default set, it
   looks up the parent definition's already-generated instance for the
   same cycle — cheap, since instance IDs are deterministic per
   `(recurringExpenseId, cycle)` (§6) — and sets the new instance's
   `parentExpenseId` to that document's ID. **Forward-only**: changing
   the default does not retroactively relink instances already generated
   for the current or past cycles; those still need path 1 if the user
   wants them grouped too.

### Amount handling

The parent's own `amount` is always entered independently, exactly like
any other expense — grouping never derives, recalculates, or locks it.
This is deliberate: a group parent's real total (e.g. what a credit card
statement actually charges) is typically larger than the subset of items
the user bothers to track individually as children, so forcing
`parent.amount == sum(children.amount)` would be wrong. The UI computes
and displays a **grouped subtotal** — the sum of the group's active
children's `amountInDefaultCurrency` — alongside the parent's own amount,
purely informational and never written to any field (same "compute at
render time from already-loaded state" approach as `budget.tsx`'s
category totals).

### Paid cascade

Tri-state, "select-all checkbox" semantics — no new field, it falls
directly out of each document's own existing `paid` boolean (FR-3):

- **Parent → children:** marking the parent paid or unpaid sets the same
  `paid` value on every active child, each stamped with its own
  `paidDate`/cleared `paidDate` at the moment of the cascade (not copied
  from the parent).
- **Children → parent:** marking or unmarking any individual child
  re-evaluates the parent afterward: `parent.paid = true` only when
  **every** active child is `paid === true`; otherwise `parent.paid =
  false`. Archived/trashed children are excluded from this check, so an
  archived child can't permanently block the parent from reading as paid.
- A child that joins an already-paid group (via either assignment path,
  including generation catching up a missed cycle) always starts
  `paid: false` — which immediately un-marks the parent per the rule
  above. A newly grouped charge is never silently treated as already
  settled.
- This is enough to represent a "partially paid" group (e.g. only Netflix
  paid so far, Disney+/Google Cloud still pending) with zero new schema —
  it's just the natural state of each child's own `paid` field.

### Archive/Trash interaction

Extends §7. Archiving or trashing an expense that has active children
(`parentExpenseId == thisId`) is not a plain state transition — it shows
a confirmation naming the affected children, with two choices:

- **Cascade** — apply the same archive/trash transition to the parent and
  every active child.
- **Detach and apply to parent only** — clear `parentExpenseId` on every
  child first (they remain independent, active expenses), then
  archive/trash the parent alone.

**Restore cascades too (confirmed with the user):** restoring a parent
also restores every child with `parentExpenseId == thisId` whose
`lifecycleState` is still `'archived'` or `'trashed'` (i.e. not already
independently restored or never grouped-and-archived in the first
place). Each child restores through its own existing per-record restore
logic (§7 — its own `trashedFromState`), just triggered together with the
parent rather than requiring a separate tap per child. No new field is
needed to track "which children belong to which cascade" — a child still
sitting in a non-`'active'` state under this parent is, by definition,
still part of the group that needs restoring.

---

## 12. Open design decisions (not yet resolved — revisit before they become load-bearing)

1. **Actual-paid currency diverging from budgeted currency**: modeled as allowed (an instance's `amount`/`currency` are independent from `budgetedAmount`/`budgetedCurrency`), since a user might budget in one currency but actually pay in another that period. The SRS doesn't address this scenario explicitly.
2. **Budget change history/versioning**: no dedicated "budget changed from X to Y on date Z" log exists — each generated instance implicitly preserves the budgeted amount at that time via its own `budgetedAmount` snapshot, but there's no explicit version list if a future chart needs to show *when within a month gap* a budget changed.
3. **Schema versioning**: per SRS §10, explicitly deferred/out of scope — no `schemaVersion` field exists on any document; future breaking changes will need an ad hoc migration.

---

## 13. Payments Dashboard view logic (Stage 8)

Read-only view logic, not a new collection or write path (skip's schema
addition is covered in §6). Documented here because the grouping rule has
real bugs if misread, and because it establishes a **standing product
principle for this feed going forward**, not just a Stage 8 detail:

> An unpaid `expenses`/`incomes` instance never leaves the dashboard on
> its own, no matter how old. It only exits via one of exactly four
> explicit user actions: **paid, archived, deleted, or skipped.**

Given that, the dashboard groups every `lifecycleState: 'active'`
expense/income row (one-time and recurring instance, merged client-side —
no new query, see §1's reasoning for why `expenses`/`incomes` are each a
single top-level collection already) into exactly three groups:

1. **Overdue unpaid** — `date < today && paid === false && skipped !== true`,
   ascending by `date` (oldest first). Spans every cycle, not just the
   current one — an unpaid item from 3 cycles ago still appears here.
2. **Upcoming unpaid** — `date >= today && paid === false && skipped !== true`,
   ascending by `date` (soonest first).
3. **Completed this cycle** — `paid === true || skipped === true`, where
   the **action timestamp** (`paidDate` for paid, `skippedAt` for
   skipped) falls within the current calendar-month cycle. Sorted
   descending by that same action timestamp.

**Group 3 is keyed by the action timestamp, never by `date`.** An item
overdue by 3 months that gets paid today shows in "Completed this cycle"
*today* (`paidDate = today`), regardless of how old its `date` is — "what
did I clear this cycle" is about when the money moved, not when it was
originally due. At cycle rollover, group-3 items simply stop being
surfaced on this dashboard (paid items remain visible in History via
`paidDate`, unaffected; `skipped`/`skippedAt` are never cleared, they
just stop matching "current cycle"). Still-unpaid items are unaffected by
rollover and continue in groups 1–2 until acted on.

**No document duplication:** a late payment settled today is still one
document — `date` (original due date) and `paidDate` (when actually paid)
are two fields on the same doc, never a clone.

**Cycle definition:** calendar month, computed by a single centralized
`getCurrentCycleRange()` utility (`src/lib/cycle.ts`) rather than inlined
month-math at each call site — deliberately, so a future configurable
cycle length (e.g. weekly/quincena, backlogged, not in scope for Stage 8)
only needs one function's implementation to change.

**Out of scope for Stage 8:** browsing *past* cycles (e.g. "what did I
pay in April"). That's cash-basis budget-vs-actual reporting, belongs to
Stage 13, and is computed from `paidDate` at that time — Stage 8's
dashboard only ever shows the live/current state.

---

## 14. Deployment checklist

Steps that don't happen automatically from `firestore.rules` or app code deploys — must be done manually (once per environment/project):

- [ ] **Enable Firestore TTL policy on `purgeAt`** for each of: `recurringExpenses`, `recurringIncomes`, `expenses`, `incomes` (per-user subcollections — TTL policies are configured per collection group, so this covers all `users/{uid}/...` instances at once). Without this, trashed documents accumulate forever instead of auto-purging per `trashRetentionDays` (§7).
- [ ] Deploy `firestore.rules` (`firebase deploy --only firestore:rules`).
- [ ] Create composite indexes as query patterns are implemented and Firestore's console/CLI flags them as missing (see per-collection "Indexed on" notes in §4–§6 for the expected set: `(type, lifecycleState, order)` on `categories`; `lifecycleState` and `categoryId` on `recurringExpenses`/`recurringIncomes`; `(lifecycleState, date)`, `(categoryId, date)` on both `expenses`/`incomes`, plus `(recurringExpenseId, paid, date)` on `expenses` and `(recurringIncomeId, paid, date)` on `incomes`).

---

## 15. Change log

- **1.0 (2026-07-07):** Initial approved model for Stage 1.
- **1.1 (2026-07-07):** Added TTL deployment note (§7) and deployment checklist (§13) — `purgeAt` requires manually enabling a Firestore TTL policy per collection; this isn't created automatically by rules or app code.
- **1.2 (2026-07-07):** Fixed §6 field scoping, caught while writing `src/types/firestore.ts` — `amount` was mistakenly tagged "(expenses only)" (incomes need it too, to record the received/expected amount); `paid`/`paidDate` were untagged and read as shared, but income has no paid/unpaid concept (FR-5c's editable `date` already covers "when income arrived").
- **1.3 (2026-07-07):** SRS FR-5c updated to add a paid/received toggle for income (projection support — expected vs. actually received). `paid`/`paidDate` now apply to `incomes` too, mirroring `expenses` exactly; `date` on income is redefined as the expected/due date only, distinct from `paidDate`. Supersedes 1.2's income-has-no-paid-gate note.
- **1.4 (2026-07-07):** Doc cleanup — fixed section numbering (skipped straight from §11 to old §13, no §12; renumbered to §12/§13). Added the `(recurringIncomeId, paid, date)` index note alongside the existing `(recurringExpenseId, paid, date)` one in §6 and §12, for consistency now that `incomes` carries `paid` too (v1.3) — not queried by anything yet.
- **1.5 (2026-07-11):** SRS §11 roadmap change inserted a new Stage 8 (Payments Dashboard) ahead of the former Stage 8 (Auth), pushing everything after it back by one. Added `skipped`/`skippedAt` fields to §6, scoped to `kind === 'recurringInstance'` only on `expenses`/`incomes` (not one-time records, not the recurring definitions themselves) — orthogonal to `paid`/`paidDate` the same way those are orthogonal to `lifecycleState`. Added new §12 documenting the Payments Dashboard's three-group, cycle-based grouping/sort rule (renumbering old §12/§13 Deployment checklist/Change log to §13/§14) — no new collections, no new Firestore indexes; the dashboard is a client-side merge of the already-fully-synced `expenses`/`incomes` listeners.
- **1.6 (2026-09-07):** Added SRS §6.10 (FR-21–FR-21f) and new §11 documenting Stage 18 (expense grouping) — `parentExpenseId` on `expenses` (§6) and `defaultParentRecurringExpenseId` on `recurringExpenses` (§5), single-level, expenses-only. No new collection or Firestore index; cascade/subtotal logic runs client-side against already-synced listener state, same pattern as §7/§13. Cross-referenced from §7 (Archive/Trash — cascade-or-detach confirmation for a parent with active children) and flagged one open question in §12 (whether restoring a cascade-archived parent should also restore its children) to confirm with the user before that part is built. Renumbered old §11–§14 to §12–§15 to make room.
- **1.7 (2026-09-07):** Resolved 1.6's open question — confirmed with the user that restoring a parent also restores any child still sitting in a non-`'active'` `lifecycleState` under it, each through its own existing per-record restore logic (§7). Added SRS FR-21g. Removed the now-resolved item from §12's open-decisions list.
