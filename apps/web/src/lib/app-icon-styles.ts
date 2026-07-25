export type AppIconStyle = 'mono-dark' | 'mono-light';

export const APP_ICON_STYLES: AppIconStyle[] = ['mono-dark', 'mono-light'];

export const APP_ICON_STYLE_LABELS: Record<AppIconStyle, string> = {
  'mono-dark': 'Mono Dark',
  'mono-light': 'Mono Light',
};

/** iOS UIApplication alternate icon name; null = primary (mono-dark). */
export function iosAlternateIconName(style: AppIconStyle): string | null {
  return style === 'mono-light' ? 'MonoLightIcon' : null;
}

export function appIconStyleFromIosName(name: string | null | undefined): AppIconStyle {
  return name === 'MonoLightIcon' ? 'mono-light' : 'mono-dark';
}
