import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Gọi API qua cùng origin (5173) → proxy sang backend → tránh CORS và lỗi Failed to fetch khi mở bằng 127.0.0.1 hoặc IP LAN
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
})
