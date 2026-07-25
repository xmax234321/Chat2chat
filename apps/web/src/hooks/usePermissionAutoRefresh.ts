import { useEffect, useRef } from 'react';
import { isCapacitor } from '../lib/platform';

const REFRESH_MS = 800;

function scheduleRefresh(refresh: () => void | Promise<void>) {
  void refresh();
  window.setTimeout(() => void refresh(), 250);
  window.setTimeout(() => void refresh(), 700);
}

/** Poll + resume/visibility/focus hooks so permission rows update after iOS dialogs or Settings. */
export function usePermissionAutoRefresh(enabled: boolean, refresh: () => void | Promise<void>) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      void refreshRef.current();
    };

    scheduleRefresh(run);

    const interval = window.setInterval(run, REFRESH_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefresh(run);
    };
    document.addEventListener('visibilitychange', onVisible);

    const onFocus = () => scheduleRefresh(run);
    window.addEventListener('focus', onFocus);

    const onPageShow = () => scheduleRefresh(run);
    window.addEventListener('pageshow', onPageShow);

    let resumeListener: { remove: () => void } | undefined;
    if (isCapacitor()) {
      void import('@capacitor/app')
        .then(({ App }) =>
          App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) scheduleRefresh(run);
          }),
        )
        .then((listener) => {
          resumeListener = listener;
        })
        .catch(() => {});
    }

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
      resumeListener?.remove();
    };
  }, [enabled]);
}
