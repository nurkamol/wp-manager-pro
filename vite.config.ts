import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'assets/build',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/main.tsx'),
      output: {
        // IIFE format wraps the entire bundle in an immediately-invoked function,
        // keeping all bundle-level const/let/var declarations function-scoped.
        // Without this, Rollup's minifier names a Lucide icon variable "wp" at the
        // top level of the script, which shadows window.wp (WordPress's global media
        // object) for all subsequently-called code, breaking wp.media(), wp.Backbone
        // etc. even though window.wp itself is not overwritten.
        format: 'iife',
        name: 'WpManagerPro',
        entryFileNames: 'index.js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name][extname]',
      },
    },
    cssCodeSplit: false,
  },
  base: './',
})
