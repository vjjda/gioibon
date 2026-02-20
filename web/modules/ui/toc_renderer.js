// Path: web/modules/ui/toc_renderer.js
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
        
        const mainList = document.createElement('ul');
        mainList.className = 'toc-main-list';
        this.container.appendChild(mainList);

        let currentSectionLi = null; // Keeps track of H2 or H3
        let currentRuleList = null;

        items.forEach(item => {
            // Identify Header Level from HTML
            const match = item.html.match(/^<h(\d)>(.*?)<\/h\d>/i);
            const isRule = item.label.endsWith('-name');
            
            if (match || isRule) {
                let level = match ? parseInt(match[1]) : 4;
                let text = item.segment.replace(/<[^>]*>?/gm, '').trim();

                // Sửa lỗi: Bỏ qua các heading rỗng
                if (!text && !isRule) return;

                // Special case: "Giới bổn Tỳ kheo" is H1
                if (level === 1) {
                     const li = this._createTocItem(item, 'Giới Bổn', 'level-title');
                     mainList.appendChild(li);
                     currentSectionLi = null;
                     currentRuleList = null;
                }
                // H2: Main Section (e.g. Nidana, Parajika)
                else if (level === 2) {
                    const li = this._createTocItem(item, text, 'level-h2');
                    mainList.appendChild(li);
                    currentSectionLi = li;
                    currentRuleList = null; // Reset rules for new main section
                }
                // H3: Sub-section (e.g. Preparation)
                else if (level === 3) {
                    const li = this._createTocItem(item, text, 'level-h3');
                    mainList.appendChild(li);
                    // H3 can also contain rules (though rare), set context just in case
                    currentSectionLi = li;
                    currentRuleList = null;
                }
                // H4: Rule (e.g. Pj1)
                else if (level === 4 || isRule) {
                    if (currentSectionLi) {
                        if (!currentRuleList) {
                            currentRuleList = document.createElement('ul');
                            currentRuleList.className = 'toc-rule-list';
                            currentSectionLi.appendChild(currentRuleList);
                        }

                        // Grid Display: Extract number only
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
                        
                        // If still too long (>3 chars), truncate or use initial?
                        if (shortLabel.length > 3) shortLabel = shortLabel.substring(0, 3);

                        const li = document.createElement('li');
                        li.className = 'toc-rule-item';
                        
                        const link = document.createElement('a');
                        link.className = 'toc-link rule-link';
                        link.href = `#segment-${item.id}`; 
                        link.textContent = shortLabel;
                        link.title = text; // Tooltip shows full text
                        link.onclick = (e) => this._handleLinkClick(e, item.id, link);
                        
                        li.appendChild(link);
                        currentRuleList.appendChild(li);
                    }
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
        link.href = `#segment-${item.id}`;
        link.textContent = text;
        link.onclick = (e) => this._handleLinkClick(e, item.id, link);
        
        li.appendChild(link);
        return li;
    }

    _handleLinkClick(e, segmentId, linkElement) {
        e.preventDefault();
        this._scrollTo(segmentId);
        this._setActive(linkElement);
    }

    _scrollTo(id) {
        // Find segment by data-id
        const target = document.querySelector(`.segment[data-id="${id}"]`);
        
        if (target) {
            // Simply use scrollIntoView. 
            // Because #content has overflow-y:auto and header is a sibling outside #content,
            // aligning to top of #content is correct and won't be obscured.
            target.scrollIntoView({ block: 'start' });

            if (window.innerWidth <= 1024 && this.sidebar) {
                this.sidebar.classList.remove('visible');
            }
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
