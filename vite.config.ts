// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

export default defineConfig(({ mode }) => ({
  server: { host: '::', port: 8080 },

  plugins: [
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: '@react-three/fiber',
    }),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@react-three/fiber/jsx-dev-runtime':
        '@react-three/fiber/jsx-runtime',   // 👈 redirección clave
    },
  },

  assetsInclude: ['**/*.wasm'],
  optimizeDeps: { exclude: ['web-ifc'] },
}));
