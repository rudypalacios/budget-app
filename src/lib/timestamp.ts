import type { Timestamp } from '@/types/firestore';

// Firestore write paths accept a plain JS Date for a Timestamp field and
// convert it automatically — this cast just satisfies our structural
// Timestamp type (see src/types/firestore.ts) on the way in. Reads always
// come back as a real Timestamp instance, no cast needed there.
export function toTimestamp(date: Date): Timestamp {
  return date as unknown as Timestamp;
}
