import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento o Vite fica em :3000 e faz proxy de /api para a API em :3001,
// para que o endereco do laboratorio seja sempre http://localhost:3000.
// No container, a propria API serve o dist/ compilado na porta 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.FRONTEND_PORT ?? 3000),
    host: true,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
