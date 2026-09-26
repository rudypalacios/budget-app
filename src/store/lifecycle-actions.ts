import { updateCategory } from './categories';
import { purgeExpense, restoreExpense, trashExpense, unarchiveExpense } from './expenses';
import { purgeIncome, restoreIncome, trashIncome, unarchiveIncome } from './incomes';
import { runRecurringGeneration } from './recurring-generation';
import {
  purgeRecurringExpense,
  restoreRecurringExpense,
  trashRecurringExpense,
  unarchiveRecurringExpense,
} from './recurring-expenses';
import { unarchiveRecurringGroup } from './recurring-groups';
import {
  purgeRecurringIncome,
  restoreRecurringIncome,
  trashRecurringIncome,
  unarchiveRecurringIncome,
} from './recurring-incomes';
import type { LifecycleRecordType, TrashableRecordType } from '@/lib/lifecycle-records';

// Stage 17: dispatch layer for the Archive/Trash screens, which only know a
// row's generic LifecycleRecordType, not which of the four/five per-collection
// store modules to call. Kept here (store/, not lib/) since it orchestrates
// other stores' actions rather than being pure logic — see
// src/lib/lifecycle-records.ts for the pure collection/filtering side.

// Archive screen's Restore: archived -> active. Recurring definitions
// additionally resume instance generation immediately (same reason as
// restoreLifecycleRecord below).
export async function unarchiveLifecycleRecord(
  recordType: LifecycleRecordType,
  id: string,
  uid: string,
): Promise<void> {
  switch (recordType) {
    case 'expense':
      await unarchiveExpense(id);
      return;
    case 'income':
      await unarchiveIncome(id);
      return;
    case 'recurringExpense':
      await unarchiveRecurringExpense(id);
      await runRecurringGeneration(uid);
      return;
    case 'recurringIncome':
      await unarchiveRecurringIncome(id);
      await runRecurringGeneration(uid);
      return;
    case 'category':
      await updateCategory(id, { lifecycleState: 'active' });
      return;
    case 'recurringGroup':
      await unarchiveRecurringGroup(id);
      return;
  }
}

// Trash screen's Restore. This can land a record back in either 'active'
// or 'archived' — whatever trashedFromState was (see restoreTransition) —
// never assume 'active'. Recurring definitions additionally resume instance
// generation immediately: restoreX only flips Firestore fields, and without
// this the generator wouldn't notice a missed period until the next
// app-foreground/launch/reconnect scan (same immediate-generation call the
// "create a new definition" screens already make — see
// recurring-generation.ts's top comment).
export async function restoreLifecycleRecord(
  recordType: TrashableRecordType,
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
  }
}

// Archive screen's "Move to Trash" action — only TrashableRecordType:
// categories and recurring groups never go to the Trash (see that type). trashX reads the
// record's current lifecycleState itself (always 'archived' for a caller
// coming from the Archive screen) to stamp trashedFromState correctly, so
// no extra state needs to be threaded through here.
export async function trashLifecycleRecord(
  recordType: TrashableRecordType,
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

// Trash screen only — see TrashableRecordType for which types can be here.
export async function purgeLifecycleRecord(
  recordType: TrashableRecordType,
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
