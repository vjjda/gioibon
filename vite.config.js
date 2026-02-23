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
        
        esbuild: {
            drop: isProd ? ['console', 'debugger'] : [],
            legalComments: 'none', 
        },

        build: {
            outDir: '../dist', 
            emptyOutDir: true,
            target: 'esnext', 
            minify: 'esbuild',
            cssMinify: true,
            sourcemap: !isProd,
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('wa-sqlite')) {
                            return 'vendor-sqlite';
                        }
                        if (id.includes('node_modules')) {
                            return 'vendor';
                        }
                    },
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
                        { src: 'assets/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
                        { src: 'assets/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
                        { src: 'assets/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
                    ]
                },
                workbox: {
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm,json}'], 
                    globIgnores: ['**/node_modules/**/*', 'sw.js', 'workbox-*.js', '**/*_version.json', '**/*.db'],
                    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, 
                    runtimeCaching: [
                        // [NEW] Cache file âm thanh cục bộ (Dùng CacheFirst vì file mp3 (hash) không bao giờ đổi nội dung)
                        {
                            urlPattern: ({ url }) => url.pathname.includes('/app-content/audio/') && url.pathname.endsWith('.mp3'),
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'audio-mp3-cache',
                                expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 365 },
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

