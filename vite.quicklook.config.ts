import { defineConfig } from 'vite';
import path from 'path';

// Builds the Quick Look preview page (src/quicklook) as one classic script + one stylesheet:
// the extension loads it from file://, where ES module scripts are blocked.
export default defineConfig({
  publicDir: path.join(__dirname, 'src/quicklook/public'),
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: path.join(__dirname, 'dist/quicklook'),
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.join(__dirname, 'src/quicklook/main.ts'),
      formats: ['iife'],
      name: 'MuduckQuickLook',
      fileName: () => 'preview.js',
    },
  },
});
