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
            const allSegments = contentLoader.getAllSegments();
            if (allSegments.length > 0) {
                if (ttsPlayer.isPaused) {
                    ttsPlayer.resume();
                } else {
                    ttsPlayer.playSequence(allSegments);
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
        }
    );

    const contentRenderer = new ContentRenderer(
        'content',
        (segmentId, text) => { // Play Segment
            ttsPlayer.playSegment(segmentId, text);
        },
        (sectionIndex, segmentIndex) => { // Play Rule
            const segments = contentLoader.getRuleSegments(sectionIndex, segmentIndex);
            if (segments.length > 0) {
                ttsPlayer.playSequence(segments);
            }
        }
    );

    const settingsModal = new SettingsModal(ttsPlayer);

    // --- Wire up TTS Events to UI ---
    ttsPlayer.onSegmentStart = (id) => {
        contentRenderer.highlightSegment(id);
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
        contentRenderer.render(data.sections);
        tocRenderer.render(data.sections);
    } catch (error) {
        console.error("Initialization Error:", error);
        document.getElementById('content').innerHTML = 
            `<div class="error">Không thể tải dữ liệu. Vui lòng thử lại sau.<br><small>${error.message}</small></div>`;
    }
});
