import { useEffect, useState } from 'react';
import { isCapacitor } from '../lib/platform';
import { isCellularDataGranted, readCellularDataStatus } from '../lib/cellular-permission';

export function CellularDataBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isCapacitor()) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const { NetworkStatus } = await import('../lib/native-network-status');
        const [status, cellularStatus] = await Promise.all([
          NetworkStatus.getStatus(),
          readCellularDataStatus(),
        ]);
        if (cancelled) return;
        const restricted = !isCellularDataGranted(cellularStatus) || status.cellularRestricted;
        setVisible(Boolean(restricted && !status.wifi));
      } catch {
        if (!cancelled) setVisible(false);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 8000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="cellular-data-banner" role="status">
      <span>Cellular data is off for Chat2chat. Enable it in Settings to use the app outside Wi‑Fi.</span>
    </div>
  );
}
