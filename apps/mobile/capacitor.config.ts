import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chat2chat.app',
  appName: 'Chat2Chat',
  webDir: '../web/dist',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0B0B0C',
    scheme: 'Chat2Chat',
    scrollEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: '#0B0B0C',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0B0B0C',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'native',
    },
  },
};

export default config;
