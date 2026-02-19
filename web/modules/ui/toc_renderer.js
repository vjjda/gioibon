export class TocRenderer {
    constructor(containerId, sidebarId, sidebarToggleId) {
        this.container = document.getElementById(containerId);
        this.sidebar = document.getElementById(sidebarId);
        this.toggle = document.getElementById(sidebarToggleId);
        this.activeLink = null;
    }

    render(items) {
        if (!this.container) return;
        this.container.innerHTML = '';
        
        let currentSectionList = null;
        let ruleList = null;

        // Create main TOC list
        const mainList = document.createElement('ul');
        mainList.className = 'toc-main-list';
        this.container.appendChild(mainList);

        items.forEach(item => {
            // Identify TOC entries based on label
            if (item.label === 'title') {
                const li = this._createTocItem(item, 'Giới Bổn', 'level-title');
                mainList.appendChild(li);
            } 
            else if (item.label.endsWith('-chapter')) {
                // Chapter Header
                const li = this._createTocItem(item, item.segment, 'level-chapter'); // Use segment as title
                mainList.appendChild(li);
                
                // Prepare rule list for this chapter
                ruleList = document.createElement('ul');
                ruleList.className = 'toc-rule-list'; // Grid style via CSS
                li.appendChild(ruleList);
            }
            else if (item.label.endsWith('-name')) {
                // Rule Header (e.g., pj1-name)
                // Extract rule number: pj1-name -> 1
                const match = item.label.match(/([a-z]+)(\d+)-name/);
                const ruleNumber = match ? match[2] : '?';
                const rulePrefix = match ? match[1] : '';

                if (ruleList) {
                    const li = document.createElement('li');
                    li.className = 'toc-rule-item';
                    
                    const link = document.createElement('a');
                    link.className = 'toc-link rule-link';
                    link.href = `#section-${item.label}`; // Matches ID set in ContentRenderer
                    link.textContent = ruleNumber; // Just the number
                    link.title = `Điều ${ruleNumber} (${item.segment})`; // Full title on hover
                    link.onclick = (e) => this._handleLinkClick(e, `section-${item.label}`, link);
                    
                    li.appendChild(link);
                    ruleList.appendChild(li);
                }
            }
        });

        this._setupToggle();
    }

    _createTocItem(item, text, className) {
        const li = document.createElement('li');
        li.className = `toc-item ${className}`;
        
        const link = document.createElement('a');
        link.className = 'toc-link';
        link.href = `#section-${item.label}`; // Matches ID set in ContentRenderer
        link.textContent = text;
        link.onclick = (e) => this._handleLinkClick(e, `section-${item.label}`, link);
        
        li.appendChild(link);
        return li;
    }

    _handleLinkClick(e, targetId, linkElement) {
        e.preventDefault();
        this._scrollTo(targetId);
        this._setActive(linkElement);
    }

    _scrollTo(id) {
        // Try to find element by ID. If not found, it might be a segment ID vs section ID mismatch
        // ContentRenderer sets IDs as `section-${label}` for sections.
        // Rule headers are just segments with data-label.
        // Wait, ContentRenderer logic for IDs:
        // Section: `section-${item.label}` (if new section)
        // Segment: `data-id`, `data-label`
        
        // I need to ensure ContentRenderer sets IDs on the elements I want to scroll to.
        // In ContentRenderer, I set `currentSection.id = section-${item.label}` only for new sections.
        // For rules (e.g. pj1-name), they are just segments inside a section.
        // I should update ContentRenderer to set IDs on specific segments (headers) too, or use querySelector.
        
        let target = document.getElementById(id);
        
        // If not found by ID, try finding segment by data-label
        if (!target) {
            const label = id.replace('section-', '');
            target = document.querySelector(`.segment[data-label="${label}"]`);
        }

        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (window.innerWidth <= 1024 && this.sidebar) {
                this.sidebar.classList.remove('visible');
            }
        } else {
            console.warn("Scroll target not found:", id);
        }
    }

    _setActive(element) {
        if (this.activeLink) this.activeLink.classList.remove('active');
        element.classList.add('active');
        this.activeLink = element;
    }

    _setupToggle() {
        if (!this.toggle) return;
        
        // Remove old listeners to avoid duplicates if re-rendered? 
        // Best to just replace the element or handle externally.
        // Here we just attach if not attached? 
        // Simply cloning to clear previous listeners is a robust pattern.
        const newToggle = this.toggle.cloneNode(true);
        this.toggle.parentNode.replaceChild(newToggle, this.toggle);
        this.toggle = newToggle;

        this.toggle.addEventListener('click', () => {
            this.sidebar.classList.toggle('visible');
        });

        // Close on outside click
        // Note: This adds a global listener every render call if not careful.
        // But render() is usually called once.
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024 && this.sidebar) {
                if (!this.sidebar.contains(e.target) && !this.toggle.contains(e.target) && this.sidebar.classList.contains('visible')) {
                    this.sidebar.classList.remove('visible');
                }
            }
        });
    }
}
