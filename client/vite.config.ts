import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/upload': 'http://localhost:8000',
      '/transcribe': 'http://localhost:8000',
      '/exists': 'http://localhost:8000',
      '/videos': 'http://localhost:8000',
      '/audios': 'http://localhost:8000',
      '/get_transcript_waveform': 'http://localhost:8000',
      '/get-fonts': 'http://localhost:8000',
      '/font': 'http://localhost:8000',
      '/export-ass': 'http://localhost:8000',
    }
  }
})
