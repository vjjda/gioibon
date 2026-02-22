// Path: web/modules/main.js

import { SqliteConnection } from 'services/sqlite_connection.js';
import { TTSPlayer } from 'tts/tts_player.js';
import { ContentLoader } from 'data/content_loader.js';
import { TocRenderer } from 'ui/toc_renderer.js';
import { ContentRenderer } from 'ui/content_renderer.js';
import { ControlBar } from 'ui/control_bar.js';
import { SettingsModal } from 'ui/settings_modal.js';
import { HeaderDrawer } from 'ui/header_drawer.js';
import { ThemeSettings } from 'ui/theme_settings.js';
import { FontSettings } from 'ui/font_settings.js';
import { setupPWA } from 'utils/pwa.js';

document.addEventListener('DOMContentLoaded', async () => {
    setupPWA();

    // Khởi tạo kết nối DB dùng chung
    const dbConnection = new SqliteConnection();

    // Truyền DB vào ContentLoader để lấy text
    const contentLoader = new ContentLoader(dbConnection);
    
    // Truyền DB vào TTSPlayer để lấy audio blob
    const ttsPlayer = new TTSPlayer(dbConnection);

    // Đồng bộ trạng thái Loop từ localStorage
    const savedLoop = localStorage.getItem('sutta_loop_enabled') === 'true';
    ttsPlayer.isLooping = savedLoop;

    HeaderDrawer.init();
    ThemeSettings.init();
    FontSettings.init();

    const tocRenderer = new TocRenderer('toc-list', 'sidebar', 'sidebar-toggle');
    
    const controlBar = new ControlBar(
        () => { /* Play All */
            if (ttsPlayer.isPaused) {
                ttsPlayer.resume();
            } else {
                const startId = contentRenderer.getFirstVisibleSegmentId();
                if (startId) {
                    // Logic lấy sequence từ startId -> hết bài
                    // Cần lấy tất cả segments từ DB (đã lọc skip)
                    const allSegments = contentLoader.getAllSegments();
                    const startIndex = allSegments.findIndex(s => String(s.id) === String(startId));
                    if (startIndex !== -1) {
                        const sequence = allSegments.slice(startIndex);
                        ttsPlayer.playSequence(sequence);
                    }
                } else {
                    const allSegments = contentLoader.getAllSegments();
                    if (allSegments.length > 0) ttsPlayer.playSequence(allSegments);
                }
            }
        },
        () => { /* Pause */
            if (ttsPlayer.isPlaying) ttsPlayer.pause();
            else if (ttsPlayer.isPaused) ttsPlayer.resume();
        },
        () => { ttsPlayer.stop(); },
        (newRate) => { ttsPlayer.setRate(newRate); },
        (isLooping) => { ttsPlayer.isLooping = isLooping; }
    );

    controlBar.setSpeed(ttsPlayer.currentRate);

    const contentRenderer = new ContentRenderer(
        'content',
        (segmentId, audio, text) => { ttsPlayer.playSegment(segmentId, audio, text); },
        (sequence, parentId) => { ttsPlayer.playSequence(sequence, parentId); }
    );

    const settingsModal = new SettingsModal(ttsPlayer.engine);

    ttsPlayer.onSegmentStart = (id, isSequence) => {
        contentRenderer.highlightSegment(id, isSequence);
        contentRenderer.updatePlaybackState(ttsPlayer.isPlaying ? 'playing' : 'paused', id, isSequence, ttsPlayer.sequenceParentId);
    };

    ttsPlayer.onPlaybackEnd = () => {
        contentRenderer.clearHighlight();
        controlBar.updateState('stopped');
        contentRenderer.updatePlaybackState('stopped', null, false, null);
    };

    ttsPlayer.onPlaybackStateChange = (state) => {
        controlBar.updateState(state);
        contentRenderer.updatePlaybackState(state, ttsPlayer.currentSegmentId, ttsPlayer.isSequence, ttsPlayer.sequenceParentId);
    };

    try {
        const data = await contentLoader.load();
        
        // Render nội dung
        contentRenderer.render(data);
        tocRenderer.render(data);
        
        // Remove loading
        const loadingEl = document.querySelector('.loading');
        if (loadingEl) loadingEl.remove();

    } catch (error) {
        console.error("Initialization Error:", error);
        document.getElementById('content').innerHTML = `<div class="error">Không thể tải dữ liệu. Vui lòng thử lại sau.</div>`;
    }
});
