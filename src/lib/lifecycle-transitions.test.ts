import { archiveTransition, restoreTransition, trashTransition } from './lifecycle-transitions';
import type { Timestamp } from '@/types/firestore';

// toTimestamp() (src/lib/timestamp.ts) is a type-only cast — at runtime the
// value is still a plain Date until it round-trips through an actual
// Firestore write, so these assertions compare directly against Date rather
// than calling the real Timestamp class's .toDate().
function asDate(value: Timestamp | null): Date | null {
  return value as unknown as Date | null;
}

describe('archiveTransition', () => {
  it('sets lifecycleState to archived, archivedAt to now, and clears trash fields', () => {
    const now = new Date(2026, 5, 1);
    const result = archiveTransition(now);

    expect(result.lifecycleState).toBe('archived');
    expect(asDate(result.archivedAt)).toEqual(now);
    expect(result.trashedFromState).toBeNull();
    expect(result.trashedAt).toBeNull();
    expect(result.purgeAt).toBeNull();
  });
});

describe('trashTransition', () => {
  it('captures the given state as trashedFromState and sets trashedAt to now', () => {
    const now = new Date(2026, 5, 1);
    const result = trashTransition('active', now, 30);

    expect(result.lifecycleState).toBe('trashed');
    expect(result.trashedFromState).toBe('active');
    expect(asDate(result.trashedAt)).toEqual(now);
  });

  it('computes purgeAt as exactly trashRetentionDays after now', () => {
    const now = new Date(2026, 5, 1);
    const result = trashTransition('active', now, 30);

    expect(asDate(result.purgeAt)).toEqual(new Date(2026, 5, 31));
  });

  it('preserves archivedAt when trashing an already-archived record', () => {
    const now = new Date(2026, 5, 1);
    const result = trashTransition('archived', now, 30);

    expect(asDate(result.archivedAt)).toEqual(now);
  });

  it('leaves archivedAt null when trashing an active (never-archived) record', () => {
    const now = new Date(2026, 5, 1);
    const result = trashTransition('active', now, 30);

    expect(result.archivedAt).toBeNull();
  });
});

describe('restoreTransition', () => {
  it('restores to active and clears trash fields, with archivedAt null', () => {
    const result = restoreTransition('active', null);

    expect(result.lifecycleState).toBe('active');
    expect(result.trashedFromState).toBeNull();
    expect(result.trashedAt).toBeNull();
    expect(result.purgeAt).toBeNull();
    expect(result.archivedAt).toBeNull();
  });

  it('restores to archived and preserves the original archivedAt', () => {
    const originalArchivedAt = new Date(2026, 4, 1) as unknown as Timestamp;
    const result = restoreTransition('archived', originalArchivedAt);

    expect(result.lifecycleState).toBe('archived');
    expect(result.archivedAt).toBe(originalArchivedAt);
    expect(result.trashedFromState).toBeNull();
    expect(result.trashedAt).toBeNull();
    expect(result.purgeAt).toBeNull();
  });
});
