import { useEffect, useState } from 'react';

// Real browser-level connectivity signal, combined with Firestore snapshot
// metadata in useSyncStatus so "offline" doesn't rely on Firestore's
// fromCache alone (which can false-positive during a cold-start listener
// attachment while genuinely online).
export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    function update() {
      setIsOnline(navigator.onLine);
    }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return isOnline;
}
