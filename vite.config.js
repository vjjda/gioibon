// Path: vite.config.js
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import fs from 'fs';

// --- HỆ THỐNG AUTO-ALIAS TỰ ĐỘNG ---
// Hàm tiện ích để lấy danh sách tên các thư mục con
function getDirectories(source) {
    if (!fs.existsSync(source)) return [];
    return fs.readdirSync(source, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
}

const aliases = {};
const webDir = path.resolve(__dirname, 'web');
const modulesDir = path.resolve(__dirname, 'web/modules');

// 1. Quét và tự động thêm alias cho các folder ở root của 'web' (ví dụ: utils, libs, css...)
getDirectories(webDir).forEach(dir => {
    if (dir !== 'modules') { // Bỏ qua folder modules để xử lý riêng bên dưới
        aliases[dir] = path.resolve(webDir, dir);
    }
});

// 2. Quét và tự động thêm alias cho các sub-folder bên trong 'web/modules' (ví dụ: core, ui, tts...)
if (fs.existsSync(modulesDir)) {
    getDirectories(modulesDir).forEach(dir => {
        aliases[dir] = path.resolve(modulesDir, dir);
    });
}
// -----------------------------------

export default defineConfig({
    root: 'web', // Root folder for Vite is 'web'
    base: '/gioibon/', // Base path for GitHub Pages deployment
    build: {
        outDir: '../dist', // Output to project root 'dist' folder
        emptyOutDir: true,
    },
    css: {
        devSourcemap: true, // Kích hoạt Source Map cho CSS (Hỗ trợ trình duyệt Workspace)
    },
    resolve: {
        // Áp dụng danh sách tự động tạo ở trên
        alias: aliases,
    },
    plugins: [
        basicSsl(), // Kích hoạt SSL ảo để test trên thiết bị LAN (điện thoại)
        VitePWA({
            registerType: 'prompt', // Thay đổi từ autoUpdate sang prompt để hiện Toast thông báo
            includeAssets: [
                'assets/icons/favicon.ico', 
                'assets/icons/apple-touch-icon.png',
                'assets/icons/android-chrome-192x192.png',
                'assets/icons/android-chrome-512x512.png'
            ],
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
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'], // Đã loại bỏ .db để tránh precache file lớn
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // Giới hạn 5MB cho các assets khác
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
                        // CHÚ Ý: Loại trừ file .db ra khỏi cache runtime để tránh lỗi bộ nhớ SW
                        urlPattern: ({ url }) => url.pathname.includes('/app-content/') && !url.pathname.endsWith('.db'),
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