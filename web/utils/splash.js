// Path: web/utils/splash.js

export const SplashManager = {
    updateStatus(text) {
        const subtitle = document.querySelector('#splash-screen .splash-subtitle');
        if (subtitle) {
            subtitle.textContent = text;
        }
    },

    hide() {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.classList.add('splash-hidden');
            // Xóa phần tử khỏi DOM sau khi hiệu ứng fade-out (0.5s) kết thúc
            setTimeout(() => {
                if (splash.parentNode) {
                    splash.parentNode.removeChild(splash);
                }
            }, 500); 
        }
    }
};

