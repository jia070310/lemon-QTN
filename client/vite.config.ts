import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 固定绑 IPv4，避免 Windows 上只监听 [::1] 导致 127.0.0.1 打不开
    host: '127.0.0.1',
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
