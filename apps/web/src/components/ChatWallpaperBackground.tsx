import { useChatWallpaper } from '../hooks/useChatWallpaper';

export function ChatWallpaperBackground() {
  const { imageDataUrl, blur } = useChatWallpaper();
  if (!imageDataUrl) return null;

  return (
    <div
      className="chat-wallpaper-bg"
      aria-hidden
      style={{
        backgroundImage: `url(${imageDataUrl})`,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
      }}
    />
  );
}
