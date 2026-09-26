import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// GitHub Pages serves the site under /<repo>/. Override with BASE_PATH for other hosts.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.BASE_PATH ?? '/instagram-account-analyzer/') : '/',
  plugins: [react(), tailwindcss()],
}))
