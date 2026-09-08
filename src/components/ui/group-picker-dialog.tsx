import { useTranslation } from 'react-i18next';

import { RecurringGroupField } from '@/components/recurring-group-field';
import { Dialog } from '@/components/ui/dialog';

export type GroupPickerDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  value: string | null;
  onSelect: (recurringGroupId: string | null) => void;
};

// Stage 18 redo (FR-21, data-model.md §11) — the Payments Dashboard's
// "Grupo…" row action. A thin Dialog shell around RecurringGroupField (the
// same picker ExpenseForm/RecurringExpenseForm use) so "create a new group
// inline" isn't implemented a third time — selecting anything (including
// "Ninguno") applies immediately and closes.
export function GroupPickerDialog({ isOpen, onClose, value, onSelect }: GroupPickerDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t('recurringGroups.pickerTitle')}>
      <RecurringGroupField
        value={value}
        onChange={(recurringGroupId) => {
          onSelect(recurringGroupId);
          onClose();
        }}
      />
    </Dialog>
  );
}
