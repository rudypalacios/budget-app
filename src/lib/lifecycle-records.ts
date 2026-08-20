import type { WithId } from '@/lib/firebase/firestore.types';
import type {
  Category,
  ExpenseRecord,
  IncomeRecord,
  RecurringExpense,
  RecurringIncome,
  Timestamp,
} from '@/types/firestore';

// Stage 17: the browse/restore/purge screens that finally consume Stage 12's
// archive/trash engine. Pure collection/formatting logic only — no Firestore
// calls here, so this stays directly unit-testable (see the store wiring in
// src/store/lifecycle-actions.ts for the restore/purge dispatch that
// actually calls the per-collection store functions).

export type LifecycleRecordType = 'expense' | 'income' | 'recurringExpense' | 'recurringIncome' | 'category';

export type LifecycleRecord = {
  recordType: LifecycleRecordType;
  id: string;
  name: string;
  // archivedAt (Archive screen) or trashedAt (Trash screen) — whichever
  // collectXRecords below was asked for.
  statusDate: Date;
  // Trash screen only; always null for an archived record.
  purgeAt: Date | null;
};

type WithLifecycle = { id: string; name: string; lifecycleState: string };

function isArchived(item: WithLifecycle): boolean {
  return item.lifecycleState === 'archived';
}

function isTrashed(item: WithLifecycle): boolean {
  return item.lifecycleState === 'trashed';
}

// archivedAt/trashedAt are nullable on TrashableLifecycle's type even though
// archiveTransition/trashTransition (src/lib/lifecycle-transitions.ts)
// always set them when flipping to that state — falling back to updatedAt
// instead of a non-null assertion keeps this honest against that wider type.
function archivedDate(item: { archivedAt: Timestamp | null; updatedAt: Timestamp }): Date {
  return (item.archivedAt ?? item.updatedAt).toDate();
}

function trashedDate(item: { trashedAt: Timestamp | null; updatedAt: Timestamp }): Date {
  return (item.trashedAt ?? item.updatedAt).toDate();
}

function sortByStatusDateDesc(records: LifecycleRecord[]): LifecycleRecord[] {
  return [...records].sort((a, b) => b.statusDate.getTime() - a.statusDate.getTime());
}

// Categories have no archivedAt field at all (Category.lifecycleState is
// ArchivableState — active/archived only, no dedicated timestamp per
// src/types/firestore.ts) — updatedAt is the closest available signal for
// "when this was archived", since the only way lifecycleState changes today
// is the archive toggle itself.
export function collectArchivedRecords(
  expenses: WithId<ExpenseRecord>[],
  incomes: WithId<IncomeRecord>[],
  recurringExpenses: WithId<RecurringExpense>[],
  recurringIncomes: WithId<RecurringIncome>[],
  categories: WithId<Category>[],
): LifecycleRecord[] {
  const records: LifecycleRecord[] = [
    ...expenses.filter(isArchived).map((item) => ({
      recordType: 'expense' as const,
      id: item.id,
      name: item.name,
      statusDate: archivedDate(item),
      purgeAt: null,
    })),
    ...incomes.filter(isArchived).map((item) => ({
      recordType: 'income' as const,
      id: item.id,
      name: item.name,
      statusDate: archivedDate(item),
      purgeAt: null,
    })),
    ...recurringExpenses.filter(isArchived).map((item) => ({
      recordType: 'recurringExpense' as const,
      id: item.id,
      name: item.name,
      statusDate: archivedDate(item),
      purgeAt: null,
    })),
    ...recurringIncomes.filter(isArchived).map((item) => ({
      recordType: 'recurringIncome' as const,
      id: item.id,
      name: item.name,
      statusDate: archivedDate(item),
      purgeAt: null,
    })),
    ...categories.filter(isArchived).map((item) => ({
      recordType: 'category' as const,
      id: item.id,
      name: item.name,
      statusDate: item.updatedAt.toDate(),
      purgeAt: null,
    })),
  ];
  return sortByStatusDateDesc(records);
}

// Categories are deliberately excluded — Category.lifecycleState can't
// express 'trashed' at all (see the comment above), so there's nothing to
// collect for that type here.
export function collectTrashedRecords(
  expenses: WithId<ExpenseRecord>[],
  incomes: WithId<IncomeRecord>[],
  recurringExpenses: WithId<RecurringExpense>[],
  recurringIncomes: WithId<RecurringIncome>[],
): LifecycleRecord[] {
  const records: LifecycleRecord[] = [
    ...expenses.filter(isTrashed).map((item) => ({
      recordType: 'expense' as const,
      id: item.id,
      name: item.name,
      statusDate: trashedDate(item),
      purgeAt: item.purgeAt?.toDate() ?? null,
    })),
    ...incomes.filter(isTrashed).map((item) => ({
      recordType: 'income' as const,
      id: item.id,
      name: item.name,
      statusDate: trashedDate(item),
      purgeAt: item.purgeAt?.toDate() ?? null,
    })),
    ...recurringExpenses.filter(isTrashed).map((item) => ({
      recordType: 'recurringExpense' as const,
      id: item.id,
      name: item.name,
      statusDate: trashedDate(item),
      purgeAt: item.purgeAt?.toDate() ?? null,
    })),
    ...recurringIncomes.filter(isTrashed).map((item) => ({
      recordType: 'recurringIncome' as const,
      id: item.id,
      name: item.name,
      statusDate: trashedDate(item),
      purgeAt: item.purgeAt?.toDate() ?? null,
    })),
  ];
  return sortByStatusDateDesc(records);
}

// Whole days remaining until purgeAt, rounded up — 1 means "less than a day
// left", 0 or negative means it's already due (TTL not yet enabled in
// production, see CLAUDE.md Known Issues, so a manual purge is still the
// only thing that actually removes it once this reaches zero).
export function daysUntilPurge(purgeAt: Date, now: Date = new Date()): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((purgeAt.getTime() - now.getTime()) / msPerDay);
}

export type CanDeleteCategoryResult = {
  allowed: boolean;
  // Total records across all four collections and every lifecycle state
  // (active, archived, trashed-but-not-yet-purged) that still reference
  // this categoryId — a trashed-but-not-purged record is historical data
  // that still needs a valid category to point to, so it counts as a
  // blocker too, same as an active one.
  blockingCount: number;
};

export function canDeleteCategory(
  categoryId: string,
  expenses: WithId<ExpenseRecord>[],
  incomes: WithId<IncomeRecord>[],
  recurringExpenses: WithId<RecurringExpense>[],
  recurringIncomes: WithId<RecurringIncome>[],
): CanDeleteCategoryResult {
  const blockingCount =
    expenses.filter((item) => item.categoryId === categoryId).length +
    incomes.filter((item) => item.categoryId === categoryId).length +
    recurringExpenses.filter((item) => item.categoryId === categoryId).length +
    recurringIncomes.filter((item) => item.categoryId === categoryId).length;

  return { allowed: blockingCount === 0, blockingCount };
}
