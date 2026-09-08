import { useMemo } from 'react';

import { getCurrentCycleRange } from '@/lib/cycle';
import { buildPaymentRows, groupPaymentRows } from '@/lib/payments-dashboard';
import { buildDashboardSections, type DashboardSections } from '@/lib/recurring-groups';
import { useExpensesStore } from '@/store/expenses';
import { useIncomesStore } from '@/store/incomes';
import { useRecurringGroupsStore } from '@/store/recurring-groups';

// Thin store-wiring layer over the pure logic in src/lib/payments-dashboard.ts,
// src/lib/recurring-groups.ts, and src/lib/cycle.ts (CLAUDE.md: logic in
// hooks/store/lib, not components). No new listeners/queries — all three
// stores are already fully subscribed elsewhere (src/app/_layout.tsx),
// mirroring history.tsx's merge pattern.
export function usePaymentsDashboard(): DashboardSections {
  const expenses = useExpensesStore((state) => state.items);
  const incomes = useIncomesStore((state) => state.items);
  const recurringGroups = useRecurringGroupsStore((state) => state.items);

  return useMemo(() => {
    const rows = buildPaymentRows(expenses, incomes);
    const cycleRange = getCurrentCycleRange();
    const buckets = groupPaymentRows(rows, cycleRange);
    const activeGroups = recurringGroups.filter((group) => group.lifecycleState === 'active');
    return buildDashboardSections(buckets, activeGroups);
  }, [expenses, incomes, recurringGroups]);
}
