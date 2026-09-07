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
export function trashTransition(from: ArchivableState, now: Date, trashRetentionDays: number): TrashableLifecycle {
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

// Exported so every restoreX() store function (expenses.ts, incomes.ts,
// recurring-expenses.ts, recurring-incomes.ts) can cast a store snapshot to
// this shape once, from one shared definition, instead of each redefining
// the identical type locally.
export type RestorableRecord = {
  lifecycleState: 'archived' | 'trashed';
  trashedFromState: ArchivableState | null;
  archivedAt: TrashableLifecycle['archivedAt'];
};

// Restores a currently archived-or-trashed record. Two cases:
// - trashed -> its trashedFromState (active or archived), clearing the
//   trash fields. archivedAt is preserved when restoring to 'archived' (it
//   was set by trashTransition above) and cleared when restoring to
//   'active'.
// - archived (never trashed) -> active directly, clearing archivedAt.
// Bug fix: previously this function only handled the trashed case (took
// `trashedFromState`/`archivedAt` directly, so a caller had no way to ask
// for the archived->active case), which meant every restoreX() store
// function threw for a merely-archived record — restoring from the Archive
// screen threw at runtime for every expense/income/recurring definition
// (categories were unaffected, they never went through restoreX at all).
// Caught while building Stage 18's restore cascade (FR-21g), which needed
// this path to actually work.
export function restoreTransition(current: RestorableRecord): TrashableLifecycle {
  if (current.lifecycleState === 'trashed') {
    if (!current.trashedFromState) {
      throw new Error('restoreTransition: trashed record is missing trashedFromState');
    }
    return {
      lifecycleState: current.trashedFromState,
      trashedFromState: null,
      archivedAt: current.trashedFromState === 'archived' ? current.archivedAt : null,
      trashedAt: null,
      purgeAt: null,
    };
  }
  return {
    lifecycleState: 'active',
    trashedFromState: null,
    archivedAt: null,
    trashedAt: null,
    purgeAt: null,
  };
}
