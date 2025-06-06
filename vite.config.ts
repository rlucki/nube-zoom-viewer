import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

export default defineConfig(({ mode }) => ({
  server: { host: '::', port: 8080 },

  plugins: [
    react({
      jsxRuntime: 'automatic',              // runtime automático
      jsxImportSource: '@react-three/fiber' // runtime de R3F
    }),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // alias opcional por si falta jsx-dev-runtime
      '@react-three/fiber/jsx-dev-runtime': '@react-three/fiber/jsx-runtime',
    },
  },

  assetsInclude: ['**/*.wasm'],
  optimizeDeps: { exclude: ['web-ifc'] },
}));
