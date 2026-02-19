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
        },
        (isLooping) => { // Loop Change
            ttsPlayer.isLooping = isLooping;
        }
    );
    
    controlBar.setSpeed(ttsPlayer.currentRate);

    const contentRenderer = new ContentRenderer(
        'content',
        (segmentId, audio, text) => { 
            ttsPlayer.playSegment(segmentId, audio, text);
        },
        (sequence) => { 
            ttsPlayer.playSequence(sequence);
        }
    );

    const settingsModal = new SettingsModal(ttsPlayer);

    // --- Wire up TTS Events to UI ---
    ttsPlayer.onSegmentStart = (id, isSequence) => {
        contentRenderer.highlightSegment(id, isSequence);
        // [NEW] Cập nhật Icon nút phát
        contentRenderer.updatePlaybackState(ttsPlayer.isPlaying ? 'playing' : 'paused', id, isSequence);
    };

    ttsPlayer.onPlaybackEnd = () => {
        contentRenderer.clearHighlight();
        controlBar.updateState('stopped');
        // [NEW] Reset toàn bộ Icon nút phát
        contentRenderer.updatePlaybackState('stopped', null, false);
    };

    ttsPlayer.onPlaybackStateChange = (state) => {
        controlBar.updateState(state);
        // [NEW] Cập nhật Icon nút phát khi pause/resume
        contentRenderer.updatePlaybackState(state, ttsPlayer.currentSegmentId, ttsPlayer.isSequence);
    };

    // --- Load Content ---
    try {
        const data = await contentLoader.load();
        contentRenderer.render(data);
        tocRenderer.render(data);
    } catch (error) {
        console.error("Initialization Error:", error);
        document.getElementById('content').innerHTML = 
            `<div class="error">Không thể tải dữ liệu. Vui lòng thử lại sau.<br><small>${error.message}</small></div>`;
    }
});

