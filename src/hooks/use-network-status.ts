import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

// Real device-level connectivity signal, combined with Firestore snapshot
// metadata in useSyncStatus so "offline" doesn't rely on Firestore's
// fromCache alone (which can false-positive during a cold-start listener
// attachment while genuinely online).
export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
  }, []);

  return isOnline;
}
