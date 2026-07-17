import { useCallback, useState } from 'react';

// Visual-only refresh affordance for ScreenScroll's pull-to-refresh — the
// underlying Firestore onSnapshot listeners are already always live (see
// useSyncStatus), so there's no new fetch to wait on. This just gives the
// pull gesture a brief, visible resolution so it doesn't feel like a no-op.
export function usePullToRefresh(delayMs = 500) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), delayMs);
  }, [delayMs]);

  return { refreshing, onRefresh };
}
