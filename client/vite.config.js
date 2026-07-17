import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Tailwind v4: ayrı bir tailwind.config.js dosyası gerekmez; tema token'ları
// src/index.css içindeki @theme bloğunda tanımlanır, plugin build'e buradan girer.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
