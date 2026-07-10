import type { SyncStatus } from '@/components/sync-status-indicator';
import { useCategoriesStore } from '@/store/categories';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import { useRecurringExpensesStore } from '@/store/recurring-expenses';
import { useRecurringIncomesStore } from '@/store/recurring-incomes';
import { useSessionStore } from '@/store/session';
import { useNetworkStatus } from './use-network-status';

// FR-12a: derives the real sync status from two independent signals that
// must agree before reporting 'offline':
//  - Firestore snapshot metadata (fromCache/hasPendingWrites) across every
//    active collection listener — see src/lib/firebase/firestore.types.ts's
//    SnapshotMeta comment.
//  - Real device connectivity (useNetworkStatus: NetInfo on native,
//    navigator.onLine + online/offline listeners on web).
// fromCache alone can false-positive during a cold-start listener
// attachment while genuinely online, so it's not trusted by itself.
export function useSyncStatus(): SyncStatus {
  const authStatus = useSessionStore((state) => state.status);
  const isOnline = useNetworkStatus();
  const categories = useCategoriesStore((state) => state);
  const expenses = useExpensesStore((state) => state);
  const incomes = useIncomesStore((state) => state);
  const recurringExpenses = useRecurringExpensesStore((state) => state);
  const recurringIncomes = useRecurringIncomesStore((state) => state);

  if (authStatus !== 'ready') return 'pending';

  const collections = [categories, expenses, incomes, recurringExpenses, recurringIncomes];
  if (collections.some((store) => store.isLoading)) return 'pending';
  if (!isOnline && collections.some((store) => store.fromCache)) return 'offline';
  if (collections.some((store) => store.hasPendingWrites)) return 'pending';
  return 'synced';
}
