import { StatusBar, Style } from '@capacitor/status-bar';
import { isIosCapacitor } from './platform';

export type AppearanceMode = 'dark' | 'light';

export function applyAppearance(_mode?: AppearanceMode): void {
  document.documentElement.dataset.theme = 'dark';
  if (isIosCapacitor()) {
    void StatusBar.setStyle({ style: Style.Light });
  }
}
