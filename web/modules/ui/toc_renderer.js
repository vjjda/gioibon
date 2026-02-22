// Path: web/modules/ui/toc_renderer.js
export class TocRenderer {
    constructor(containerId, sidebarId, sidebarToggleId, contentRenderer) {
        this.container = document.getElementById(containerId);
        this.sidebar = document.getElementById(sidebarId);
        this.toggle = document.getElementById(sidebarToggleId);
        this.contentRenderer = contentRenderer; // Store reference
        this.activeLink = null;
    }

    render(items) {
        if (!this.container) return;
        this.container.innerHTML = '';
        
        // --- Create Structure ---
        const mainList = document.createElement('ul');
        mainList.className = 'toc-main-list';
        this.container.appendChild(mainList);

        // --- Optimized Rendering ---
        // Instead of recreating DOM elements constantly, build structure once.
        // Assuming items are flat list, we need to infer hierarchy.
        
        let currentH2Li = null;
        let currentH3Li = null; 
        let currentRuleList = null;

        items.forEach(item => {
            // Identify Header Level from HTML
            const match = item.html ? item.html.match(/^<h(\d)>(.*?)<\/h\d>/i) : null;
            const isRule = item.label.endsWith('-name');
            
            // Check if it's a heading OR a rule
            if (match || isRule) {
                let level = match ? parseInt(match[1]) : 4; // Default to rule level if no H tag
                if (isRule) level = 4; // Force rules to level 4

                // [FIX] Sử dụng item.text (đã tối ưu) thay vì item.segment đã bị loại bỏ
                let text = (item.text || '').replace(/<[^>]*>?/gm, '').trim();

                // Sửa lỗi: Bỏ qua các heading rỗng
                if (!text && !isRule) return;

                // Create link element
                const link = this._createLink(item, text, level);
                
                // --- Hierarchy Logic ---

                if (level === 1) {
                     // H1: Title (Root)
                     const li = document.createElement('li');
                     li.className = 'toc-item level-title';
                     li.appendChild(link);
                     mainList.appendChild(li);
                     
                     // Reset context
                     currentH2Li = null;
                     currentH3Li = null;
                     currentRuleList = null;
                }
                else if (level === 2) {
                    // H2: Main Section (e.g. Nidana, Parajika)
                    const li = document.createElement('li');
                    li.className = 'toc-item level-h2';
                    li.appendChild(link);
                    mainList.appendChild(li);
                    
                    currentH2Li = li;
                    currentH3Li = null; // Reset H3 context
                    currentRuleList = null; // Reset rules
                }
                else if (level === 3) {
                    // H3: Sub-section (e.g. Preparation)
                    const li = document.createElement('li');
                    li.className = 'toc-item level-h3';
                    li.appendChild(link);
                    
                    if (currentH2Li) {
                        // Create sub-list for H2 if needed (optional structure, here flat for H3)
                        // For this specific design, H3 is just indented under H2 visually?
                        // Let's append to mainList but mark class? 
                        // Actually better to nest inside H2 for collapsible?
                        // The original code appended to mainList directly. Let's keep it flat for now.
                        mainList.appendChild(li); 
                    } else {
                        mainList.appendChild(li);
                    }
                    
                    currentH3Li = li;
                    currentRuleList = null;
                }
                else if (level === 4) {
                    // Rule Level (Grid Display)
                    // Must be inside a container (H2 or H3)
                    const parentLi = currentH3Li || currentH2Li;
                    
                    if (parentLi) {
                        // Create UL for rules if not exists
                        if (!currentRuleList || currentRuleList.parentElement !== parentLi) {
                            currentRuleList = document.createElement('ul');
                            currentRuleList.className = 'toc-rule-list';
                            parentLi.appendChild(currentRuleList);
                        }

                        // Shorten Label for Grid
                        let shortLabel = text;
                        // Regex to find "1." or just "1"
                        const digitMatch = text.match(/^(\d+)\./) || text.match(/^(\d+)$/) || text.match(/(\d+)$/);
                        if (digitMatch) {
                            shortLabel = digitMatch[1];
                        } else {
                            // Fallback: Try extracting from label (e.g. pj1-name -> 1)
                            const labelMatch = item.label.match(/([a-z]+)(\d+)-name/i);
                            if (labelMatch) shortLabel = labelMatch[2];
                        }
                        if (shortLabel.length > 3) shortLabel = shortLabel.substring(0, 3);
                        link.textContent = shortLabel; // Update text for grid
                        link.title = text; // Tooltip shows full text
                        link.className = 'toc-link rule-link';

                        const li = document.createElement('li');
                        li.className = 'toc-rule-item';
                        li.appendChild(link);
                        currentRuleList.appendChild(li);
                    }
                }
            }
        });

        this._setupToggle();
    }

    _createLink(item, text, level) {
        const link = document.createElement('a');
        link.className = 'toc-link';
        link.href = `#segment-${item.id}`;
        link.dataset.id = item.id;
        link.textContent = text;
        
        link.onclick = (e) => {
            e.preventDefault();
            this._handleLinkClick(item.id, link);
        };
        return link;
    }

    _handleLinkClick(segmentId, linkElement) {
        // [UPDATED] Use ContentRenderer to handle scroll logic (lazy load aware)
        if (this.contentRenderer) {
            this.contentRenderer.scrollToSegment(segmentId);
        }

        // UI Updates
        this._setActive(linkElement);
        if (window.innerWidth <= 1024 && this.sidebar) {
            this.sidebar.classList.remove('visible');
        }
    }

    _setActive(element) {
        if (this.container) {
            this.container.querySelectorAll('.toc-link').forEach(el => el.classList.remove('active'));
        }
        element.classList.add('active');
        this.activeLink = element;
    }

    _setupToggle() {
        if (!this.toggle) return;
        const newToggle = this.toggle.cloneNode(true);
        this.toggle.parentNode.replaceChild(newToggle, this.toggle);
        this.toggle = newToggle;

        this.toggle.addEventListener('click', () => {
            this.sidebar.classList.toggle('visible');
        });

        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024 && this.sidebar) {
                if (!this.sidebar.contains(e.target) && !this.toggle.contains(e.target) && this.sidebar.classList.contains('visible')) {
                    this.sidebar.classList.remove('visible');
                }
            }
        });
    }
}