import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: 'client',
    appType: 'mpa',
    envDir: process.cwd(),
    publicDir: false,
    server: {
      host: '0.0.0.0', port: 5173, strictPort: true,
      fs: { strict: true, allow: [resolve('client')] },
      proxy: { '/api': `http://127.0.0.1:${process.env.PORT ?? env.PORT ?? 3000}` },
    },
    base: './',
    build: {
      outDir: '../dist/client',
      emptyOutDir: true,
      rollupOptions: { input: [resolve('client/index.html'), resolve('client/host.html')] },
    },
  };
});
