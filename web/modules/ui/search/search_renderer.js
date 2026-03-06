// Path: web/modules/ui/search/search_renderer.js
export class SearchRenderer {
    constructor(contentLoader, contentRenderer, searchSheet) {
        this.contentLoader = contentLoader;
        this.contentRenderer = contentRenderer;
        this.sheet = searchSheet;
        this.resultsContainer = document.getElementById('search-results-container');
    }

    async performSearch(keyword, activeSegmentId) {
        this.sheet.open();
        if (this.resultsContainer) {
            this.resultsContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Đang tìm kiếm...</div>';
        }

        if (activeSegmentId && this.contentRenderer) {
            localStorage.setItem('sutta_last_segment_id', activeSegmentId.toString());
            const containerRect = this.contentRenderer.scrollManager.container.getBoundingClientRect();
            const anchor = { id: activeSegmentId, top: containerRect.top + 10 };
            this.contentRenderer.scrollManager.scrollToAnchor(anchor);
        }

        const results = await this.contentLoader.searchSegments(keyword);
        this._renderResults(results, keyword);
    }

    _renderResults(results, keyword) {
        if (!this.resultsContainer) return;

        if (!results || results.length === 0) {
            this.resultsContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Không tìm thấy đoạn văn nào chứa cụm từ này.</div>';
            return;
        }

        let html = `
            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
                Tìm thấy <strong>${results.length}</strong> kết quả cho "<strong>${this._escapeHtml(keyword)}</strong>"
            </div>
        `;

        const groupedResults = [];
        const seenGroups = new Map();

        results.forEach(res => {
            let breadcrumbs = res.breadcrumbs ? res.breadcrumbs : '';
            if (breadcrumbs) {
                const parts = breadcrumbs.split(' > ');
                if (parts.length > 1) breadcrumbs = parts.slice(1).join(' > ');
            }

            const groupKey = `${res.rule_id || 'no-rule'}-${breadcrumbs}`;
            let snippet = res.segment_snippet || this._highlightKeyword(res.raw_segment, keyword);

            if (seenGroups.has(groupKey)) {
                const group = seenGroups.get(groupKey);
                if (group.snippets.length < 3) {
                    group.snippets.push({ id: res.id, html: snippet });
                } else if (group.snippets.length === 3) {
                    group.snippets.push({ id: null, html: '<div style="font-style: italic; color: var(--text-light); margin-top: 4px;">... (còn nữa)</div>' });
                }
            } else {
                const newGroup = {
                    id: res.id,
                    heading_id: res.heading_id,
                    breadcrumbs: breadcrumbs,
                    rule_id: res.rule_id,
                    rule_viet: res.rule_viet,
                    rule_pali: res.rule_pali,
                    rule_acronym: res.rule_acronym,
                    snippets: [{ id: res.id, html: snippet }]
                };
                seenGroups.set(groupKey, newGroup);
                groupedResults.push(newGroup);
            }
        });

        groupedResults.forEach(group => {
            let ruleText = '';
            if (group.rule_id) {
                const acronym = group.rule_acronym ? `<span class="rule-acronym">${this._escapeHtml(group.rule_acronym)}.</span> ` : '';
                const viet = `<span class="rule-viet">${this._escapeHtml(group.rule_viet)}</span>`;
                const pali = group.rule_pali ? ` <span class="rule-pali">(${this._escapeHtml(group.rule_pali)})</span>` : '';
                ruleText = `<div class="search-result-rule">${acronym}${viet}${pali}</div>`;
            }

            const combinedSnippets = group.snippets.map(s => {
                return s.id ? `<div class="search-snippet-item" data-id="${s.id}">${s.html}</div>` : `<div>${s.html}</div>`;
            }).join('<div style="margin: 6px 0; border-top: 1px dashed var(--border-light);"></div>');

            html += `
                <div class="search-result-card" data-id="${group.id}" data-rule-id="${group.rule_id || ''}" data-heading-id="${group.heading_id || ''}">
                    ${group.breadcrumbs ? `<span class="search-result-breadcrumbs">${this._escapeHtml(group.breadcrumbs)}</span>` : ''}
                    ${ruleText}
                    <div class="search-result-text">${combinedSnippets}</div>
                    <div class="search-result-expanded-content hidden" style="margin-top: 1rem; border-top: 1px solid var(--border-light); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
                </div>
            `;
        });

        this.resultsContainer.innerHTML = html;
        this._attachCardEvents(keyword);
    }

    _attachCardEvents(keyword) {
        const cards = this.resultsContainer.querySelectorAll('.search-result-card');
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                const expandedContent = card.querySelector('.search-result-expanded-content');
                const textContent = card.querySelector('.search-result-text');

                if (e.target.closest('.search-result-expanded-content') && !e.target.closest('.btn-jump')) {
                    return;
                }

                if (!expandedContent.classList.contains('hidden')) {
                    expandedContent.classList.add('hidden');
                    textContent.classList.remove('hidden');
                    return;
                }

                const ruleId = card.dataset.ruleId;
                const headingId = card.dataset.headingId;
                
                let segments = [];
                if (ruleId) {
                    segments = this.contentLoader.getSegmentsByRuleId(ruleId);
                } else if (headingId) {
                    segments = this.contentLoader.getSegmentsByHeadingId(parseInt(headingId, 10));
                }

                if (segments && segments.length > 0) {
                    expandedContent.innerHTML = '';

                    const jumpBtnContainer = document.createElement('div');
                    jumpBtnContainer.style.display = 'flex';
                    jumpBtnContainer.style.justifyContent = 'flex-end';
                    jumpBtnContainer.style.marginBottom = '0.5rem';
                    jumpBtnContainer.innerHTML = `<button class="btn secondary btn-jump" style="font-size: 0.85rem; padding: 4px 10px;"><i class="fas fa-external-link-alt"></i> Đi đến văn bản</button>`;
                    
                    const jumpId = parseInt(card.dataset.id, 10);
                    jumpBtnContainer.querySelector('.btn-jump').addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        this.sheet.close();
                        if (this.contentRenderer) {
                            setTimeout(() => {
                                this.contentRenderer.scrollToSegment(jumpId);
                                setTimeout(() => {
                                    const targetEl = document.querySelector(`.segment[data-id="${jumpId}"] .segment-text`); 
                                    if (targetEl) {
                                        targetEl.classList.add('active-search-highlight');
                                        setTimeout(() => {
                                            targetEl.classList.remove('active-search-highlight');
                                        }, 3000);
                                    }
                                }, 100);
                            }, 50);
                        }
                    });

                    expandedContent.appendChild(jumpBtnContainer);

                    segments.forEach(item => {
                        const segmentEl = this.contentRenderer.segmentFactory.create(item, -1);
                        
                        // Đảm bảo highlight được bôi vào đúng văn bản
                        if (keyword) {
                            this._highlightDOMElement(segmentEl, keyword);
                        }

                        expandedContent.appendChild(segmentEl);
                    });
                    
                    expandedContent.classList.remove('hidden');
                    textContent.classList.add('hidden');
                }
            });
        });
    }

    _highlightKeyword(text, keyword) {
        if (!text || !keyword) return this._escapeHtml(text || '');
        const escapedText = this._escapeHtml(text);
        const escapedKeyword = this._escapeHtml(keyword);
        const highlightRegex = new RegExp(`(${this._escapeRegExp(escapedKeyword)})`, 'gi');
        // Ở snippet vẫn ưu tiên dùng <mark> để đồng bộ
        return escapedText.replace(highlightRegex, '<mark class="search-highlight">$1</mark>');
    }

    _highlightDOMElement(element, keyword) {
        if (!keyword || !element) return;
        
        const regex = new RegExp(`(${this._escapeRegExp(keyword)})`, 'gi');
        
        const walkAndHighlight = (node) => {
            if (node.nodeType === 3) { // Node.TEXT_NODE
                const text = node.nodeValue;
                // Kiểm tra có văn bản không rỗng mới thực hiện replace
                if (text && text.trim() !== '' && regex.test(text)) {
                    regex.lastIndex = 0; // Reset regex
                    
                    // Tạo một container ảo để render HTML
                    const tempDiv = document.createElement('div');
                    // Thay thế thẻ <span> bằng thẻ <mark>
                    tempDiv.innerHTML = text.replace(regex, '<mark class="search-highlight">$1</mark>');
                    
                    // Chèn các node mới vào trước text node cũ
                    while (tempDiv.firstChild) {
                        node.parentNode.insertBefore(tempDiv.firstChild, node);
                    }
                    // Xóa text node cũ
                    node.parentNode.removeChild(node);
                }
            } else if (node.nodeType === 1) { // Node.ELEMENT_NODE
                // Không đi vào script, style và không đi vào các thẻ <mark> vừa tạo để tránh lặp vô hạn
                if (!/(script|style|mark)/i.test(node.tagName) && !node.classList.contains('search-highlight')) {
                    Array.from(node.childNodes).forEach(child => walkAndHighlight(child));
                }
            }
        };

        walkAndHighlight(element);
    }

    _escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    _escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}