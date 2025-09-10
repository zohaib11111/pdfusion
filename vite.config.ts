import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [react()],
      define: {
        'process.env.VITE_APPWRITE_ENDPOINT': JSON.stringify(env.VITE_APPWRITE_ENDPOINT),
        'process.env.VITE_APPWRITE_PROJECT_ID': JSON.stringify(env.VITE_APPWRITE_PROJECT_ID)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
