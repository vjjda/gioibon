import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  root: 'web', // Root folder for Vite is 'web'
  base: '/gioibon/', // Base path for GitHub Pages deployment
  
  build: {
    outDir: '../dist', // Output to project root 'dist' folder
    emptyOutDir: true,
  },

  resolve: {
    alias: {
      'core': path.resolve(__dirname, 'web/modules/core'),
      'data': path.resolve(__dirname, 'web/modules/data'),
      'tts': path.resolve(__dirname, 'web/modules/tts'),
      'ui': path.resolve(__dirname, 'web/modules/ui'),
      'libs': path.resolve(__dirname, 'web/libs'),
      'services': path.resolve(__dirname, 'web/modules/services'),
    },
  },

  plugins: [
    VitePWA({
      registerType: 'autoUpdate', // Tự động cập nhật Service Worker khi có phiên bản mới
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'], // Các file cần cache ngay lập tức
      manifest: {
        name: 'Giới Bổn Tỳ Kheo',
        short_name: 'Giới Bổn',
        description: 'Ứng dụng đọc và nghe Giới Bổn Tỳ Kheo (Pātimokkha Bhikkhu) offline.',
        theme_color: '#fdfbf7',
        background_color: '#fdfbf7',
        display: 'standalone', // Chạy như app native, không có thanh địa chỉ
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'assets/icons/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'assets/icons/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Cấu hình cache cho Workbox
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'], // Cache các file này
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Cache Font files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
             // Chiến lược cache cho Audio/Data: StaleWhileRevalidate 
             // (Dùng cache cũ nếu có, đồng thời tải mới ngầm để lần sau dùng)
            urlPattern: ({ url }) => url.pathname.startsWith('/data/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-data-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ]
});
