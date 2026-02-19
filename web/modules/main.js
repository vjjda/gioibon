// Path: web/modules/main.js
import { TTSPlayer } from 'tts/tts_player.js';
import { ContentLoader } from 'data/content_loader.js';
import { TocRenderer } from 'ui/toc_renderer.js';
import { ContentRenderer } from 'ui/content_renderer.js';
import { ControlBar } from 'ui/control_bar.js';
import { SettingsModal } from 'ui/settings_modal.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- Initialize Core Components ---
    const ttsPlayer = new TTSPlayer();
    const contentLoader = new ContentLoader();
    
    // --- Initialize UI Components ---
    const tocRenderer = new TocRenderer('toc-list', 'sidebar', 'sidebar-toggle');
    const controlBar = new ControlBar(
        () => { // Play All
            if (ttsPlayer.isPaused) {
                ttsPlayer.resume();
            } else {
                // Try to start from visible segment
                const startId = contentRenderer.getFirstVisibleSegmentId();
                const segments = startId 
                    ? contentLoader.getSegmentsStartingFrom(startId)
                    : contentLoader.getAllSegments();
                
                if (segments.length > 0) {
                    ttsPlayer.playSequence(segments);
                }
            }
        },
        () => { // Pause
            if (ttsPlayer.isPlaying) {
                ttsPlayer.pause();
            } else if (ttsPlayer.isPaused) {
                ttsPlayer.resume();
            }
        },
        () => { // Stop
            ttsPlayer.stop();
        },
        (newRate) => { // Speed Change
            ttsPlayer.setRate(newRate);
        }
    );
    
    // Initialize speed UI from player defaults
    controlBar.setSpeed(ttsPlayer.currentRate);

    const contentRenderer = new ContentRenderer(
        'content',
        (segmentId, audio, text) => { // Play Segment
            ttsPlayer.playSegment(segmentId, audio, text);
        },
        (sequence) => { // Play Rule Sequence
            ttsPlayer.playSequence(sequence);
        }
    );

    const settingsModal = new SettingsModal(ttsPlayer);

    // --- Wire up TTS Events to UI ---
    ttsPlayer.onSegmentStart = (id, isSequence) => {
        contentRenderer.highlightSegment(id, isSequence);
    };

    ttsPlayer.onPlaybackEnd = () => {
        contentRenderer.clearHighlight();
        controlBar.updateState('stopped');
    };

    ttsPlayer.onPlaybackStateChange = (state) => {
        controlBar.updateState(state);
    };

    // --- Load Content ---
    try {
        const data = await contentLoader.load();
        // data is now a flat array of items
        contentRenderer.render(data);
        tocRenderer.render(data);
    } catch (error) {
        console.error("Initialization Error:", error);
        document.getElementById('content').innerHTML = 
            `<div class="error">Không thể tải dữ liệu. Vui lòng thử lại sau.<br><small>${error.message}</small></div>`;
    }
});
