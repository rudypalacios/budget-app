import { createMockStore } from '@/lib/create-mock-store';
import {
  sampleCategories,
  sampleExpenses,
  sampleIncomes,
  type SampleCategory,
  type SampleExpense,
  type SampleIncome,
} from '@/constants/sample-data';

export const expensesStore = createMockStore<SampleExpense>(sampleExpenses);
export const incomesStore = createMockStore<SampleIncome>(sampleIncomes);
export const categoriesStore = createMockStore<SampleCategory>(sampleCategories);
