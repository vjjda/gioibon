// Path: vite.config.js
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import fs from 'fs';

// --- HỆ THỐNG AUTO-ALIAS TỰ ĐỘNG ---
function getDirectories(source) {
    if (!fs.existsSync(source)) return [];
    return fs.readdirSync(source, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
}

const aliases = {};
const webDir = path.resolve(__dirname, 'web');
const modulesDir = path.resolve(__dirname, 'web/modules');

getDirectories(webDir).forEach(dir => {
    if (dir !== 'modules') { 
        aliases[dir] = path.resolve(webDir, dir);
    }
});

if (fs.existsSync(modulesDir)) {
    getDirectories(modulesDir).forEach(dir => {
        aliases[dir] = path.resolve(modulesDir, dir);
    });
}
// -----------------------------------

export default defineConfig(({ mode }) => {
    const isProd = mode === 'production';

    return {
        root: 'web', 
        base: '/gioibon/', 
        
        // [PERF] Tối ưu hóa hệ thống dịch mã (esbuild)
        esbuild: {
            // Xóa sạch console.log và debugger khi build bản thật để giảm dung lượng file
            drop: isProd ? ['console', 'debugger'] : [],
            // Xóa các comment bản quyền thừa thãi trong file bundle
            legalComments: 'none', 
        },

        build: {
            outDir: '../dist', 
            emptyOutDir: true,
            // [PERF] Build cho trình duyệt hiện đại (hỗ trợ WASM/ES6 native) giúp code siêu nhỏ gọn
            target: 'esnext', 
            minify: 'esbuild',
            cssMinify: true,
            sourcemap: !isProd, // Tắt sourcemap ở Production để tránh lộ code và giảm dung lượng
            
            // [PERF] Cấu hình Rollup để chia nhỏ các file (Chunk Splitting)
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        // Tách thư viện SQLite nặng ra một file riêng (vendor-sqlite)
                        // Giúp trình duyệt cache file này vĩnh viễn, không phải tải lại khi ta sửa code UI
                        if (id.includes('wa-sqlite')) {
                            return 'vendor-sqlite';
                        }
                        // Tách các thư viện khác trong node_modules (nếu có sau này)
                        if (id.includes('node_modules')) {
                            return 'vendor';
                        }
                    },
                    // Rút gọn tên file tĩnh, thêm hash để vô hiệu hóa cache khi có bản build mới
                    entryFileNames: 'assets/[name].[hash].js',
                    chunkFileNames: 'assets/[name].[hash].js',
                    assetFileNames: 'assets/[name].[hash].[ext]'
                }
            }
        },
        css: {
            devSourcemap: true, 
        },
        resolve: {
            alias: aliases,
        },
        plugins: [
            basicSsl(), 
            VitePWA({
                registerType: 'prompt', 
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
                    display: 'standalone', 
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
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm,json}'], 
                    globIgnores: ['**/node_modules/**/*', 'sw.js', 'workbox-*.js', '**/*_version.json', '**/*.db'],
                    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, 
                    runtimeCaching: [
                        {
                            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'google-fonts-cache',
                                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                                cacheableResponse: { statuses: [0, 200] }
                            }
                        },
                        {
                            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'gstatic-fonts-cache',
                                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                                cacheableResponse: { statuses: [0, 200] }
                            }
                        },
                        {
                            urlPattern: ({ url }) => url.pathname.endsWith('_version.json'),
                            handler: 'NetworkOnly'
                        }
                    ]
                }
            })
        ]
    };
});

