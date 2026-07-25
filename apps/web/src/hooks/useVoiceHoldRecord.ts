import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceRecorder, recordedVoiceToPickedMedia } from '../lib/record-voice';
import type { PickedMedia } from '../lib/pick-media';
import {
  isDevicePermissionGranted,
  readMicrophonePermissionStatus,
  requestMicrophonePermission,
} from '../lib/device-permissions';

export type VoiceRecordPhase = 'idle' | 'arming' | 'holding' | 'locked' | 'preview';
export type VoiceDragHint = 'none' | 'lock' | 'cancel';

const LOCK_DRAG_Y = 72;
const CANCEL_DRAG_X = 72;
const MIN_RECORD_MS = 500;

export function formatRecordMs(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Options = {
  disabled?: boolean;
  onError: (message: string) => void;
};

export function useVoiceHoldRecord({ disabled, onError }: Options) {
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const skipClickRef = useRef(false);
  const startingRef = useRef(false);
  const wantRecordingRef = useRef(false);
  const fingerDownRef = useRef(false);

  const [phase, setPhase] = useState<VoiceRecordPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [dragHint, setDragHint] = useState<VoiceDragHint>('none');
  const [preview, setPreview] = useState<PickedMedia | null>(null);
  const [sending, setSending] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);

  const isRecording = phase === 'holding' || phase === 'locked' || phase === 'arming';

  useEffect(() => {
    if (!isRecording) return;
    const id = window.setInterval(() => setElapsed((e) => e + 100), 100);
    return () => window.clearInterval(id);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      recorderRef.current = null;
    };
  }, []);

  const revokePreview = useCallback((media: PickedMedia | null) => {
    if (media?.previewUrl) URL.revokeObjectURL(media.previewUrl);
  }, []);

  const resetRecording = useCallback(() => {
    wantRecordingRef.current = false;
    fingerDownRef.current = false;
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setPhase('idle');
    setElapsed(0);
    setDragHint('none');
  }, []);

  const cancelRecording = useCallback(() => {
    resetRecording();
    skipClickRef.current = true;
  }, [resetRecording]);

  const discardPreview = useCallback(() => {
    setPreview((prev) => {
      revokePreview(prev);
      return null;
    });
    setPhase('idle');
    setElapsed(0);
  }, [revokePreview]);

  const finishRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder?.isRecording) {
      resetRecording();
      return;
    }
    recorderRef.current = null;
    setDragHint('none');
    try {
      const { blob, mime, durationMs } = await recorder.stop();
      if (durationMs < MIN_RECORD_MS) {
        setPhase('idle');
        setElapsed(0);
        onError('Hold a little longer to record');
        return;
      }
      const media = await recordedVoiceToPickedMedia(blob, mime, durationMs);
      setPreview((prev) => {
        revokePreview(prev);
        return media;
      });
      setPhase('preview');
    } catch {
      setPhase('idle');
      setElapsed(0);
      onError('Could not save voice message');
    }
  }, [onError, resetRecording, revokePreview]);

  const beginHold = useCallback(
    async (clientX: number, clientY: number) => {
      if (disabled || startingRef.current || phase === 'preview') return false;
      if (phase !== 'idle') return false;

      startingRef.current = true;
      wantRecordingRef.current = true;
      fingerDownRef.current = true;
      originRef.current = { x: clientX, y: clientY };
      setElapsed(0);
      setDragHint('none');
      setPhase('arming');

      try {
        let micStatus = await readMicrophonePermissionStatus();
        if (micStatus === 'not_determined') {
          micStatus = await requestMicrophonePermission();
        }
        if (!isDevicePermissionGranted(micStatus)) {
          setMicBlocked(true);
          resetRecording();
          return false;
        }

        if (!wantRecordingRef.current) {
          resetRecording();
          return false;
        }

        const recorder = new VoiceRecorder();
        await recorder.start();

        if (!wantRecordingRef.current || !fingerDownRef.current) {
          recorder.cancel();
          resetRecording();
          return false;
        }

        recorderRef.current = recorder;
        setPhase('holding');
        return true;
      } catch {
        onError('Microphone access is required for voice messages');
        resetRecording();
        return false;
      } finally {
        startingRef.current = false;
      }
    },
    [disabled, onError, phase, resetRecording],
  );

  const updateDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (phase !== 'holding') return;

      const dx = clientX - originRef.current.x;
      const dy = clientY - originRef.current.y;

      if (dx <= -CANCEL_DRAG_X) {
        cancelRecording();
        return;
      }

      if (dy <= -LOCK_DRAG_Y) {
        setPhase('locked');
        setDragHint('lock');
        skipClickRef.current = true;
        return;
      }

      if (dy <= -LOCK_DRAG_Y * 0.45) {
        setDragHint('lock');
      } else if (dx <= -CANCEL_DRAG_X * 0.45) {
        setDragHint('cancel');
      } else {
        setDragHint('none');
      }
    },
    [cancelRecording, phase],
  );

  const endHold = useCallback(() => {
    fingerDownRef.current = false;
    wantRecordingRef.current = false;

    if (startingRef.current && !recorderRef.current) {
      return;
    }

    if (phase === 'locked') return;

    if (recorderRef.current?.isRecording || phase === 'holding') {
      skipClickRef.current = true;
      void finishRecording();
      return;
    }

    if (phase === 'arming') {
      resetRecording();
    }
  }, [finishRecording, phase, resetRecording]);

  const stopLocked = useCallback(() => {
    if (phase !== 'locked') return;
    skipClickRef.current = true;
    void finishRecording();
  }, [finishRecording, phase]);

  const sendPreview = useCallback(
    async (onSend: (media: PickedMedia) => void | Promise<void>) => {
      if (!preview || sending) return;
      setSending(true);
      try {
        await onSend(preview);
        setPreview((prev) => {
          revokePreview(prev);
          return null;
        });
        setPhase('idle');
        setElapsed(0);
      } finally {
        setSending(false);
      }
    },
    [preview, revokePreview, sending],
  );

  const consumeSkipClick = useCallback(() => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    phase,
    elapsed,
    dragHint,
    preview,
    sending,
    micBlocked,
    dismissMicBlocked: () => setMicBlocked(false),
    isRecording,
    beginHold,
    updateDrag,
    endHold,
    stopLocked,
    discardPreview,
    sendPreview,
    consumeSkipClick,
  };
}
