// Path: web/modules/ui/toc_renderer.js
export class TocRenderer {
    constructor(containerId, sidebarId, sidebarToggleId, contentRenderer, memorizationManager) {
        this.container = document.getElementById(containerId);
        this.sidebar = document.getElementById(sidebarId);
        this.toggle = document.getElementById(sidebarToggleId);
        this.contentRenderer = contentRenderer; // Store reference
        this.memorizationManager = memorizationManager;
        this.activeLink = null;

        if (this.memorizationManager) {
            this.memorizationManager.onChange(() => this.updateMemorizationColors());
        }
    }

    render(headings) {
        if (!this.container) return;
        this.container.innerHTML = '';
        
        if (this.memorizationManager && this.sidebar) {
            let resetBtn = this.sidebar.querySelector('.toc-reset-progress-btn');
            if (!resetBtn) {
                resetBtn = document.createElement('button');
                resetBtn.className = 'toc-reset-progress-btn';
                resetBtn.innerHTML = '<i class="fas fa-undo"></i>';
                resetBtn.title = 'Xóa toàn bộ tiến độ thuộc';
                resetBtn.onclick = () => this.memorizationManager.resetAll();
                
                const header = this.sidebar.querySelector('.toc-header');
                if (header) {
                    header.appendChild(resetBtn);
                }
            }
        }

        // --- Create Structure ---
        const mainList = document.createElement('ul');
        mainList.className = 'toc-main-list';
        this.container.appendChild(mainList);

        let currentH2Li = null;
        let currentH3Li = null; 
        let currentRuleList = null;

        headings.forEach(heading => {
            const level = heading.level;
            let text = heading.text || '';
            const uid = heading.uid;

            if (!text) return;

            // Xử lý riêng cho level 4 (thường là các rule names: "Pj 1. Tên luật")
            let shortLabel = text;
            let isRule = false;
            let ruleLabelForMem = `heading-${uid}`;

            if (level === 4) {
                isRule = true;
                // Thử tìm số trong chuỗi (VD: "Pj 1. Việc đôi lứa" -> "1")
                const digitMatch = text.match(/(\d+)\./) || text.match(/\s(\d+)\s/) || text.match(/(\d+)$/);
                if (digitMatch) {
                    shortLabel = digitMatch[1];
                }
                if (shortLabel.length > 3) shortLabel = shortLabel.substring(0, 3);
            }

            const link = this._createLink(uid, isRule ? shortLabel : text, text, ruleLabelForMem);

            // --- Hierarchy Logic ---
            if (level === 1) {
                 const li = document.createElement('li');
                 li.className = 'toc-item level-title';
                 li.appendChild(link);
                 mainList.appendChild(li);
                 
                 currentH2Li = null;
                 currentH3Li = null;
                 currentRuleList = null;
            }
            else if (level === 2) {
                const li = document.createElement('li');
                li.className = 'toc-item level-h2';
                li.appendChild(link);
                mainList.appendChild(li);
                
                currentH2Li = li;
                currentH3Li = null;
                currentRuleList = null;
            }
            else if (level === 3) {
                const li = document.createElement('li');
                li.className = 'toc-item level-h3';
                li.appendChild(link);
                
                if (currentH2Li) {
                    mainList.appendChild(li); 
                } else {
                    mainList.appendChild(li);
                }
                
                currentH3Li = li;
                currentRuleList = null;
            }
            else if (level === 4) {
                const parentLi = currentH3Li || currentH2Li;
                
                if (parentLi) {
                    if (!currentRuleList || currentRuleList.parentElement !== parentLi) {
                        currentRuleList = document.createElement('ul');
                        currentRuleList.className = 'toc-rule-list';
                        parentLi.appendChild(currentRuleList);
                    }

                    link.className = 'toc-link rule-link';
                    
                    const li = document.createElement('li');
                    li.className = 'toc-rule-item';
                    li.appendChild(link);
                    currentRuleList.appendChild(li);
                }
            }
        });

        this.updateMemorizationColors();
        this._setupToggle();
    }

    updateMemorizationColors() {
        if (!this.memorizationManager || !this.container) return;
        const allLinks = this.container.querySelectorAll('.toc-link');
        allLinks.forEach(link => {
            const label = link.dataset.label;
            if (label) {
                const level = this.memorizationManager.getLevel(label);
                if (level > 0) {
                    link.dataset.memLevel = level;
                } else {
                    delete link.dataset.memLevel;
                }
            }
        });
    }

    _createLink(uid, displayTxt, fullText, memLabel) {
        const link = document.createElement('a');
        link.className = 'toc-link';
        link.href = `#segment-${uid}`;
        link.dataset.id = uid;
        link.dataset.label = memLabel; 
        
        link.textContent = displayTxt;
        if (displayTxt !== fullText) {
            link.title = fullText;
        }
        
        link.onclick = (e) => {
            e.preventDefault();
            this._handleLinkClick(uid, link);
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

        this.toggle.addEventListener('click', (e) => {
            if (e) e.stopPropagation();
            
            // Xóa focus ngay lập tức để tránh trạng thái sáng "dính" do focus
            this.toggle.blur();

            if (window.innerWidth > 1024) {
                this.sidebar.classList.toggle('collapsed');
                const container = document.querySelector('.container');
                if (container) container.classList.toggle('sidebar-collapsed');
            } else {
                this.sidebar.classList.toggle('visible');
            }
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