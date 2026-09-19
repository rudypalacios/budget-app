import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { RowDragAndDrop } from '@/hooks/use-row-drag-and-drop';
import { formatCurrency } from '@/lib/format-currency';
import { groupDropTargetId, type GroupableItem } from '@/lib/drag-drop-groups';
import type { GroupSection } from '@/lib/recurring-groups';
import { Spacing } from '@/constants/theme';

// Reanimated needs its own wrapper to animate a Pressable's style — created
// once at module scope, not per-render.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type GroupHeaderProps<T extends GroupableItem> = {
  section: GroupSection<T>;
  expanded: boolean;
  isDropTarget: boolean;
  dragAndDrop: RowDragAndDrop<T>;
  onToggleExpanded: (groupId: string) => void;
  defaultCurrency: string;
};

// Stage 18 follow-up (drag-and-drop grouping); generalized over T
// (Expenses-grouping follow-up) — never touched anything beyond
// section.groupId/name/members.length/subtotal, so this only ever needed
// its type signature to change, not its rendering. A group header is
// always a valid drop target (never a drag *source* itself — the group
// entity has no row of its own to drag), so it doesn't route through
// DraggableRowContainer, which also renders a drag handle.
export function GroupHeaderRow<T extends GroupableItem>({
  section,
  expanded,
  isDropTarget,
  dragAndDrop,
  onToggleExpanded,
  defaultCurrency,
}: GroupHeaderProps<T>) {
  const { t } = useTranslation();
  const theme = useTheme();
  const outerRef = useRef<View>(null);
  const targetId = groupDropTargetId(section.groupId);

  function handleLayout() {
    outerRef.current?.measureInWindow((x, y, width, height) => {
      dragAndDrop.registerTarget(targetId, { x, y, width, height }, { kind: 'groupHeader', groupId: section.groupId });
    });
  }

  // Same livelier-drop-target-response treatment as DraggableRowContainer
  // — a group header is never itself draggable, so there's no competing
  // "isDragging" scale to reconcile with here. This ~3-line
  // useSharedValue/useEffect/withSpring snippet is duplicated rather than
  // shared with draggable-row-container.tsx's own copy — only 2
  // occurrences, under this project's "don't extract until 3+ times"
  // convention.
  const dropTargetScale = useSharedValue(1);
  useEffect(() => {
    dropTargetScale.value = withSpring(isDropTarget ? 1.02 : 1);
  }, [isDropTarget, dropTargetScale]);
  const dropTargetAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: dropTargetScale.value }] }));

  return (
    <View ref={outerRef} onLayout={handleLayout}>
      <AnimatedPressable
        onPress={() => onToggleExpanded(section.groupId)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={t(expanded ? 'recurringGroups.hideMembers' : 'recurringGroups.showMembers', {
          name: section.name,
        })}
        style={[
          styles.groupHeader,
          isDropTarget && {
            backgroundColor: `${theme.tint}26`,
            borderBottomWidth: 3,
            borderBottomColor: theme.tint,
          },
          dropTargetAnimatedStyle,
        ]}
      >
        <View style={styles.groupHeaderMain}>
          <ThemedText type="smallBold">{section.name}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {t('recurringGroups.memberCount', { count: section.members.length })}
          </ThemedText>
        </View>
        <View style={styles.groupHeaderAside}>
          <ThemedText type="smallBold">{formatCurrency(section.subtotal, defaultCurrency)}</ThemedText>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={theme.textSecondary}
            style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}
          />
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Stage 18 redo (FR-21f) — the group header row, same
  // Pressable-with-chevron accordion idiom as category-budget-card.tsx.
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.two,
  },
  groupHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  groupHeaderAside: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
