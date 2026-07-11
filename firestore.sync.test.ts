// Stage 7 — validates NFR-6 (last-write-wins conflict resolution) through
// this app's actual write path (plain updateDoc/setDoc, no transactions —
// confirmed nowhere in src/store/ uses runTransaction/writeBatch/merge
// options). Real cross-device testing isn't possible through the app UI yet
// (anonymous auth is per-browser-profile, so two browser profiles get two
// separate uids with separate data — see CLAUDE.md Known Issues). The
// emulator lets two independent authenticated contexts intentionally share
// one uid, which is exactly what simulates "two devices, same account"
// ahead of Stage 8 linking a real credential.
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

let testEnv: RulesTestEnvironment;

const OWNER_UID = 'sync-test-owner-uid';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'sync-test-lighthouse-budget-app',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe('NFR-6: last-write-wins when the same document is edited from two clients on one account', () => {
  const path = `users/${OWNER_UID}/categories/cat1`;
  const baseDoc = { name: 'Groceries', type: 'expense', lifecycleState: 'active' };

  test('two clients editing the SAME field — whichever write commits last wins that field', async () => {
    await seed(path, baseDoc);

    // Two independent authenticated contexts for the same uid — simulates
    // two devices on one account, which the real app can't do yet (see
    // file header), but the emulator can.
    const deviceA = testEnv.authenticatedContext(OWNER_UID).firestore();
    const deviceB = testEnv.authenticatedContext(OWNER_UID).firestore();

    await updateDoc(doc(deviceA, path), { name: 'Groceries (edited on device A)' });
    await updateDoc(doc(deviceB, path), { name: 'Groceries (edited on device B)' });

    const finalDoc = await getDoc(doc(deviceA, path));
    // Device B's write committed last, so it wins — no error, no merge
    // conflict, no partial corruption of the field.
    expect(finalDoc.data()?.name).toBe('Groceries (edited on device B)');
  });

  test('two clients editing DIFFERENT fields — both edits survive (partial-merge updateDoc, not a whole-document overwrite)', async () => {
    await seed(path, baseDoc);

    const deviceA = testEnv.authenticatedContext(OWNER_UID).firestore();
    const deviceB = testEnv.authenticatedContext(OWNER_UID).firestore();

    // e.g. device A renames the category while device B (having been
    // offline) reconnects and flushes a queued type change.
    await updateDoc(doc(deviceA, path), { name: 'Household' });
    await updateDoc(doc(deviceB, path), { type: 'both' });

    const finalDoc = await getDoc(doc(deviceA, path));
    // This app's write path uses plain updateDoc (a field-level merge, per
    // src/store/create-collection-store.ts), never a full-document setDoc
    // overwrite for edits — so an unrelated field changed by the other
    // client isn't clobbered. This is stronger than a naive whole-document
    // last-write-wins would give, and worth confirming explicitly rather
    // than assuming from the NFR-6 wording alone.
    expect(finalDoc.data()).toEqual({ name: 'Household', type: 'both', lifecycleState: 'active' });
  });
});
