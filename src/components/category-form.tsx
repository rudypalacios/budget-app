import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';

const TYPES = ['expense', 'income', 'both'] as const;

export type CategoryFormValues = {
  name: string;
  type: (typeof TYPES)[number];
};

export type CategoryFormProps = {
  initialValues?: CategoryFormValues;
  submitLabel: string;
  onSubmit: (values: CategoryFormValues) => void | Promise<void>;
  onCancel: () => void;
};

const DEFAULT_VALUES: CategoryFormValues = {
  name: '',
  type: 'expense',
};

export function CategoryForm({ initialValues, submitLabel, onSubmit, onCancel }: CategoryFormProps) {
  const [values, setValues] = useState<CategoryFormValues>(initialValues ?? DEFAULT_VALUES);

  const isValid = !!values.name;

  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextField
        label="Name"
        value={values.name}
        onChangeText={(name) => setValues((current) => ({ ...current, name }))}
        placeholder="e.g. Subscriptions"
      />

      <ThemedText type="smallBold" themeColor="textSecondary">
        Appears in
      </ThemedText>
      <View style={styles.chipRow}>
        {TYPES.map((option) => (
          <Pressable key={option} onPress={() => setValues((current) => ({ ...current, type: option }))}>
            <Chip label={option} tone={values.type === option ? 'success' : 'neutral'} />
          </Pressable>
        ))}
      </View>

      <View style={styles.actionRow}>
        <Button label={submitLabel} onPress={handleSave} disabled={!isValid} style={styles.actionButton} />
        <Button
          label="Cancel"
          variant="secondary"
          onPress={onCancel}
          disabled={isSaving}
          style={styles.actionButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
});
