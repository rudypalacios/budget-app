import { updateCategory } from './categories';
import { purgeExpense, restoreExpense, trashExpense } from './expenses';
import { purgeIncome, restoreIncome, trashIncome } from './incomes';
import { runRecurringGeneration } from './recurring-generation';
import {
  purgeRecurringExpense,
  restoreRecurringExpense,
  trashRecurringExpense,
} from './recurring-expenses';
import {
  purgeRecurringIncome,
  restoreRecurringIncome,
  trashRecurringIncome,
} from './recurring-incomes';
import type { LifecycleRecordType } from '@/lib/lifecycle-records';

// Stage 17: dispatch layer for the Archive/Trash screens, which only know a
// row's generic LifecycleRecordType, not which of the four/five per-collection
// store modules to call. Kept here (store/, not lib/) since it orchestrates
// other stores' actions rather than being pure logic — see
// src/lib/lifecycle-records.ts for the pure collection/filtering side.

// Restores an archived/trashed record. For a trashed record, this can land
// it back in either 'active' or 'archived' — whatever trashedFromState was
// (see restoreTransition) — never assume 'active'. Recurring definitions
// additionally resume instance generation immediately: restoreX only flips
// Firestore fields, and without this the generator wouldn't notice a missed
// period until the next app-foreground/launch/reconnect scan (same
// immediate-generation call the "create a new definition" screens already
// make — see recurring-generation.ts's top comment).
export async function restoreLifecycleRecord(
  recordType: LifecycleRecordType,
  id: string,
  uid: string,
): Promise<void> {
  switch (recordType) {
    case 'expense':
      await restoreExpense(id);
      return;
    case 'income':
      await restoreIncome(id);
      return;
    case 'recurringExpense':
      await restoreRecurringExpense(id);
      await runRecurringGeneration(uid);
      return;
    case 'recurringIncome':
      await restoreRecurringIncome(id);
      await runRecurringGeneration(uid);
      return;
    case 'category':
      await updateCategory(id, { lifecycleState: 'active' });
      return;
  }
}

// Archive screen's "Move to Trash" action — categories can never be
// 'trashed' (see Category.lifecycleState's ArchivableState type), so
// there's deliberately no 'category' case here either. trashX reads the
// record's current lifecycleState itself (always 'archived' for a caller
// coming from the Archive screen) to stamp trashedFromState correctly, so
// no extra state needs to be threaded through here.
export async function trashLifecycleRecord(
  recordType: Exclude<LifecycleRecordType, 'category'>,
  id: string,
): Promise<void> {
  switch (recordType) {
    case 'expense':
      await trashExpense(id);
      return;
    case 'income':
      await trashIncome(id);
      return;
    case 'recurringExpense':
      await trashRecurringExpense(id);
      return;
    case 'recurringIncome':
      await trashRecurringIncome(id);
      return;
  }
}

// Trash screen only — categories can never be 'trashed' (see
// Category.lifecycleState's ArchivableState type), so there's deliberately
// no 'category' case here.
export async function purgeLifecycleRecord(
  recordType: Exclude<LifecycleRecordType, 'category'>,
  id: string,
): Promise<void> {
  switch (recordType) {
    case 'expense':
      await purgeExpense(id);
      return;
    case 'income':
      await purgeIncome(id);
      return;
    case 'recurringExpense':
      await purgeRecurringExpense(id);
      return;
    case 'recurringIncome':
      await purgeRecurringIncome(id);
      return;
  }
}
