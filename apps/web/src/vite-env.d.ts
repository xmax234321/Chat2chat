/// <reference types="vite/client" />

interface Chat2ChatNativeBridge {
  isElectron: boolean;
  isCapacitor?: boolean;
  platform: NodeJS.Platform;
  serverWs: string;
  serverHttp: string;
  saveBackup?: (options: { defaultPath: string; content: string }) => Promise<{
    canceled: boolean;
    filePath?: string;
  }>;
  openBackup?: () => Promise<{
    canceled: boolean;
    filePath?: string;
    content?: string;
    zipBytes?: string;
  }>;
}

declare global {
  interface Window {
    chat2chat?: Chat2ChatNativeBridge;
  }
}

interface ImportMetaEnv {
  readonly VITE_CHAT2CHAT_SERVER?: string;
  readonly VITE_CHAT2CHAT_HTTP?: string;
  readonly VITE_ELECTRON?: string;
  readonly VITE_CAPACITOR?: string;
  readonly VITE_APP_BUILD_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
