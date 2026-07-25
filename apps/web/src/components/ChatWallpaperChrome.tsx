import type { CSSProperties, ReactNode } from 'react';
import { useChatWallpaper } from '../hooks/useChatWallpaper';

/** Applies wallpaper chrome color to header + composer via CSS variables. */
export function ChatWallpaperChrome({ children }: { children: ReactNode }) {
  const { imageDataUrl, chromeColor } = useChatWallpaper();
  const active = Boolean(imageDataUrl);

  return (
    <div
      className={`chat-screen-chrome${active ? ' chat-screen--wallpaper' : ''}`}
      style={
        active
          ? ({ '--chat-chrome-bg': chromeColor || '#0b0b0c' } as CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}
