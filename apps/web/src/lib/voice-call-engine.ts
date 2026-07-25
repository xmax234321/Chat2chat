import type { CallSignal, CallSignalPayload } from './call-signaling';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface VoiceCallEngineCallbacks {
  sendSignal: (contactId: string, signal: CallSignalPayload) => void;
  onConnected?: () => void;
  onRemoteHangup?: () => void;
  onRemoteBusy?: () => void;
  onError?: (error: Error) => void;
}

export class VoiceCallEngine {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private contactId: string | null = null;
  private callId: string | null = null;
  private pendingOffer: RTCSessionDescriptionInit | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private acceptPending = false;
  private connected = false;
  private muted = false;
  private speakerOn = false;

  constructor(
    private readonly callbacks: VoiceCallEngineCallbacks,
    _localUserId: string,
  ) {
    void _localUserId;
  }

  get inCall(): boolean {
    return this.contactId !== null;
  }

  async startOutgoing(contactId: string, callId: string): Promise<void> {
    if (this.inCall) throw new Error('Already in call');
    this.contactId = contactId;
    this.callId = callId;
    await this.ensureMedia();
    this.createPeerConnection();
    this.callbacks.sendSignal(contactId, { callId, type: 'ring' });
    const offer = await this.pc!.createOffer({ offerToReceiveAudio: true });
    await this.pc!.setLocalDescription(offer);
    this.callbacks.sendSignal(contactId, { callId, type: 'offer', sdp: offer });
  }

  async handleSignal(from: string, signal: CallSignal): Promise<void> {
    if (signal.from !== from) return;

    switch (signal.type) {
      case 'ring':
        if (this.inCall && this.callId !== signal.callId) {
          this.callbacks.sendSignal(from, { callId: signal.callId, type: 'busy' });
          return;
        }
        if (!this.inCall) {
          this.contactId = from;
          this.callId = signal.callId;
        }
        break;

      case 'offer':
        if (this.inCall && this.callId !== signal.callId) {
          this.callbacks.sendSignal(from, { callId: signal.callId, type: 'busy' });
          return;
        }
        if (!this.inCall) {
          this.contactId = from;
          this.callId = signal.callId;
        }
        if (signal.sdp) {
          this.pendingOffer = signal.sdp;
          if (this.acceptPending) {
            await this.createAnswer();
            this.acceptPending = false;
          }
        }
        break;

      case 'answer':
        if (!this.pc || this.callId !== signal.callId) return;
        if (signal.sdp) {
          await this.pc.setRemoteDescription(signal.sdp);
          await this.flushPendingIce();
        }
        break;

      case 'ice':
        if (this.callId !== signal.callId || !signal.candidate) return;
        if (!this.pc?.remoteDescription) {
          this.pendingIce.push(signal.candidate);
          return;
        }
        try {
          await this.pc.addIceCandidate(signal.candidate);
        } catch {
          /* stale candidate */
        }
        break;

      case 'hangup':
        if (this.callId === signal.callId) {
          this.callbacks.onRemoteHangup?.();
          this.cleanup();
        }
        break;

      case 'busy':
        if (this.callId === signal.callId) {
          this.callbacks.onRemoteBusy?.();
          this.cleanup();
        }
        break;
    }
  }

  async accept(): Promise<void> {
    if (!this.contactId || !this.callId) throw new Error('No incoming call');
    await this.ensureMedia();
    this.createPeerConnection();
    if (this.pendingOffer) {
      await this.createAnswer();
    } else {
      this.acceptPending = true;
    }
  }

  private async createAnswer(): Promise<void> {
    if (!this.pc || !this.contactId || !this.callId || !this.pendingOffer) return;
    await this.pc.setRemoteDescription(this.pendingOffer);
    const answer = await this.pc.createAnswer({ offerToReceiveAudio: true });
    await this.pc.setLocalDescription(answer);
    await this.flushPendingIce();
    this.callbacks.sendSignal(this.contactId, {
      callId: this.callId,
      type: 'answer',
      sdp: answer,
    });
    this.pendingOffer = null;
  }

  private async flushPendingIce(): Promise<void> {
    if (!this.pc?.remoteDescription) return;
    const queued = this.pendingIce;
    this.pendingIce = [];
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch {
        /* stale candidate */
      }
    }
  }

  async decline(): Promise<void> {
    if (this.contactId && this.callId) {
      this.callbacks.sendSignal(this.contactId, { callId: this.callId, type: 'hangup' });
    }
    this.cleanup();
  }

  async end(): Promise<void> {
    if (this.contactId && this.callId) {
      this.callbacks.sendSignal(this.contactId, { callId: this.callId, type: 'hangup' });
    }
    this.cleanup();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }

  setSpeaker(on: boolean): void {
    this.speakerOn = on;
    const audio = this.remoteAudio;
    if (!audio) return;
    if ('setSinkId' in audio) {
      void (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> })
        .setSinkId(on ? 'default' : '')
        .catch(() => {});
    }
  }

  cleanup(): void {
    this.pc?.close();
    this.pc = null;
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;
    if (this.remoteAudio) {
      this.remoteAudio.srcObject = null;
      this.remoteAudio.remove();
      this.remoteAudio = null;
    }
    this.contactId = null;
    this.callId = null;
    this.pendingOffer = null;
    this.pendingIce = [];
    this.acceptPending = false;
    this.connected = false;
  }

  private async ensureMedia(): Promise<void> {
    if (this.localStream) return;
    this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    if (this.muted) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
    }
  }

  private createPeerConnection(): void {
    if (this.pc) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;

    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        pc.addTrack(track, this.localStream);
      }
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }

    pc.onicecandidate = (ev) => {
      if (!ev.candidate || !this.contactId || !this.callId) return;
      this.callbacks.sendSignal(this.contactId, {
        callId: this.callId,
        type: 'ice',
        candidate: ev.candidate.toJSON(),
      });
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      this.attachRemoteAudio(stream);
      this.markConnected();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') this.markConnected();
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.callbacks.onError?.(new Error(`Connection ${pc.connectionState}`));
      }
    };
  }

  private attachRemoteAudio(stream: MediaStream): void {
    if (!this.remoteAudio) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', '');
      audio.style.display = 'none';
      document.body.appendChild(audio);
      this.remoteAudio = audio;
      if (this.speakerOn) this.setSpeaker(true);
    }
    this.remoteAudio.srcObject = stream;
    void this.remoteAudio.play().catch(() => {});
  }

  private markConnected(): void {
    if (this.connected) return;
    this.connected = true;
    this.callbacks.onConnected?.();
  }
}
