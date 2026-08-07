// Trimming lives at the write boundary (store add*/update* functions),
// not on every TextField keystroke — trimming while the user is still
// typing a multi-word name (e.g. "Coffee " -> typing "Shop") would eat an
// intentional trailing space mid-composition. This is the single choke
// point every form (and quick-expense.tsx, which bypasses the shared form
// components entirely) funnels through before a name reaches Firestore.
export function trimName(value: string): string {
  return value.trim();
}
