import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  // Ensure Babel's JSX transform uses the production runtime when building
  // for production. Without this, .env's NODE_ENV=development causes Babel
  // to emit jsxDEV() calls and React's dev bundle gets bundled.
  if (mode === 'production') process.env.NODE_ENV = 'production';

  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Explicitly bind NODE_ENV to the Vite build mode so that .env's
      // NODE_ENV=development never leaks into production bundles.
      // Without this, import.meta.env.DEV stays true even in `vite build`.
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GOOGLE_MAPS_API_KEY': JSON.stringify(env.GOOGLE_MAPS_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
        },
      },
    },
  };
});
