import { create } from 'zustand';

export type ToastAction = {
  label: string;
  onPress: () => void;
};

interface ToastState {
  message: string | null;
  actions: ToastAction[];
}

const AUTO_DISMISS_MS = 2500;

export const useToastStore = create<ToastState>(() => ({ message: null, actions: [] }));

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = null;
}

// Fire-and-forget confirmation banner (e.g. "Moved to Trash") for actions
// that have no other visible feedback once their row disappears from the
// list it was in. One message at a time, no queue — a new toast replaces the
// current one. See CLAUDE.md Stage 12 notes for why this is a small custom
// store rather than a toast library.
//
// Presupuesto redesign fase 7: a toast can carry up to two actions (e.g.
// Undo / Edit). A purely informational toast auto-dismisses as before, but
// one with actions stays until the user picks an action or closes it — by
// owner decision, since a timed toast could vanish while they're still
// deciding whether to undo.
export function showToast(message: string, options?: { actions?: ToastAction[] }) {
  clearTimer();
  const actions = options?.actions ?? [];
  useToastStore.setState({ message, actions });
  if (actions.length === 0) {
    dismissTimer = setTimeout(() => {
      useToastStore.setState({ message: null, actions: [] });
      dismissTimer = null;
    }, AUTO_DISMISS_MS);
  }
}

export function hideToast() {
  clearTimer();
  useToastStore.setState({ message: null, actions: [] });
}

// Runs an action and closes the toast it belongs to.
export function runToastAction(action: ToastAction) {
  hideToast();
  action.onPress();
}
