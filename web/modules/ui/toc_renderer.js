// Path: web/modules/ui/toc_renderer.js

export class TocRenderer {
    constructor(containerId, sidebarId, sidebarToggleId) {
        this.container = document.getElementById(containerId);
        this.sidebar = document.getElementById(sidebarId);
        this.toggle = document.getElementById(sidebarToggleId);
        this.activeLink = null;
    }

    render(sections) {
        if (!this.container) return;
        this.container.innerHTML = '';

        let currentRuleList = null;

        sections.forEach((section, index) => {
            const sectionId = `section-${index}`;

            if (section.level === 3) {
                // Rule Section - Group into a list/grid
                if (!currentRuleList) {
                    currentRuleList = document.createElement('ul');
                    currentRuleList.className = 'toc-sub-list';
                    this.container.appendChild(currentRuleList);
                }

                const li = document.createElement('li');
                li.className = 'toc-item level-rule';
                
                const link = document.createElement('a');
                link.className = 'toc-link rule-link';
                link.href = `#${sectionId}`;
                // Display just the number for compactness in grid, or "Điều X" if preferred.
                // Given the user said "skip đến các rule một cách nhanh chóng", a grid of numbers is usually best.
                link.textContent = section.heading; 
                link.title = `Điều ${section.heading}`;
                link.onclick = (e) => this._handleLinkClick(e, sectionId, link);
                
                li.appendChild(link);
                currentRuleList.appendChild(li);

            } else {
                // Normal Section (Level 1, 2)
                currentRuleList = null; // Break the rule list group

                const li = this._createSectionItem(section, sectionId);
                this.container.appendChild(li);

                // Check for nested rules inside this section (if any remaining - legacy support)
                const ruleSegments = section.segments.filter(s => s.is_rule_start);
                if (ruleSegments.length > 0) {
                    const ruleListUl = this._createRuleList(ruleSegments, sectionId);
                    this.container.appendChild(ruleListUl);
                }
            }
        });

        this._setupToggle();
    }

    _createSectionItem(section, sectionId) {
        const li = document.createElement('li');
        li.className = `toc-item level-${section.level || 1}`;
        
        const link = document.createElement('a');
        link.className = 'toc-link';
        link.href = `#${sectionId}`;
        link.textContent = section.heading;
        link.onclick = (e) => this._handleLinkClick(e, sectionId, link);
        
        li.appendChild(link);
        return li;
    }

    _createRuleList(ruleSegments, sectionId) {
        const ul = document.createElement('ul');
        ul.className = 'toc-sub-list';
        
        ruleSegments.forEach((ruleSeg, rIndex) => {
            const li = document.createElement('li');
            li.className = 'toc-item level-rule';
            
            const ruleLink = document.createElement('a');
            ruleLink.className = 'toc-link rule-link';
            const ruleId = `rule-${sectionId}-${ruleSeg.rule_label}`;
            ruleLink.href = `#${ruleId}`;
            ruleLink.textContent = ruleSeg.rule_label;
            ruleLink.onclick = (e) => this._handleLinkClick(e, ruleId, ruleLink);
            
            li.appendChild(ruleLink);
            ul.appendChild(li);
        });
        
        return ul;
    }

    _handleLinkClick(e, targetId, linkElement) {
        e.preventDefault();
        this._scrollTo(targetId);
        this._setActive(linkElement);
    }

    _scrollTo(id) {
        const target = document.getElementById(id);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
            if (window.innerWidth <= 1024 && this.sidebar) {
                this.sidebar.classList.remove('visible');
            }
        }
    }

    _setActive(element) {
        if (this.activeLink) this.activeLink.classList.remove('active');
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
