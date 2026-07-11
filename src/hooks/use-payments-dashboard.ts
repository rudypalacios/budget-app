import { useMemo } from 'react';

import { getCurrentCycleRange } from '@/lib/cycle';
import { buildPaymentRows, groupPaymentRows, type PaymentRowGroups } from '@/lib/payments-dashboard';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';

// Thin store-wiring layer over the pure logic in src/lib/payments-dashboard.ts
// and src/lib/cycle.ts (CLAUDE.md: logic in hooks/store/lib, not components).
// No new listeners/queries — both stores are already fully subscribed
// elsewhere (src/app/_layout.tsx), mirroring history.tsx's merge pattern.
export function usePaymentsDashboard(): PaymentRowGroups {
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);

  return useMemo(() => {
    const rows = buildPaymentRows(expenses, incomes);
    const cycleRange = getCurrentCycleRange();
    return groupPaymentRows(rows, cycleRange);
  }, [expenses, incomes]);
}
