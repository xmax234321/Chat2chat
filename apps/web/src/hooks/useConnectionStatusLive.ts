import { useEffect } from 'react';
import { useApp } from '../store/AppContext';

/** Keep connection status frozen while this screen is not mounted. */
export function useConnectionStatusLive(): void {
  const { setConnectionStatusLive } = useApp();
  useEffect(() => {
    setConnectionStatusLive(true);
    return () => setConnectionStatusLive(false);
  }, [setConnectionStatusLive]);
}
