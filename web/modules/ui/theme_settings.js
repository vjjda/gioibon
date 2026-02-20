// Path: web/modules/ui/theme_settings.js

// Minimal configuration to replace AppConfig since we don't have it fully ported yet
const SEPIA_CONFIG = {
    HUE_COEFF: "35deg",
    SATURATE: "60%",
    MAX_CSS_LIGHT: 0.6, // Max sepia for light mode
    MAX_CSS_DARK: 0.4,  // Max sepia for dark mode
    STORAGE_KEY_PREFIX: "sutta_sepia_"
};

export const ThemeSettings = {
    CONFIG: {
        STORAGE_KEY_THEME: "sutta_theme",
    },

    init() {
        const btn = document.getElementById("btn-theme-toggle");
        const iconMoon = btn?.querySelector(".icon-moon");
        const iconSun = btn?.querySelector(".icon-sun");
        
        const sepiaPanel = document.getElementById("sepia-control-panel");
        const sepiaSlider = document.getElementById("sepia-slider");
        const sepiaIndicator = document.getElementById("btn-sepia-indicator");

        // Inject Config into CSS Root Variables
        document.documentElement.style.setProperty('--sepia-hue-coeff', SEPIA_CONFIG.HUE_COEFF);
        document.documentElement.style.setProperty('--sepia-saturate', SEPIA_CONFIG.SATURATE);

        // 1. Load Initial State
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const storedTheme = localStorage.getItem(this.CONFIG.STORAGE_KEY_THEME);
        
        let currentTheme = storedTheme || (systemPrefersDark ? "dark" : "light");

        // --- Helpers ---

        const getSepiaStorageKey = (theme) => `${SEPIA_CONFIG.STORAGE_KEY_PREFIX}${theme}`;
        
        // Dynamic Panel Toggling & Positioning
        const toggleSepiaPanel = () => {
            if (!sepiaPanel) return;

            const isHidden = sepiaPanel.classList.contains("hidden");

            if (isHidden) {
                // Show Panel
                sepiaPanel.classList.remove("hidden");
                if (sepiaIndicator) sepiaIndicator.classList.add("panel-open");
            } else {
                // Hide Panel
                sepiaPanel.classList.add("hidden");
                if (sepiaIndicator) sepiaIndicator.classList.remove("panel-open");
            }
        };

        const sliderToCss = (sliderValue, theme) => {
            const maxCss = theme === 'dark' 
                ? SEPIA_CONFIG.MAX_CSS_DARK 
                : SEPIA_CONFIG.MAX_CSS_LIGHT;
            return (sliderValue / 100) * maxCss;
        };

        const updateSepiaVisuals = (sliderValue, theme) => {
            const cssValue = sliderToCss(sliderValue, theme);
            
            // Pass raw value to CSS for calculation
            document.documentElement.style.setProperty('--sepia-val', cssValue);
            
            if (sepiaSlider && sepiaSlider.value != sliderValue) {
                sepiaSlider.value = sliderValue;
            }

            // Update Indicator Text
            if (sepiaIndicator) {
                sepiaIndicator.textContent = `${sliderValue}%`;
            }
        };

        const applyTheme = (theme) => {
            document.documentElement.setAttribute("data-theme", theme);
            localStorage.setItem(this.CONFIG.STORAGE_KEY_THEME, theme);
            currentTheme = theme;
            
            if (theme === "dark") {
                iconMoon?.classList.add("hidden");
                iconSun?.classList.remove("hidden");
            } else {
                iconMoon?.classList.remove("hidden");
                iconSun?.classList.add("hidden");
            }

            const savedSepia = localStorage.getItem(getSepiaStorageKey(theme)) || 0;
            updateSepiaVisuals(savedSepia, theme);
        };

        // --- Init Run ---
        applyTheme(currentTheme);

        // --- Event Listeners ---
        // Indicator Click
        if (sepiaIndicator) {
            sepiaIndicator.addEventListener("click", (e) => {
                e.stopPropagation(); // Prevent propagation
                toggleSepiaPanel();
            });
        }

        if (btn) {
            btn.addEventListener("click", () => {
                const newTheme = currentTheme === "light" ? "dark" : "light";
                applyTheme(newTheme);
                
                // Close sepia panel if open to keep UI clean
                if (sepiaPanel && !sepiaPanel.classList.contains("hidden")) {
                    toggleSepiaPanel(); 
                }
            });
        }

        if (sepiaSlider) {
            sepiaSlider.addEventListener("input", (e) => {
                const val = e.target.value;
                updateSepiaVisuals(val, currentTheme);
                localStorage.setItem(getSepiaStorageKey(currentTheme), val);
            });

            // Click outside to close sepia panel
            document.addEventListener("click", (e) => {
                if (sepiaPanel && !sepiaPanel.classList.contains("hidden") && 
                    !sepiaPanel.contains(e.target) && 
                    !btn.contains(e.target) &&
                    (!sepiaIndicator || !sepiaIndicator.contains(e.target))) {
                    toggleSepiaPanel();
                }
            });
            
            // Prevent clicks inside panel from closing it
            sepiaPanel.addEventListener("click", (e) => {
                e.stopPropagation();
            });
        }
    }
};
