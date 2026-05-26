import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = process.env.APP_TARGET === 'internal' ? 'internal-chekeo-v2' : 'public-order-v2';

export default defineConfig({
  root: path.resolve(__dirname, `apps/${target}`),
  plugins: [react()],
  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, 'packages/ui/src'),
      '@config': path.resolve(__dirname, 'packages/config/src')
    }
  },
  build: {
    outDir: path.resolve(__dirname, `dist/${target}`),
    emptyOutDir: true
  }
});
