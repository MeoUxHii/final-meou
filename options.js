// Main Options Entry Point
import { loadTheme } from './option/logic/theme.js';
import { setupNavigation } from './option/logic/navigation.js';
import { loadApiSettings, initApiListeners } from './option/logic/api.js';
import { loadTemplates, initShortcutListeners } from './option/logic/shortcuts.js';
import { loadCustomAgents, initAgentListeners } from './option/logic/agents.js';
import { initTagListeners } from './option/logic/tags.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 MeoU Settings Loaded");

    // 1. Setup Interactions FIRST (Ưu tiên cài đặt sự kiện để UI phản hồi ngay)
    // Các hàm này sẽ gắn onclick, onchange... nên cần chạy ngay khi DOM sẵn sàng
    try {
        setupNavigation();
        initShortcutListeners();
        initAgentListeners();
        initTagListeners();
        initApiListeners();
    } catch (e) {
        console.error("Lỗi khởi tạo sự kiện:", e);
    }

    // 2. Load Data & Config (Async - Chạy sau hoặc song song)
    // Dùng Promise.allSettled để lỡ 1 cái lỗi thì mấy cái kia vẫn chạy tiếp
    await Promise.allSettled([
        loadTheme(),
        loadTemplates(),
        loadCustomAgents(),
        loadApiSettings()
    ]);
});