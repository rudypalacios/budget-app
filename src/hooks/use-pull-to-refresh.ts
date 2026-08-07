import { useCallback, useState } from 'react';

// Mostly a visual refresh affordance for ScreenScroll's pull-to-refresh —
// the underlying Firestore onSnapshot listeners are already always live (see
// useSyncStatus), so there's no new fetch to wait on for the data itself.
// `onPull`, when passed, is the one exception: it lets a screen hook a real
// action to the pull gesture (recurring-instance catch-up generation is the
// only current use — see (tabs)/index.tsx, expenses.tsx, income.tsx,
// history.tsx — since that scan previously only ever ran at app launch, so
// pulling to refresh looked like it did nothing per user feedback). Either
// way this still gives the pull gesture a brief, visible resolution so it
// doesn't feel like a no-op.
export function usePullToRefresh(onPull?: () => void, delayMs = 500) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    onPull?.();
    setTimeout(() => setRefreshing(false), delayMs);
  }, [onPull, delayMs]);

  return { refreshing, onRefresh };
}
