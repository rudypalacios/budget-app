import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormRowBreakpoint, Spacing } from '@/constants/theme';

export type GroupCascadeDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  // 'archive' or 'trash' — picks the title/body copy and the cascade
  // button's variant (trash reuses the same danger tone the Trash screen's
  // permanent-delete confirm uses, since Move to Trash is the more
  // consequential of the two actions).
  transition: 'archive' | 'trash';
  parentName: string;
  childNames: string[];
  onCascade: () => void;
  onDetach: () => void;
};

// Stage 18 (FR-21e, data-model.md §11) — shown instead of a plain
// archive/trash action whenever the target has active children
// (src/lib/expense-grouping.ts's findActiveChildren). Same Dialog shell as
// ConfirmRecordsDialog, but with the group's two real choices — cascade
// vs. detach-then-apply — rather than a single confirm button.
export function GroupCascadeDialog({
  isOpen,
  onClose,
  transition,
  parentName,
  childNames,
  onCascade,
  onDetach,
}: GroupCascadeDialogProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isNarrow = width < FormRowBreakpoint;
  const cascadeVariant: ButtonVariant = transition === 'trash' ? 'danger' : 'primary';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        transition === 'archive'
          ? t('grouping.cascadeArchiveTitle', { name: parentName })
          : t('grouping.cascadeTrashTitle', { name: parentName })
      }
    >
      <ThemedText>
        {t('grouping.cascadeIntro', { count: childNames.length })}
      </ThemedText>
      <View style={styles.list}>
        {childNames.map((name, index) => (
          <ThemedText key={`${name}-${index}`} type="caption">
            {index + 1}. {name}
          </ThemedText>
        ))}
      </View>
      <View style={[styles.actions, isNarrow && styles.actionsNarrow]}>
        <Button
          label={
            transition === 'archive' ? t('grouping.cascadeArchiveAll') : t('grouping.cascadeTrashAll')
          }
          variant={cascadeVariant}
          onPress={() => {
            onCascade();
            onClose();
          }}
          style={isNarrow ? styles.buttonNarrow : styles.button}
        />
        <Button
          label={t('grouping.detachAndApply', { name: parentName })}
          variant="secondary"
          onPress={() => {
            onDetach();
            onClose();
          }}
          style={isNarrow ? styles.buttonNarrow : styles.button}
        />
        <Button
          label={t('common.cancel')}
          variant="ghost"
          onPress={onClose}
          style={isNarrow ? styles.buttonNarrow : styles.button}
        />
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.half,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actionsNarrow: {
    flexDirection: 'column',
  },
  button: {
    flex: 1,
  },
  buttonNarrow: {
    width: '100%',
  },
});
