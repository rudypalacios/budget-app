import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { addRecurringGroup, useRecurringGroupsStore } from '@/store/recurring-groups';
import { showToast } from '@/store/toast';

const NO_GROUP = '';
const NEW_GROUP = '__new__';

export type RecurringGroupFieldProps = {
  value: string | null;
  onChange: (recurringGroupId: string | null) => void;
};

// Stage 18 redo (FR-21, data-model.md §11) — the "which recurringGroups/{id}
// container is this in" picker, shared by ExpenseForm (creating a new
// recurring definition), RecurringExpenseForm (editing one), and the
// Payments Dashboard's "Add to group…" action — the same three spots the
// old parent/child design's picker appeared in, so this is extracted as one
// component from the start instead of copy-pasted three times.
export function RecurringGroupField({ value, onChange }: RecurringGroupFieldProps) {
  const { t } = useTranslation();
  const groups = useRecurringGroupsStore((state) => state.items).filter(
    (group) => group.lifecycleState === 'active',
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  // Without this, a rejected addRecurringGroup (e.g. a permission error)
  // left the inline form stuck open forever with no feedback — caught live
  // when the recurringGroups Firestore rule was still missing (see
  // firestore.rules).
  const [isSaving, setIsSaving] = useState(false);

  function handleSelect(selected: string) {
    if (selected === NEW_GROUP) {
      setIsCreating(true);
      return;
    }
    onChange(selected === NO_GROUP ? null : selected);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setIsSaving(true);
    try {
      const id = await addRecurringGroup(newName);
      setIsCreating(false);
      setNewName('');
      onChange(id);
    } catch (error) {
      showToast(t('recurringGroups.createFailed'));
      console.warn('[recurring-group-field] addRecurringGroup failed:', error);
    } finally {
      setIsSaving(false);
    }
  }

  if (isCreating) {
    return (
      <View style={styles.row}>
        <TextField
          label={t('recurringGroups.newGroupName')}
          value={newName}
          onChangeText={setNewName}
          placeholder={t('recurringGroups.newGroupNamePlaceholder')}
        />
        <View style={styles.actionRow}>
          <Button label={t('common.save')} onPress={handleCreate} disabled={!newName.trim() || isSaving} />
          <Button
            label={t('common.cancel')}
            variant="secondary"
            onPress={() => setIsCreating(false)}
            disabled={isSaving}
          />
        </View>
      </View>
    );
  }

  return (
    <Select
      label={t('recurringGroups.fieldLabel')}
      value={value ?? NO_GROUP}
      options={[
        { value: NO_GROUP, label: t('recurringGroups.none') },
        ...groups.map((group) => ({ value: group.id, label: group.name })),
        { value: NEW_GROUP, label: t('recurringGroups.newGroup') },
      ]}
      onChange={handleSelect}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
