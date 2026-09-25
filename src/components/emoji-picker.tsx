import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FloatingPanel, type AnchorRect } from '@/components/ui/floating-panel';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Curated preset, not the device's full emoji keyboard — keeps the picker
// scannable and steers toward icons that read well at chip/list size,
// grouped loosely food/home/transport/money/other rather than alphabetized.
const EMOJI_OPTIONS = [
  '🍔',
  '🛒',
  '☕',
  '🍿',
  '🏠',
  '💡',
  '🔧',
  '🛠️',
  '🚗',
  '⛽',
  '🚌',
  '✈️',
  '💰',
  '📈',
  '📉',
  '🧾',
  '🏥',
  '💊',
  '🏋️',
  '👶',
  '👕',
  '🎬',
  '🎮',
  '⚽',
  '📚',
  '🎓',
  '🎵',
  '📱',
  '💻',
  '🎁',
  '🐶',
  '🐾',
] as const;

export type EmojiPickerProps = {
  label: string;
  value: string | null;
  onChange: (emoji: string | null) => void;
};

// Same anchored-trigger + FloatingPanel pattern as Select
// (src/components/ui/select.tsx) — a button that measures its own position
// and opens a positioned grid of emoji options instead of a vertical list.
export function EmojiPicker({ label, value, onChange }: EmojiPickerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const triggerRef = useRef<View>(null);

  function openPicker() {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setIsOpen(true);
    });
  }

  function choose(emoji: string | null) {
    onChange(emoji);
    setIsOpen(false);
  }

  return (
    <View>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        ref={triggerRef}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value ?? t('categories.form.iconNone') }}
        accessibilityState={{ expanded: isOpen }}
        style={[
          styles.field,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ]}
      >
        <ThemedText style={styles.previewText}>{value ?? '—'}</ThemedText>
        <ThemedText themeColor="textSecondary">{isOpen ? '▴' : '▾'}</ThemedText>
      </Pressable>

      <FloatingPanel isOpen={isOpen} onClose={() => setIsOpen(false)} anchor={anchor}>
        <View style={styles.grid}>
          <Pressable
            onPress={() => choose(null)}
            accessibilityRole="button"
            accessibilityLabel={t('categories.form.iconNone')}
            accessibilityState={{ selected: value === null }}
            style={[
              styles.cell,
              { backgroundColor: value === null ? theme.backgroundSelected : 'transparent' },
            ]}
          >
            <ThemedText themeColor="textSecondary">—</ThemedText>
          </Pressable>
          {EMOJI_OPTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => choose(emoji)}
              accessibilityRole="button"
              accessibilityLabel={emoji}
              accessibilityState={{ selected: emoji === value }}
              style={[
                styles.cell,
                { backgroundColor: emoji === value ? theme.backgroundSelected : 'transparent' },
              ]}
            >
              <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
            </Pressable>
          ))}
        </View>
      </FloatingPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: MinTouchTarget,
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewText: {
    fontSize: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: MinTouchTarget * 4,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  cell: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
  emojiText: {
    fontSize: 20,
  },
});
