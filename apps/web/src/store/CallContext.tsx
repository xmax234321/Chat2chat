import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ActiveCall, CallRecord } from '../lib/calls';
import type { CallSignal } from '../lib/call-signaling';
import { VoiceCallEngine } from '../lib/voice-call-engine';
import { CALLS_ENABLED } from '../lib/calls-feature';
import { loadState, saveState } from '../lib/types';
import { useApp } from './AppContext';

interface CallContextValue {
  activeCall: ActiveCall | null;
  callHistory: CallRecord[];
  startCall: (contactId: string) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  minimizeCall: () => void;
  expandCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

const noop = () => {};

const disabledCallsValue: CallContextValue = {
  activeCall: null,
  callHistory: [],
  startCall: noop,
  acceptCall: noop,
  declineCall: noop,
  endCall: noop,
  minimizeCall: noop,
  expandCall: noop,
  toggleMute: noop,
  toggleSpeaker: noop,
};

const RING_TIMEOUT_MS = 45_000;

function randomCallId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function CallProvider({ children }: { children: ReactNode }) {
  if (!CALLS_ENABLED) {
    return <CallContext.Provider value={disabledCallsValue}>{children}</CallContext.Provider>;
  }
  return <EnabledCallProvider>{children}</EnabledCallProvider>;
}

function EnabledCallProvider({ children }: { children: ReactNode }) {
  const { identity, sendCallSignal, setCallSignalHandler } = useApp();
  const saved = loadState();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [callHistory, setCallHistory] = useState<CallRecord[]>(saved.callHistory ?? []);
  const activeCallRef = useRef<ActiveCall | null>(null);
  const engineRef = useRef<VoiceCallEngine | null>(null);
  const ringTimeoutRef = useRef<number | null>(null);
  const endingRef = useRef(false);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const appendRecord = useCallback((record: CallRecord) => {
    setCallHistory((prev) => {
      const next = [record, ...prev];
      saveState({ callHistory: next });
      return next;
    });
  }, []);

  const clearRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current !== null) {
      window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }, []);

  const destroyEngine = useCallback(() => {
    engineRef.current?.cleanup();
    engineRef.current = null;
  }, []);

  const finalizeCall = useCallback(
    (outcome: CallRecord['outcome'], durationMs?: number) => {
      if (endingRef.current) return;
      endingRef.current = true;
      const call = activeCallRef.current;
      if (!call) {
        endingRef.current = false;
        return;
      }
      appendRecord({
        id: call.id,
        contactId: call.contactId,
        direction: call.direction,
        outcome,
        timestamp: call.startedAt,
        durationMs,
      });
      clearRingTimeout();
      destroyEngine();
      setActiveCall(null);
      endingRef.current = false;
    },
    [appendRecord, clearRingTimeout, destroyEngine],
  );

  const ensureEngine = useCallback((): VoiceCallEngine | null => {
    const userId = identity?.userId;
    if (!userId) return null;
    if (engineRef.current) return engineRef.current;

    const engine = new VoiceCallEngine(
      {
        sendSignal: (contactId, signal) => {
          void sendCallSignal(contactId, signal);
        },
        onConnected: () => {
          clearRingTimeout();
          setActiveCall((prev) =>
            prev ? { ...prev, phase: 'active', activeAt: Date.now() } : prev,
          );
        },
        onRemoteHangup: () => {
          const call = activeCallRef.current;
          if (!call) return;
          let outcome: CallRecord['outcome'] = 'cancelled';
          let durationMs: number | undefined;
          if (call.phase === 'active' && call.activeAt) {
            outcome = 'completed';
            durationMs = Date.now() - call.activeAt;
          } else if (call.phase === 'incoming') {
            outcome = 'missed';
          }
          finalizeCall(outcome, durationMs);
        },
        onRemoteBusy: () => {
          finalizeCall('cancelled');
        },
      },
      userId,
    );
    engineRef.current = engine;
    return engine;
  }, [identity?.userId, sendCallSignal, clearRingTimeout, finalizeCall]);

  const startRingTimeout = useCallback(
    (direction: 'incoming' | 'outgoing') => {
      clearRingTimeout();
      ringTimeoutRef.current = window.setTimeout(() => {
        ringTimeoutRef.current = null;
        void engineRef.current?.end().catch(() => {});
        finalizeCall(direction === 'incoming' ? 'missed' : 'cancelled');
      }, RING_TIMEOUT_MS);
    },
    [clearRingTimeout, finalizeCall],
  );

  const handleSignal = useCallback(
    (from: string, signal: CallSignal) => {
      const showIncoming = (callId: string) => {
        if (activeCallRef.current) return;
        setActiveCall({
          id: callId,
          contactId: from,
          phase: 'incoming',
          direction: 'incoming',
          startedAt: Date.now(),
          minimized: false,
          muted: false,
          speakerOn: false,
        });
        startRingTimeout('incoming');
      };

      if (signal.type === 'ring' || signal.type === 'offer') {
        if (activeCallRef.current && activeCallRef.current.id !== signal.callId) {
          void sendCallSignal(from, { callId: signal.callId, type: 'busy' });
          return;
        }
        if (signal.type === 'ring') {
          showIncoming(signal.callId);
        } else if (!activeCallRef.current) {
          showIncoming(signal.callId);
        }
      }

      const engine = ensureEngine();
      if (engine) void engine.handleSignal(from, signal);
    },
    [ensureEngine, sendCallSignal, startRingTimeout],
  );

  useEffect(() => {
    setCallSignalHandler(handleSignal);
    return () => setCallSignalHandler(null);
  }, [handleSignal, setCallSignalHandler]);

  useEffect(() => {
    return () => {
      clearRingTimeout();
      destroyEngine();
    };
  }, [clearRingTimeout, destroyEngine]);

  const startCall = useCallback(
    (contactId: string) => {
      if (activeCallRef.current) return;
      const id = randomCallId();
      setActiveCall({
        id,
        contactId,
        phase: 'outgoing',
        direction: 'outgoing',
        startedAt: Date.now(),
        minimized: false,
        muted: false,
        speakerOn: false,
      });
      const engine = ensureEngine();
      if (!engine) {
        setActiveCall(null);
        return;
      }
      void engine.startOutgoing(contactId, id).catch(() => {
        finalizeCall('cancelled');
      });
      startRingTimeout('outgoing');
    },
    [ensureEngine, finalizeCall, startRingTimeout],
  );

  const acceptCall = useCallback(() => {
    const call = activeCallRef.current;
    if (!call || call.phase !== 'incoming') return;
    clearRingTimeout();
    setActiveCall((prev) => (prev ? { ...prev, phase: 'connecting' } : prev));
    const engine = ensureEngine();
    if (!engine) {
      finalizeCall('missed');
      return;
    }
    void engine.accept().catch(() => {
      finalizeCall('missed');
    });
  }, [clearRingTimeout, ensureEngine, finalizeCall]);

  const declineCall = useCallback(() => {
    const call = activeCallRef.current;
    if (!call || call.phase !== 'incoming') return;
    void engineRef.current?.decline().catch(() => {});
    finalizeCall('declined');
  }, [finalizeCall]);

  const endCall = useCallback(() => {
    const call = activeCallRef.current;
    if (!call) return;

    let outcome: CallRecord['outcome'] = 'cancelled';
    let durationMs: number | undefined;

    if (call.phase === 'active' && call.activeAt) {
      outcome = 'completed';
      durationMs = Date.now() - call.activeAt;
    } else if (call.phase === 'incoming') {
      outcome = 'declined';
    }

    void engineRef.current?.end().catch(() => {});
    finalizeCall(outcome, durationMs);
  }, [finalizeCall]);

  const minimizeCall = useCallback(() => {
    setActiveCall((prev) => (prev?.phase === 'active' ? { ...prev, minimized: true } : prev));
  }, []);

  const expandCall = useCallback(() => {
    setActiveCall((prev) => (prev ? { ...prev, minimized: false } : prev));
  }, []);

  const toggleMute = useCallback(() => {
    setActiveCall((prev) => {
      if (!prev) return prev;
      const muted = !prev.muted;
      engineRef.current?.setMuted(muted);
      return { ...prev, muted };
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setActiveCall((prev) => {
      if (!prev) return prev;
      const speakerOn = !prev.speakerOn;
      engineRef.current?.setSpeaker(speakerOn);
      return { ...prev, speakerOn };
    });
  }, []);

  const value = useMemo<CallContextValue>(
    () => ({
      activeCall,
      callHistory,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      minimizeCall,
      expandCall,
      toggleMute,
      toggleSpeaker,
    }),
    [
      activeCall,
      callHistory,
      startCall,
      acceptCall,
      declineCall,
      endCall,
      minimizeCall,
      expandCall,
      toggleMute,
      toggleSpeaker,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCalls() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCalls outside CallProvider');
  return ctx;
}
