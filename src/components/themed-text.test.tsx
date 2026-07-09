import { render, screen } from '@testing-library/react-native';

import { ThemedText } from './themed-text';

test('renders its children', () => {
  render(<ThemedText>Budget</ThemedText>);
  expect(screen.getByText('Budget')).toBeTruthy();
});
