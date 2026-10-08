import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Эта строка критически важна для GitHub Pages!
  base: '/crypto-chess/', 
})