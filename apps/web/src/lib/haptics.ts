import { isCapacitor } from './platform';

export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
  if (!isCapacitor()) {
    navigator.vibrate?.(style === 'light' ? 8 : style === 'medium' ? 14 : 22);
    return;
  }
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const map = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    } as const;
    await Haptics.impact({ style: map[style] });
  } catch {
    /* browser / missing plugin */
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!isCapacitor()) {
    navigator.vibrate?.([12, 40, 12]);
    return;
  }
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    /* noop */
  }
}
