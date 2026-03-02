// Path: web/modules/ui/content_renderer.js
import { SegmentFactory } from 'ui/content/segment_factory.js';
import { MaskManager } from 'ui/content/mask_manager.js';
import { ScrollManager } from 'ui/content/scroll_manager.js';
import { KeyboardHandler } from 'ui/content/keyboard_handler.js';
import { LazyRenderer } from 'ui/content/lazy_renderer.js';
import { PlaybackUIUpdater } from 'ui/content/playback_ui.js';
import { SequenceBuilder } from 'ui/content/sequence_builder.js';

import { CustomDialog } from 'ui/custom_dialog.js';

export class ContentRenderer {
    constructor(containerId, playSegmentCallback, playSequenceCallback, memorizationManager) {
        this.container = document.getElementById(containerId);
        this.playSegmentCallback = playSegmentCallback;
        this.playSequenceCallback = playSequenceCallback;
        this.memorizationManager = memorizationManager;
        
        this.items = [];
        this.hoveredSegmentId = null;
        this.elementCache = new Map();

        // --- Sub-modules (Composition) ---
        this.maskManager = new MaskManager(this.container);
        
        this.segmentFactory = new SegmentFactory({
            playSegment: this.playSegmentCallback,
            playSequence: (index) => this.playSequenceFromIndex(index),
            onMaskStart: (e, el, item) => this.maskManager.handleMaskStart(e, el, item),
            onMaskEnter: (e, el) => this.maskManager.handleMaskEnter(e, el),
            onHover: (id) => { this.hoveredSegmentId = id; }
        }, this.memorizationManager);

        this.lazyRenderer = new LazyRenderer(this.container, this.elementCache, this.segmentFactory);
        
        this.scrollManager = new ScrollManager(
            this.container,
            this.elementCache,
            () => this.items,
            (targetIndex) => this.lazyRenderer.ensureRendered(targetIndex)
        );

        this.keyboardHandler = new KeyboardHandler(
            () => this.hoveredSegmentId,
            () => this.items,
            () => this.elementCache,
            this.maskManager,
            this.playSegmentCallback,
            (index) => this.playSequenceFromIndex(index)
        );

        this.playbackUI = new PlaybackUIUpdater(this.container, this.elementCache);

        if (this.memorizationManager) {
            this.memorizationManager.onChange(() => {
                this.updateMemorizationUI();
            });
        }
    }

    render(items) {
        this.items = items || [];
        this.maskManager.setItems(this.items);
        this.scrollManager.clearHighlight();
        this.lazyRenderer.render(this.items);
    }

    playSequenceFromIndex(startIndex) {
        if (!this.playSequenceCallback) return;
        
        const result = SequenceBuilder.build(this.items, startIndex);
        if (result && result.sequence.length > 0) {
            this.playSequenceCallback(result.sequence, result.startId);
        } else {
            CustomDialog.alert("Không có dữ liệu âm thanh cho phần này.", "Thông báo");
        }
    }

    // --- Public API Facades ---

    scrollToSegment(id) {
        this.scrollManager.scrollToSegment(id);
    }

    highlightSegment(id, shouldScroll = true, scrollMode = 'smart') {
        this.scrollManager.highlightSegment(id, shouldScroll, scrollMode);
    }

    clearHighlight() {
        this.scrollManager.clearHighlight();
    }

    updatePlaybackState(state, activeSegmentId, isSequence, sequenceParentId) {
        this.playbackUI.update(state, activeSegmentId, isSequence, sequenceParentId);
    }

    getFirstVisibleSegmentId() {
        if (!this.container) return null;
        
        const segments = this.container.querySelectorAll('.segment');
        for (const segment of segments) {
            const rect = segment.getBoundingClientRect();
            if (rect.top + rect.height > 80 && rect.top < window.innerHeight) {
                if (parseInt(segment.dataset.id)) {
                    return parseInt(segment.dataset.id);
                }
            }
        }
        return null;
    }

    updateMemorizationUI() {
        if (!this.container || !this.memorizationManager) return;
        const containers = this.container.querySelectorAll('.memorization-container');
        containers.forEach(container => {
            const label = container.dataset.label;
            const currentLevel = this.memorizationManager.getLevel(label);
            const dots = container.querySelectorAll('.mem-dot');
            dots.forEach((dot, index) => {
                const i = index + 1;
                if (i <= currentLevel) {
                    dot.classList.add('active');
                    dot.dataset.activeLevel = currentLevel;
                } else {
                    dot.classList.remove('active');
                    delete dot.dataset.activeLevel;
                }
            });
        });
    }
}

