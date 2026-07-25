import type { PickedMedia } from './pick-media';
import { isIosCapacitor } from './platform';
import {
  cancelNativeVoiceRecord,
  readNativeVoiceBytes,
  startNativeVoiceRecord,
  stopNativeVoiceRecord,
} from './record-ios-voice';

const VOICE_MIME_PREFERENCES = [
  'audio/mp4',
  'audio/aac',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mpeg',
  'audio/x-m4a',
];

export function pickVoiceMimeType(): string {
  if (isIosCapacitor()) return 'audio/mp4';
  for (const mime of VOICE_MIME_PREFERENCES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime.split(';')[0]!;
    }
  }
  return 'audio/webm';
}

function voiceFileName(mime: string): string {
  if (mime.includes('mp4') || mime.includes('m4a')) return 'voice.m4a';
  if (mime.includes('webm')) return 'voice.webm';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'voice.mp3';
  return 'voice.aac';
}

export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private startTime = 0;
  private mime = 'audio/webm';
  private nativeActive = false;

  get isRecording(): boolean {
    return this.nativeActive || this.mediaRecorder?.state === 'recording';
  }

  async start(): Promise<void> {
    if (this.isRecording) return;

    if (isIosCapacitor()) {
      await startNativeVoiceRecord();
      this.nativeActive = true;
      this.startTime = Date.now();
      this.mime = 'audio/mp4';
      return;
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mime = pickVoiceMimeType();
    const options = MediaRecorder.isTypeSupported(this.mime) ? { mimeType: this.mime } : undefined;
    this.mediaRecorder = new MediaRecorder(this.stream, options);
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.mediaRecorder.start(100);
    this.startTime = Date.now();
  }

  async stop(): Promise<{ blob: Blob; mime: string; durationMs: number }> {
    if (this.nativeActive) {
      this.nativeActive = false;
      const startedAt = this.startTime;
      const { path, durationMs } = await stopNativeVoiceRecord();
      const data = await readNativeVoiceBytes(path);
      const mime = 'audio/mp4';
      const blob = new Blob([data.slice()], { type: mime });
      this.startTime = 0;
      return { blob, mime, durationMs: Math.max(durationMs, Date.now() - startedAt) };
    }

    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === 'inactive') {
      this.cleanup();
      throw new Error('Not recording');
    }

    const durationMs = Math.max(0, Date.now() - this.startTime);

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const type = recorder.mimeType.split(';')[0] || this.mime;
        resolve(new Blob(this.chunks, { type }));
      };
      recorder.onerror = () => reject(new Error('Recording failed'));
      recorder.stop();
    });

    this.cleanup();
    return { blob, mime: blob.type.split(';')[0] || this.mime, durationMs };
  }

  cancel(): void {
    if (this.nativeActive) {
      this.nativeActive = false;
      void cancelNativeVoiceRecord();
      this.startTime = 0;
      return;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.startTime = 0;
  }
}

export async function recordedVoiceToPickedMedia(
  blob: Blob,
  mime: string,
  durationMs: number,
): Promise<PickedMedia> {
  const data = new Uint8Array(await blob.arrayBuffer());
  const normalizedMime = mime.split(';')[0] || pickVoiceMimeType();
  const fileName = voiceFileName(normalizedMime);
  const file = new File([blob], fileName, { type: normalizedMime });
  const previewUrl = URL.createObjectURL(blob);
  return { file, data, mime: normalizedMime, previewUrl, isVoice: true, durationMs };
}
