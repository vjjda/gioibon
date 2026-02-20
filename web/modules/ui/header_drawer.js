// Path: web/modules/ui/header_drawer.js
export const HeaderDrawer = {
    init() {
        const toggleDrawerBtn = document.getElementById("btn-toggle-drawer");
        const filterDrawer = document.getElementById("filter-drawer");
    
        if (toggleDrawerBtn && filterDrawer) {
            // 1. Toggle Button Click
            toggleDrawerBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Stop propagation
                filterDrawer.classList.toggle("hidden");
                toggleDrawerBtn.classList.toggle("open");
                
                // Toggle expansion class on parent for possible layout adjustments
                const container = document.getElementById("filter-container");
                if (container) {
                    container.classList.toggle("expanded");
                }
            });

            // 2. Click Outside to Close
            document.addEventListener("click", (e) => {
                const isHidden = filterDrawer.classList.contains("hidden");
                
                // If drawer is open, and click is NOT inside drawer, and NOT on toggle button
                if (!isHidden && 
                    !filterDrawer.contains(e.target) && 
                    !toggleDrawerBtn.contains(e.target)) {
                    
                    filterDrawer.classList.add("hidden");
                    toggleDrawerBtn.classList.remove("open");
                    const container = document.getElementById("filter-container");
                    if (container) {
                        container.classList.remove("expanded");
                    }
                }
            });

            // Prevent click inside drawer from closing it
            filterDrawer.addEventListener("click", (e) => {
                e.stopPropagation();
            });
        }
    }
};
