// Mock implementation of vite-plugin-pwa for "make simple" / local static testing
export function registerSW(options = {}) {
    console.warn('⚠️ PWA Support is disabled in "make simple" mode. Use "make dev" or "make preview" to test PWA features.');
    
    // Return a dummy update function
    return (reload) => {
        console.log('[PWA Mock] Update requested (no-op)', reload);
    };
}
