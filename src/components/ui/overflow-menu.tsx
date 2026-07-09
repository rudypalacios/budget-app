import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FloatingPanel, type AnchorRect } from '@/components/ui/floating-panel';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type OverflowMenuItem = {
  label: string;
  onPress: () => void;
};

export type OverflowMenuProps = {
  items: OverflowMenuItem[];
  accessibilityLabel: string;
};

// Structured for a single "Edit" item today, with room to add "Delete" (or
// similar) later without changing the row layout — the kebab's fixed-width
// slot stays put regardless of how many items the menu ends up with.
export function OverflowMenu({ items, accessibilityLabel }: OverflowMenuProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const triggerRef = useRef<View>(null);

  function openMenu() {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setIsOpen(true);
    });
  }

  return (
    <View>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={8}
        style={styles.trigger}
      >
        <ThemedText type="smallBold">⋮</ThemedText>
      </Pressable>

      <FloatingPanel isOpen={isOpen} onClose={() => setIsOpen(false)} anchor={anchor} align="right">
        {items.map((item, index) => (
          <Pressable
            key={item.label}
            onPress={() => {
              setIsOpen(false);
              item.onPress();
            }}
            onHoverIn={() => setHoveredIndex(index)}
            onHoverOut={() => setHoveredIndex(null)}
            accessibilityRole="button"
            style={[
              styles.option,
              { backgroundColor: hoveredIndex === index ? theme.backgroundSelected : 'transparent' },
            ]}
          >
            <ThemedText>{item.label}</ThemedText>
          </Pressable>
        ))}
      </FloatingPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: MinTouchTarget,
    height: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
});
