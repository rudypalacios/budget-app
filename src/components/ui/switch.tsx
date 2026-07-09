import { Platform, Switch as RNSwitch } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type SwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

export function Switch({ value, onValueChange, accessibilityLabel, disabled }: SwitchProps) {
  const theme = useTheme();

  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: theme.backgroundSelected, true: theme.tint }}
      thumbColor={Platform.OS === 'android' ? theme.background : undefined}
      ios_backgroundColor={theme.backgroundSelected}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
    />
  );
}
