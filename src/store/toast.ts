import { create } from 'zustand';

interface ToastState {
  message: string | null;
}

const AUTO_DISMISS_MS = 2500;

export const useToastStore = create<ToastState>(() => ({ message: null }));

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

// Fire-and-forget confirmation banner (e.g. "Moved to Trash") for actions
// that have no other visible feedback once their row disappears from the
// list it was in. Deliberately minimal — one message at a time, no queue,
// no action button. See CLAUDE.md Stage 12 notes for why this is a small
// custom store rather than a toast library.
export function showToast(message: string) {
  if (dismissTimer) clearTimeout(dismissTimer);
  useToastStore.setState({ message });
  dismissTimer = setTimeout(() => {
    useToastStore.setState({ message: null });
    dismissTimer = null;
  }, AUTO_DISMISS_MS);
}

export function hideToast() {
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = null;
  useToastStore.setState({ message: null });
}
