import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 固定端口，避免占用/抢占其他项目的 5173、5174
    port: 5280,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3780',
        changeOrigin: true,
      },
    },
  },
});
