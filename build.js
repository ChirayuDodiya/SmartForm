import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

async function runBuild() {
  console.log('Building SmartForm Extension...');

  // 1. Build Popup, Options, Test Form, and Background Service Worker
  await build({
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'popup.html'),
          options: resolve(__dirname, 'options.html'),
          testForm: resolve(__dirname, 'test-form.html'),
          background: resolve(__dirname, 'src/background/index.ts')
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'background') return 'background.js';
            return 'assets/[name].js';
          },
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]'
        }
      }
    }
  });

  // 2. Build Content Script as standalone IIFE (no imports, 100% self-contained for Chrome)
  await build({
    configFile: false,
    plugins: [],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'src/content/index.ts'),
        name: 'SmartFormContent',
        formats: ['iife'],
        fileName: () => 'content.js'
      }
    }
  });

  console.log('Extension build completed successfully in dist/');
}

runBuild().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});
