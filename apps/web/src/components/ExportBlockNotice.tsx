import { useApp } from '../store/AppContext';
import type { ChatMessage } from '../lib/types';

type NoticeContent = Extract<ChatMessage['content'], { kind: 'export_block_notice' }>;

export function ExportBlockNotice({ content }: { content: NoticeContent }) {
  const { identity } = useApp();
  const byLabel = content.byUserId === identity?.userId ? 'you' : content.byAlias;

  return (
    <div className="chat-service-notice" role="status">
      Chat export was blocked by {byLabel}
    </div>
  );
}
