// Path: vite.config.js
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
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
            'utils': path.resolve(__dirname, 'web/utils'), // Thêm alias cho utils
        },
    },
    plugins: [
        basicSsl(), // Kích hoạt SSL ảo để test trên thiết bị LAN (điện thoại)
        VitePWA({
            registerType: 'prompt', // Thay đổi từ autoUpdate sang prompt để hiện Toast thông báo
            includeAssets: ['assets/icons/favicon.ico', 'assets/icons/apple-touch-icon.png'],
            manifest: {
                name: 'Giới Bổn Tỳ Kheo',
                short_name: 'Giới Bổn',
                description: 'Tập tụng Giới Bổn Tỳ Kheo (Pātimokkha Bhikkhu) tiếng Việt offline.',
                theme_color: '#fdfbf7',
                background_color: '#fdfbf7',
                display: 'standalone', // Chạy như app native, không có thanh địa chỉ
                orientation: 'portrait',
                scope: '/gioibon/',
                start_url: '/gioibon/',
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
                    },
                    {
                        src: 'assets/icons/android-chrome-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,db,wasm}'], // Đảm bảo cache .db và .wasm
                maximumFileSizeToCacheInBytes: 15 * 1024 * 1024, // Tăng limit lên 15MB cho DB
                runtimeCaching: [
                    {
                        // Cache Google Fonts (stylesheets)
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Cache Google Fonts (gstatic)
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'gstatic-fonts-cache',
                            expiration: {
                                maxEntries: 10,
                                maxAgeSeconds: 60 * 60 * 24 * 365 // 365 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200]
                            }
                        }
                    },
                    {
                        // Chiến lược cache cho Audio/Data: StaleWhileRevalidate
                        urlPattern: ({ url }) => url.pathname.includes('/app-content/'),
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