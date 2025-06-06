import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';

export default defineConfig(({ mode }) => ({
  server: { host: '::', port: 8080 },

  plugins: [
    react({
      // —— Runtime automático + runtime de R3F ——
      jsxRuntime: 'automatic',
      jsxImportSource: '@react-three/fiber',
    }),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Si tu versión de R3F no trae jsx-dev-runtime, redirígelo:
      '@react-three/fiber/jsx-dev-runtime':
        '@react-three/fiber/jsx-runtime',
    },
  },

  assetsInclude: ['**/*.wasm'],
  optimizeDeps: { exclude: ['web-ifc'] },
}));
