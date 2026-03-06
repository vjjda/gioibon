// Path: web/modules/ui/search_manager.js
export class SearchManager {
    constructor(contentLoader, contentRenderer) {
        this.contentLoader = contentLoader;
        this.contentRenderer = contentRenderer;

        // UI Elements
        this.tooltip = document.getElementById('selection-tooltip');
        this.btnSearch = document.getElementById('btn-search-selection');
        this.bottomSheet = document.getElementById('search-bottom-sheet');
        this.sheetOverlay = document.getElementById('search-sheet-overlay');
        this.btnCloseSheet = document.getElementById('btn-close-search-sheet');
        this.resultsContainer = document.getElementById('search-results-container');
        this.dragHandle = this.bottomSheet.querySelector('.bottom-sheet-drag-handle');

        this.currentSelection = '';
        this.activeSegmentId = null;

        this._setupListeners();
        this._setupDragToClose();
    }

    _setupListeners() {
        // Handle text selection
        document.addEventListener('selectionchange', () => {
            this._handleSelection();
        });

        // Hide tooltip when clicking elsewhere
        document.addEventListener('mousedown', (e) => {
            if (this.tooltip && !this.tooltip.contains(e.target) && !this.btnSearch.contains(e.target)) {
                this._hideTooltip();
            }
        });

        document.addEventListener('touchstart', (e) => {
            if (this.tooltip && !this.tooltip.contains(e.target) && !this.btnSearch.contains(e.target)) {
                // Short delay to allow selection to update
                setTimeout(() => {
                    const selection = window.getSelection();
                    if (!selection || selection.isCollapsed) {
                        this._hideTooltip();
                    }
                }, 10);
            }
        });

        // Search Button Click
        if (this.btnSearch) {
            this.btnSearch.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this._performSearch();
            });
        }

        // Close Sheet
        if (this.btnCloseSheet) {
            this.btnCloseSheet.addEventListener('click', () => this._closeSheet());
        }

        if (this.sheetOverlay) {
            this.sheetOverlay.addEventListener('click', () => this._closeSheet());
        }
    }

    _handleSelection() {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
            this._hideTooltip();
            return;
        }

        const text = selection.toString().trim();
        // Only show tooltip if selection is reasonable length (not just 1 char, not entire page)
        if (text.length > 1 && text.length < 150) {
            this.currentSelection = text;
            this._showTooltip(selection);
            
            // Highlight active segment and scroll it
            this._highlightActiveSegment(selection);
        } else {
            this._hideTooltip();
        }
    }

    _showTooltip(selection) {
        if (!this.tooltip) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        if (rect.width === 0 && rect.height === 0) return; // Invisible selection

        // Kiểm tra xem có phải thiết bị di động không
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (isMobile) {
            // Trên Mobile: Ưu tiên đặt phía dưới vùng chọn để tránh menu Copy/Share mặc định của trình duyệt
            const top = rect.bottom + window.scrollY;
            const left = rect.left + window.scrollX + (rect.width / 2);
            
            this.tooltip.style.top = `${top}px`;
            this.tooltip.style.left = `${left}px`;
            this.tooltip.classList.add('at-bottom');
        } else {
            // Trên Desktop: Đặt phía trên như cũ
            const top = rect.top + window.scrollY;
            const left = rect.left + window.scrollX + (rect.width / 2);
            
            this.tooltip.style.top = `${top}px`;
            this.tooltip.style.left = `${left}px`;
            this.tooltip.classList.remove('at-bottom');
        }
        
        this.tooltip.classList.remove('hidden');
    }

    _hideTooltip() {
        if (this.tooltip) {
            this.tooltip.classList.add('hidden');
        }
    }

    _highlightActiveSegment(selection) {
        // Find the segment element containing the selection
        let node = selection.anchorNode;
        let segmentEl = null;

        while (node && node !== document.body) {
            if (node.nodeType === 1 && node.classList.contains('segment')) {
                segmentEl = node;
                break;
            }
            node = node.parentNode;
        }

        if (segmentEl) {
            const segmentId = segmentEl.dataset.id;
            // Remove previous highlight
            if (this.activeSegmentId && this.activeSegmentId !== segmentId) {
                const prevEl = document.querySelector(`.segment[data-id="${this.activeSegmentId}"] .segment-text`);
                if (prevEl) prevEl.classList.remove('active-search-highlight');
            }

            this.activeSegmentId = segmentId;
            const textEl = segmentEl.querySelector('.segment-text');
            if (textEl) {
                textEl.classList.add('active-search-highlight');
            }
        }
    }

    _clearActiveHighlight() {
        if (this.activeSegmentId) {
            const prevEl = document.querySelector(`.segment[data-id="${this.activeSegmentId}"] .segment-text`);
            if (prevEl) prevEl.classList.remove('active-search-highlight');
            this.activeSegmentId = null;
        }
    }

    async _performSearch() {
        this._hideTooltip();
        this._openSheet();
        this.resultsContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Đang tìm kiếm...</div>';

        // Move segment to just below header
        if (this.activeSegmentId && this.contentRenderer) {
            // Ép lưu vị trí ngay lập tức để tránh lỗi lệch khi người dùng refresh ngay sau khi search
            localStorage.setItem('sutta_last_segment_id', this.activeSegmentId.toString());
            const containerRect = this.contentRenderer.scrollManager.container.getBoundingClientRect();
            const anchor = { id: this.activeSegmentId, top: containerRect.top + 10 };
            this.contentRenderer.scrollManager.scrollToAnchor(anchor);
        }

        const keyword = this.currentSelection;
        const results = await this.contentLoader.searchSegments(keyword);
        this._renderResults(results, keyword);
    }

    _renderResults(results, keyword) {
        if (!results || results.length === 0) {
            this.resultsContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Không tìm thấy đoạn văn nào chứa cụm từ này.</div>';
            return;
        }

        let html = `
            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 1rem;">
                Tìm thấy <strong>${results.length}</strong> kết quả cho "<strong>${this._escapeHtml(keyword)}</strong>"
            </div>
        `;

        // Gom nhóm kết quả theo rule_id và breadcrumbs
        const groupedResults = [];
        const seenGroups = new Map();

        results.forEach(res => {
            let breadcrumbs = res.breadcrumbs ? res.breadcrumbs : '';
            if (breadcrumbs) {
                const parts = breadcrumbs.split(' > ');
                if (parts.length > 1) {
                    breadcrumbs = parts.slice(1).join(' > ');
                }
            }

            // Tạo một khóa duy nhất cho nhóm
            const groupKey = `${res.rule_id || 'no-rule'}-${breadcrumbs}`;
            
            let snippet = res.segment_snippet;
            if (!snippet) {
                snippet = this._highlightKeyword(res.raw_segment, keyword);
            }

            if (seenGroups.has(groupKey)) {
                // Đã có nhóm này, thêm snippet vào nhóm đó
                const group = seenGroups.get(groupKey);
                // Chỉ gộp tối đa 3 snippet để tránh thẻ quá dài
                if (group.snippets.length < 3) {
                    group.snippets.push({ id: res.id, html: snippet });
                } else if (group.snippets.length === 3) {
                    group.snippets.push({ id: null, html: '<div style="font-style: italic; color: var(--text-light); margin-top: 4px;">... (còn nữa)</div>' });
                }
            } else {
                // Tạo nhóm mới
                const newGroup = {
                    id: res.id, // Dùng ID của segment đầu tiên tìm thấy để jump
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

            // Gộp các snippet lại với nhau
            const combinedSnippets = group.snippets.map(s => {
                if (s.id) {
                    return `<div class="search-snippet-item" data-id="${s.id}">${s.html}</div>`;
                }
                return `<div>${s.html}</div>`; // "còn nữa" element
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

        // Add click events to cards
        const cards = this.resultsContainer.querySelectorAll('.search-result-card');
        cards.forEach(card => {
            card.addEventListener('click', (e) => {
                const expandedContent = card.querySelector('.search-result-expanded-content');
                const textContent = card.querySelector('.search-result-text');

                // Ngăn chặn event click trên các nút (như Play) trong expandedContent
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

                    // Bổ sung nút Jump để phòng khi người dùng vẫn muốn cuộn tới văn bản chính
                    const jumpBtnContainer = document.createElement('div');
                    jumpBtnContainer.style.display = 'flex';
                    jumpBtnContainer.style.justifyContent = 'flex-end';
                    jumpBtnContainer.style.marginBottom = '0.5rem';
                    jumpBtnContainer.innerHTML = `<button class="btn secondary btn-jump" style="font-size: 0.85rem; padding: 4px 10px;"><i class="fas fa-external-link-alt"></i> Đi đến văn bản</button>`;
                    
                    const jumpId = parseInt(card.dataset.id, 10);
                    
                    jumpBtnContainer.querySelector('.btn-jump').addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        this._closeSheet();
                        this._clearActiveHighlight();
                        if (this.contentRenderer) {
                            setTimeout(() => {
                                this.contentRenderer.scrollToSegment(jumpId);
                                setTimeout(() => {
                                    const targetEl = document.querySelector(`.segment[data-id="${jumpId}"] .segment-text`); 
                                    if (targetEl) {
                                        targetEl.classList.add('active-search-highlight');
                                        this.activeSegmentId = jumpId;
                                        setTimeout(() => {
                                            if (this.activeSegmentId === jumpId) {
                                                targetEl.classList.remove('active-search-highlight');
                                                this.activeSegmentId = null;
                                            }
                                        }, 3000);
                                    }
                                }, 100);
                            }, 50);
                        }
                    });

                    expandedContent.appendChild(jumpBtnContainer);

                    // Sử dụng SegmentFactory để tạo DOM và highlight keyword
                    segments.forEach(item => {
                        const segmentEl = this.contentRenderer.segmentFactory.create(item, -1);
                        
                        // Highlight keyword một cách an toàn bên trong DOM (không làm hỏng HTML tag)
                        const textEl = segmentEl.querySelector('.segment-text');
                        if (textEl && keyword) {
                            this._highlightDOMElement(textEl, keyword);
                        }

                        expandedContent.appendChild(segmentEl);
                    });
                    
                    expandedContent.classList.remove('hidden');
                    textContent.classList.add('hidden'); // Ẩn kết quả snippet
                }
            });
        });
    }

    _highlightKeyword(text, keyword) {
        if (!text || !keyword) return this._escapeHtml(text || '');
        const regex = new RegExp(`(${this._escapeRegExp(keyword)})`, 'gi');
        // Escape HTML before replacing to prevent XSS if segment contains raw HTML tags
        const escapedText = this._escapeHtml(text);
        const escapedKeyword = this._escapeHtml(keyword);
        
        const highlightRegex = new RegExp(`(${this._escapeRegExp(escapedKeyword)})`, 'gi');
        return escapedText.replace(highlightRegex, '<span class="search-highlight">$1</span>');
    }

    _highlightDOMElement(element, keyword) {
        if (!keyword || !element) return;
        const regex = new RegExp(`(${this._escapeRegExp(keyword)})`, 'gi');
        
        // Dùng TreeWalker để chỉ duyệt qua các TextNode, bỏ qua các thẻ HTML
        const walk = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        let node;
        while ((node = walk.nextNode())) {
            textNodes.push(node);
        }

        textNodes.forEach(n => {
            if (regex.test(n.nodeValue)) {
                // Reset lại lastIndex của regex (do dùng flag 'g')
                regex.lastIndex = 0; 
                
                const fragment = document.createDocumentFragment();
                let lastIdx = 0;
                let match;
                
                const text = n.nodeValue;
                // Tìm tất cả các đoạn khớp trong text node hiện tại
                while ((match = regex.exec(text)) !== null) {
                    const offset = match.index;
                    const matchedStr = match[0];
                    
                    // Thêm đoạn text bình thường nằm trước đoạn khớp
                    if (offset > lastIdx) {
                        fragment.appendChild(document.createTextNode(text.substring(lastIdx, offset)));
                    }
                    
                    // Thêm đoạn text được bọc thẻ span highlight
                    const span = document.createElement('span');
                    span.className = 'search-highlight';
                    span.textContent = matchedStr;
                    fragment.appendChild(span);
                    
                    lastIdx = offset + matchedStr.length;
                }
                
                // Thêm phần text còn lại sau điểm khớp cuối cùng
                if (lastIdx < text.length) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIdx)));
                }
                
                // Thay thế node text ban đầu bằng fragment chứa text và span
                n.parentNode.replaceChild(fragment, n);
            }
        });
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
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    _openSheet() {
        if (this.bottomSheet && this.sheetOverlay) {
            this.bottomSheet.classList.remove('hidden');
            this.sheetOverlay.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
    }

    _closeSheet() {
        if (this.bottomSheet && this.sheetOverlay) {
            this.bottomSheet.classList.add('hidden');
            this.sheetOverlay.classList.add('hidden');
            document.body.style.overflow = '';
            // Don't clear selection automatically, let user click away
            // this._clearActiveHighlight();
        }
    }

    _setupDragToClose() {
        if (!this.dragHandle || !this.bottomSheet) return;

        let startY = 0;
        let currentY = 0;
        let isDragging = false;

        const onTouchStart = (e) => {
            startY = e.touches[0].clientY;
            isDragging = true;
            this.bottomSheet.style.transition = 'none'; // Disable transition for direct drag
        };

        const onTouchMove = (e) => {
            if (!isDragging) return;
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            if (deltaY > 0) { // Only allow dragging downwards
                this.bottomSheet.style.transform = `translateY(${deltaY}px)`;
            }
        };

        const onTouchEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            this.bottomSheet.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
            
            const deltaY = currentY - startY;
            if (deltaY > 100) { // Threshold to close
                this._closeSheet();
                // Reset transform after animation
                setTimeout(() => {
                    this.bottomSheet.style.transform = '';
                }, 300);
            } else {
                // Snap back
                this.bottomSheet.style.transform = 'translateY(0)';
            }
        };

        this.dragHandle.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchmove', onTouchMove, { passive: true });
        document.addEventListener('touchend', onTouchEnd);
    }
}

