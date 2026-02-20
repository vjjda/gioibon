// Path: web/modules/ui/font_settings.js
export const FontSettings = {
    // Config
    MIN_SCALE: 0.8,
    MAX_SCALE: 2.0, // Max 200%
    STEP: 0.1,
    DEFAULT_SCALE: 1.0,
    STORAGE_KEY: "sutta_font_scale",

    init() {
        const btnDecrease = document.getElementById("btn-font-decrease");
        const btnIncrease = document.getElementById("btn-font-increase");
        const label = document.getElementById("font-size-label");

        // 1. Load saved state
        const saved = localStorage.getItem(this.STORAGE_KEY);
        let currentScale = saved ? parseFloat(saved) : this.DEFAULT_SCALE;
        
        // Apply initial
        this.applyScale(currentScale);

        // 2. Events
        if (btnDecrease) {
            btnDecrease.addEventListener("click", (e) => {
                e.stopPropagation();
                if (currentScale > this.MIN_SCALE) {
                    currentScale = Math.max(this.MIN_SCALE, currentScale - this.STEP);
                    this.applyScale(currentScale);
                }
            });
        }

        if (btnIncrease) {
            btnIncrease.addEventListener("click", (e) => {
                e.stopPropagation();
                if (currentScale < this.MAX_SCALE) {
                    currentScale = Math.min(this.MAX_SCALE, currentScale + this.STEP);
                    this.applyScale(currentScale);
                }
            });
        }

        // Reset on label click
        if (label) {
            label.addEventListener("click", (e) => {
                e.stopPropagation();
                currentScale = this.DEFAULT_SCALE;
                this.applyScale(currentScale);
            });
            label.style.cursor = "pointer";
        }
    },

    applyScale(scale) {
        // Round to 1 decimal place
        const cleanScale = Math.round(scale * 10) / 10;
        
        // Update CSS Variable
        // Note: The content container needs to use this variable for font-size.
        // E.g., font-size: calc(1rem * var(--text-scale));
        document.documentElement.style.setProperty('--text-scale', cleanScale);
        
        // Save
        localStorage.setItem(this.STORAGE_KEY, cleanScale);
        
        // Update label (optional visual feedback)
        // const label = document.getElementById("font-size-label");
        // if (label) label.title = `Scale: ${cleanScale}x`;
    }
};
