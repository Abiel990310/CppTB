import { defineConfig } from 'vite';
import { bookPlugin } from './build/plugin.ts';
import { compilePlugin } from './server/plugin.ts';

export default defineConfig({
  plugins: [bookPlugin(), compilePlugin()],
  build: {
    outDir: 'dist',
    rollupOptions: { input: 'index.html' },
    target: 'es2022',
  },
  server: { port: 5173 },
});
