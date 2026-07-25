import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const isElectron = process.env.VITE_ELECTRON === '1';
const isCapacitor = process.env.VITE_CAPACITOR === '1';
const webBase =
  process.env.VITE_WEB_BASE ||
  (isElectron || isCapacitor ? './' : '/');

function formatBuildId(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

if (isCapacitor && !process.env.VITE_APP_BUILD_ID) {
  process.env.VITE_APP_BUILD_ID = formatBuildId(new Date());
}

export default defineConfig({
  base: webBase,
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:3847', changeOrigin: true },
      '/blob': { target: 'http://localhost:3847', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3847', ws: true },
      '/health': { target: 'http://localhost:3847', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      '@chat2chat/crypto/browser': path.resolve(__dirname, '../../packages/crypto/src/browser.ts'),
      '@chat2chat/crypto': path.resolve(__dirname, '../../packages/crypto/src/browser.ts'),
      '@chat2chat/chainlock-padding': path.resolve(__dirname, '../../packages/chainlock-padding/src/index.ts'),
      '@chat2chat/chainlock-fastfile/worker': path.resolve(
        __dirname,
        '../../packages/chainlock-fastfile/src/aes-worker.ts',
      ),
      '@chat2chat/chainlock-fastfile': path.resolve(
        __dirname,
        '../../packages/chainlock-fastfile/src/index.ts',
      ),
    },
  },
  optimizeDeps: {
    exclude: ['@signalapp/libsignal-client'],
  },
});
