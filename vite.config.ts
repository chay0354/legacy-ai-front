import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Package entry requires "./Client" but the file on disk is client.js.
      // That resolves on Windows and fails the Linux Vercel build.
      'simli-client': path.resolve(rootDir, 'node_modules/simli-client/dist/client.js'),
    },
  },
})
