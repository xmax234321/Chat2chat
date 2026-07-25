import { useEffect, useRef, useState } from 'react';
import { ChatAttachButton } from './ChatAttachButton';
import { ChatInputBar } from './ChatInputBar';
import { ChatSendButton } from './ChatSendButton';
import { DevicePermissionSheet } from './DevicePermissionSheet';
import { VoiceRecordOverlay } from './VoiceRecordOverlay';
import { VoiceRecordPreview } from './VoiceRecordPreview';
import { useVoiceHoldRecord } from '../hooks/useVoiceHoldRecord';
import { loadChatDraft, saveChatDraft } from '../lib/chat-drafts';
import type { MessageReplyRef } from '../lib/message-reply';
import type { PickedMedia } from '../lib/pick-media';

type Props = {
  chatId: string;
  disabled?: boolean;
  replyTo?: MessageReplyRef | null;
  onClearReply?: () => void;
  onSendText: (body: string, replyTo?: MessageReplyRef) => void | Promise<void>;
  onSendMedia: (media: PickedMedia) => void | Promise<void>;
  onError: (message: string) => void;
  onInputFocus?: () => void;
  onBatchSent?: (mediaGroupId: string) => void;
};

export function ChatMessageComposer({
  chatId,
  disabled,
  replyTo,
  onClearReply,
  onSendText,
  onSendMedia,
  onError,
  onInputFocus,
  onBatchSent,
}: Props) {
  const [text, setText] = useState(() => loadChatDraft(chatId));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voice = useVoiceHoldRecord({ disabled, onError });

  const hasText = text.trim().length > 0;
  const showPreview = voice.phase === 'preview' && voice.preview;

  useEffect(() => {
    setText(loadChatDraft(chatId));
  }, [chatId]);

  useEffect(() => {
    saveChatDraft(chatId, text);
  }, [chatId, text]);

  const autoresizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 132);
    el.style.height = `${Math.max(22, next)}px`;
    el.style.overflowY = el.scrollHeight > 132 ? 'auto' : 'hidden';
  };

  useEffect(() => {
    autoresizeTextarea();
  }, [text]);

  const sendText = async () => {
    const body = text.trim();
    if (!body) return;
    const reply = replyTo ?? undefined;
    setText('');
    saveChatDraft(chatId, '');
    onClearReply?.();
    requestAnimationFrame(() => autoresizeTextarea());
    await onSendText(body, reply);
  };

  return (
    <>
      <VoiceRecordOverlay phase={voice.phase} elapsed={voice.elapsed} dragHint={voice.dragHint} />
      <div className="chat-composer-footer">
        {replyTo && (
          <div className="composer-reply-preview">
            <div className="composer-reply-preview-body">
              <strong>{replyTo.senderLabel}</strong>
              <span>{replyTo.preview}</span>
            </div>
            <button type="button" className="composer-reply-preview-close" onClick={onClearReply} aria-label="Cancel reply">
              ×
            </button>
          </div>
        )}
        <ChatInputBar>
          {showPreview && voice.preview ? (
            <VoiceRecordPreview preview={voice.preview} onDelete={voice.discardPreview} />
          ) : (
            <div className="msg-input-wrap">
              <ChatAttachButton
                chatId={chatId}
                disabled={disabled}
                onPicked={onSendMedia}
                onError={onError}
                onBatchSent={onBatchSent}
              />
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Message"
                value={text}
                autoCorrect="on"
                spellCheck
                autoCapitalize="sentences"
                enterKeyHint="enter"
                disabled={voice.isRecording}
                onChange={(e) => {
                  setText(e.target.value);
                  autoresizeTextarea();
                }}
                onFocus={() => {
                  autoresizeTextarea();
                  onInputFocus?.();
                }}
              />
            </div>
          )}
          <ChatSendButton
            hasText={hasText}
            disabled={disabled || voice.sending}
            phase={voice.phase}
            onSendText={() => void sendText()}
            onSendVoice={() => void voice.sendPreview(onSendMedia)}
            onStopLocked={voice.stopLocked}
            onBeginHold={voice.beginHold}
            onDrag={voice.updateDrag}
            onEndHold={voice.endHold}
            consumeSkipClick={voice.consumeSkipClick}
          />
        </ChatInputBar>
      </div>

      <DevicePermissionSheet
        open={voice.micBlocked}
        needs="microphone"
        onClose={voice.dismissMicBlocked}
      />
    </>
  );
}
