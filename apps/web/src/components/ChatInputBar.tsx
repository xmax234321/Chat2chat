import type { ReactNode } from 'react';

export function ChatInputBar({ children }: { children: ReactNode }) {
  return <div className="msg-input-bar">{children}</div>;
}
