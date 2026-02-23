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
import { AudioZipLoader } from 'services/audio_zip_loader.js';
import { SplashManager } from 'utils/splash.js';

document.addEventListener('DOMContentLoaded', async () => {
    setupPWA();

    // [iOS Fix] Delay khởi động nặng để tránh crash lúc mở app
    await new Promise(resolve => setTimeout(resolve, 150));

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

    const contentRenderer = new ContentRenderer(
        'content',
        (segmentId, audio, text) => { ttsPlayer.playSegment(segmentId, audio, text); },
        (sequence, parentId) => { ttsPlayer.playSequence(sequence, parentId); }
    );

    const tocRenderer = new TocRenderer('toc-list', 'sidebar', 'sidebar-toggle', contentRenderer);

    const controlBar = new ControlBar(
        () => { /* Play All */
            if (ttsPlayer.isPaused) {
                ttsPlayer.resume();
            } else {
                const startId = contentRenderer.getFirstVisibleSegmentId();
                if (startId) {
                    const sequence = contentLoader.getSegmentsStartingFrom(startId);
                    if (sequence.length > 0) ttsPlayer.playSequence(sequence);
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
        SplashManager.updateStatus("Đang tải cơ sở dữ liệu...");
        const data = await contentLoader.load();
        
        SplashManager.updateStatus("Đang sắp xếp nội dung...");
        // Render nội dung
        contentRenderer.render(data);
        tocRenderer.render(data);

        // Xóa Màn hình chờ (Splash Screen)
        SplashManager.hide();

        // Kích hoạt tiến trình tải audio.zip và giải nén (Sau khi giao diện đã sẵn sàng)
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                const zipLoader = new AudioZipLoader(contentLoader);
                zipLoader.loadAndInject();
            });
        } else {
            setTimeout(() => {
                const zipLoader = new AudioZipLoader(contentLoader);
                zipLoader.loadAndInject();
            }, 3000);
        }

    } catch (error) {
        console.error("Initialization Error:", error);
        SplashManager.hide();
        document.getElementById('content').innerHTML = `<div class="error" style="text-align: center; margin-top: 50px; color: red;">Không thể tải dữ liệu. Vui lòng kiểm tra lại đường truyền và thử lại sau.</div>`;
    }
});

