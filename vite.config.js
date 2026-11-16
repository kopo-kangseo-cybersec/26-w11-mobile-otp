import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Netlify 및 GitHub Pages 배포 경로 호환
  plugins: [react()],
  server: {
    host: true, // 로컬 Wi-Fi 내 스마트폰 접속 허용
  },
})
