/// <reference types="vitest/config" />
import mdx from '@mdx-js/rollup'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import remarkGfm from 'remark-gfm'
import { defineConfig } from 'vite'

// GitHub Pages serves the app under /LE-010_prep/; the deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [{ enforce: 'pre', ...mdx({ remarkPlugins: [remarkGfm] }) }, react({ include: /\.(mdx|tsx?)$/ }), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    // Page tests compile lazy pages (MDX lessons) on first load, which is slow on CI.
    testTimeout: 20_000,
  },
})
