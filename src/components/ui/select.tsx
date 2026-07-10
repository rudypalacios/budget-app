import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FloatingPanel, type AnchorRect } from '@/components/ui/floating-panel';
import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
};

export type SelectProps<T extends string> = {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
};

export function Select<T extends string>({ label, value, options, onChange }: SelectProps<T>) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [hoveredValue, setHoveredValue] = useState<T | null>(null);
  const triggerRef = useRef<View>(null);
  const selected = options.find((option) => option.value === value);

  function openMenu() {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setIsOpen(true);
    });
  }

  return (
    <View>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label }}
        accessibilityState={{ expanded: isOpen }}
        style={[styles.field, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
      >
        <ThemedText>{selected?.label ?? 'Select…'}</ThemedText>
        <ThemedText themeColor="textSecondary">{isOpen ? '▴' : '▾'}</ThemedText>
      </Pressable>

      <FloatingPanel isOpen={isOpen} onClose={() => setIsOpen(false)} anchor={anchor}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              onChange(option.value);
              setIsOpen(false);
            }}
            onHoverIn={() => setHoveredValue(option.value)}
            onHoverOut={() => setHoveredValue(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: option.value === value }}
            style={[
              styles.option,
              { backgroundColor: hoveredValue === option.value ? theme.backgroundSelected : 'transparent' },
            ]}
          >
            <ThemedText themeColor={option.value === value ? 'tint' : 'text'}>{option.label}</ThemedText>
          </Pressable>
        ))}
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
  option: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
});
