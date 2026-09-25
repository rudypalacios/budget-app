import { hideToast, runToastAction, showToast, useToastStore } from './toast';

describe('toast store', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    hideToast();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('auto-dismisses an informational toast', () => {
    showToast('Moved to Trash');
    expect(useToastStore.getState().message).toBe('Moved to Trash');
    jest.advanceTimersByTime(2500);
    expect(useToastStore.getState().message).toBeNull();
  });

  it('keeps a toast with actions until the user acts (fase 7)', () => {
    showToast('Updated', { actions: [{ label: 'Undo', onPress: jest.fn() }] });
    jest.advanceTimersByTime(60_000);
    expect(useToastStore.getState().message).toBe('Updated');
  });

  it('runs the action and closes the toast', () => {
    const onPress = jest.fn();
    showToast('Updated', { actions: [{ label: 'Undo', onPress }] });
    runToastAction(useToastStore.getState().actions[0]);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().message).toBeNull();
  });

  it('a new toast replaces the current one, including its actions', () => {
    showToast('Updated', { actions: [{ label: 'Undo', onPress: jest.fn() }] });
    showToast('Saved');
    expect(useToastStore.getState()).toMatchObject({ message: 'Saved', actions: [] });
    jest.advanceTimersByTime(2500);
    expect(useToastStore.getState().message).toBeNull();
  });
});
