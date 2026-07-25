import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { readChatScrollCache, writeChatScrollCache } from '../lib/chat-scroll-cache';

type Options = {
  /** When false, skip scroll listeners and active-chat scroll jumps. */
  enabled?: boolean;
  /** Warm thread off-screen (chat list): layout once at bottom, no repeated jumps. */
  prepareOnly?: boolean;
};

export function useChatScroll(threadLength: number, contactId: string, options: Options = {}) {
  const { enabled = true, prepareOnly = false } = options;
  const messagesRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const nearBottomRef = useRef(true);
  const prevLengthRef = useRef(threadLength);
  const prevContactRef = useRef(contactId);
  const restoredRef = useRef(false);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = messagesRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTop = el.scrollHeight;
    }
    nearBottomRef.current = true;
    setShowScrollDown(false);
    writeChatScrollCache(contactId, { top: el.scrollTop, atBottom: true });
  }, [contactId]);

  const updateScrollState = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distance < 96;
    nearBottomRef.current = nearBottom;
    setShowScrollDown(!nearBottom && el.scrollHeight > el.clientHeight + 40);
    writeChatScrollCache(contactId, { top: el.scrollTop, atBottom: nearBottom });
  }, [contactId]);

  const scrollToEnd = useCallback(
    (el: HTMLDivElement) => {
      el.scrollTop = el.scrollHeight;
      nearBottomRef.current = true;
      setShowScrollDown(false);
      writeChatScrollCache(contactId, { top: el.scrollTop, atBottom: true });
    },
    [contactId],
  );

  useEffect(() => {
    restoredRef.current = false;
    const el = messagesRef.current;
    if (!el) return;

    const cached = readChatScrollCache(contactId);
    if (cached && !cached.atBottom && enabled && !prepareOnly) {
      el.scrollTop = cached.top;
      nearBottomRef.current = false;
      restoredRef.current = true;
      updateScrollState();
      return;
    }

    scrollToEnd(el);
    updateScrollState();
  }, [contactId, enabled, prepareOnly, scrollToEnd, updateScrollState]);

  useEffect(() => {
    const contactChanged = prevContactRef.current !== contactId;
    const grew = threadLength > prevLengthRef.current;
    prevContactRef.current = contactId;
    prevLengthRef.current = threadLength;

    if (!enabled || prepareOnly) return;

    if (contactChanged) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToBottom(false));
      });
      return;
    }

    if (grew && nearBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom(false));
    } else {
      requestAnimationFrame(updateScrollState);
    }
  }, [contactId, threadLength, scrollToBottom, updateScrollState, enabled, prepareOnly]);

  useEffect(() => {
    if (!enabled) return;
    const el = messagesRef.current;
    if (!el) return;
    const onScroll = () => updateScrollState();
    el.addEventListener('scroll', onScroll, { passive: true });
    updateScrollState();
    return () => {
      el.removeEventListener('scroll', onScroll);
      writeChatScrollCache(contactId, {
        top: el.scrollTop,
        atBottom: el.scrollHeight - el.scrollTop - el.clientHeight < 96,
      });
    };
  }, [contactId, enabled, updateScrollState]);

  useEffect(() => {
    if (!enabled || prepareOnly) return;
    const el = messagesRef.current;
    if (!el) return;
    const cached = readChatScrollCache(contactId);
    if (cached && !cached.atBottom) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToBottom(false));
    });
  }, [contactId, enabled, prepareOnly, scrollToBottom, threadLength]);

  return {
    messagesRef: messagesRef as RefObject<HTMLDivElement>,
    showScrollDown,
    scrollToBottom,
  };
}
