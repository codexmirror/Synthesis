import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * One Vite config serves both runtime modes from the same application
 * source. `--mode online` (see `.env.online`) is the only thing that changes:
 * the Online production build is root-hosted (`/`), while the default/Pages
 * Sandbox build keeps the `/Synthesis/` base it is deployed under.
 */
export default defineConfig(({ mode }) => ({
  base: mode === 'online' ? '/' : '/Synthesis/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:4174' } },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
}))
