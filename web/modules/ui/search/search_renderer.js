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
        // Cho phép tìm kiếm flexible với space (chấp nhận cả space và &nbsp;)
        const regexStr = this._escapeRegExp(escapedKeyword).replace(/ /g, '[ \\u00A0]');
        const highlightRegex = new RegExp(`(${regexStr})`, 'gi');
        // Ở snippet vẫn ưu tiên dùng <mark> để đồng bộ
        return escapedText.replace(highlightRegex, '<mark class="search-highlight">$1</mark>');
    }

    _highlightDOMElement(element, keyword) {
        if (!keyword || !element) return;

        // 1. Lấy tất cả các text node trong element
        const textNodes = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }

        // 2. Xây dựng fullText và map vị trí từ fullText về text node
        let fullText = '';
        const nodeMap = [];
        for (const node of textNodes) {
            nodeMap.push({
                node: node,
                start: fullText.length,
                length: node.nodeValue.length
            });
            fullText += node.nodeValue;
        }

        // 3. Tìm tất cả các vị trí match trong fullText
        // Xử lý keyword: chấp nhận cả space và non-breaking space cho mọi khoảng trắng
        // Lưu ý: escapedKeywordReg xử lý trên textContent nên không cần escape HTML entities
        const escapedKeyword = this._escapeRegExp(keyword);
        // Thay thế cả space thường và nbsp trong keyword pattern thành class ký tự [ \u00A0]
        const regexStr = escapedKeyword.replace(/[ \u00A0]/g, '[ \\u00A0]');
        const regex = new RegExp(`(${regexStr})`, 'gi');

        const matches = [];
        let match;
        while ((match = regex.exec(fullText)) !== null) {
            matches.push({
                start: match.index,
                length: match[0].length
            });
        }

        if (matches.length === 0) return;

        // 4. Gom nhóm các highlight task theo từng node
        // Một match có thể trải dài qua nhiều node, ta chia nhỏ nó ra
        const tasksByNode = new Map(); // Map<Node, Array<{start, end}>>

        for (const m of matches) {
            const matchStart = m.start;
            const matchEnd = m.start + m.length;

            for (const item of nodeMap) {
                const nodeStart = item.start;
                const nodeEnd = item.start + item.length;

                // Tính giao điểm giữa match và node
                const intersectStart = Math.max(matchStart, nodeStart);
                const intersectEnd = Math.min(matchEnd, nodeEnd);

                if (intersectStart < intersectEnd) {
                    // Chuyển về tọa độ cục bộ của node
                    const localStart = intersectStart - nodeStart;
                    const localEnd = intersectEnd - nodeStart;

                    if (!tasksByNode.has(item.node)) {
                        tasksByNode.set(item.node, []);
                    }
                    tasksByNode.get(item.node).push({ start: localStart, end: localEnd });
                }
            }
        }

        // 5. Thực hiện highlight trên từng node
        // Sử dụng Fragment để thay thế text node cũ
        for (const [node, ranges] of tasksByNode.entries()) {
            // Sắp xếp range tăng dần để cắt chuỗi từ trái qua phải
            ranges.sort((a, b) => a.start - b.start);

            // Gộp các range chồng lấn hoặc liền kề (nếu có)
            const mergedRanges = [];
            if (ranges.length > 0) {
                let current = ranges[0];
                for (let i = 1; i < ranges.length; i++) {
                    if (current.end >= ranges[i].start) {
                        current.end = Math.max(current.end, ranges[i].end);
                    } else {
                        mergedRanges.push(current);
                        current = ranges[i];
                    }
                }
                mergedRanges.push(current);
            }

            // Tạo Fragment thay thế
            const fragment = document.createDocumentFragment();
            const textValue = node.nodeValue;
            let lastIndex = 0;

            for (const range of mergedRanges) {
                // Phần text trước match
                if (range.start > lastIndex) {
                    fragment.appendChild(document.createTextNode(textValue.substring(lastIndex, range.start)));
                }

                // Phần match -> bọc trong mark
                const mark = document.createElement('mark');
                mark.className = 'search-highlight';
                mark.textContent = textValue.substring(range.start, range.end);
                fragment.appendChild(mark);

                lastIndex = range.end;
            }

            // Phần text còn lại sau match cuối cùng
            if (lastIndex < textValue.length) {
                fragment.appendChild(document.createTextNode(textValue.substring(lastIndex)));
            }

            // Thay thế text node bằng fragment
            node.parentNode.replaceChild(fragment, node);
        }
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