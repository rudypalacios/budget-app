import { toTimestamp } from './timestamp';
import type { ArchivableState, TrashableLifecycle } from '@/types/firestore';

// Pure state-machine math for FR-4a-4e (docs/data-model.md §7), shared by
// every store that carries the full active/archived/trashed lifecycle
// (expenses, incomes, recurringExpenses, recurringIncomes) — kept separate
// from any Firestore call so it's directly unit-testable and so the same
// transition logic isn't rewritten four times.

export function archiveTransition(now: Date): TrashableLifecycle {
  return {
    lifecycleState: 'archived',
    trashedFromState: null,
    archivedAt: toTimestamp(now),
    trashedAt: null,
    purgeAt: null,
  };
}

// `from` is the record's lifecycleState at the moment it's trashed (active
// or archived) — captured as trashedFromState so restoreTransition knows
// where to put it back (FR-4b). archivedAt is preserved only when trashing
// an already-archived record, so a later restore-to-archived still reflects
// when it was originally archived.
export function trashTransition(
  from: ArchivableState,
  now: Date,
  trashRetentionDays: number,
): TrashableLifecycle {
  const purgeDate = new Date(now);
  purgeDate.setDate(purgeDate.getDate() + trashRetentionDays);
  return {
    lifecycleState: 'trashed',
    trashedFromState: from,
    archivedAt: from === 'archived' ? toTimestamp(now) : null,
    trashedAt: toTimestamp(now),
    purgeAt: toTimestamp(purgeDate),
  };
}

// Restores to trashedFromState and clears the trash fields. archivedAt is
// preserved when restoring to 'archived' (it was set by trashTransition
// above) and cleared when restoring to 'active'.
export function restoreTransition(
  trashedFromState: ArchivableState,
  archivedAt: TrashableLifecycle['archivedAt'],
): TrashableLifecycle {
  return {
    lifecycleState: trashedFromState,
    trashedFromState: null,
    archivedAt: trashedFromState === 'archived' ? archivedAt : null,
    trashedAt: null,
    purgeAt: null,
  };
}
