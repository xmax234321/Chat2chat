import { useEffect, useState } from 'react';
import { loadChatWallpaper, subscribeChatWallpaper, type ChatWallpaperSettings } from '../lib/chat-wallpaper';

export function useChatWallpaper(): ChatWallpaperSettings {
  const [wallpaper, setWallpaper] = useState<ChatWallpaperSettings>({ imageDataUrl: '', blur: 12, chromeColor: '#0b0b0c' });

  useEffect(() => {
    let cancelled = false;
    void loadChatWallpaper().then((next) => {
      if (!cancelled) setWallpaper(next);
    });
    return subscribeChatWallpaper(() => {
      void loadChatWallpaper().then((next) => {
        if (!cancelled) setWallpaper(next);
      });
    });
  }, []);

  return wallpaper;
}
