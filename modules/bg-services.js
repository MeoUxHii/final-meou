// modules/bg-services.js - Phiên bản Background Độc Lập (No UI code)

// Import logic xử lý API từ thư viện (những file này an toàn cho background)
// Lưu ý: Đường dẫn phải đúng tương đối với folder modules
import { handleSmartChat } from '../lib/chat-service.js';

// --- 1. SETTINGS MANAGER (Background Version) ---
class SettingsManager {
    constructor() {
        this.cache = {};
    }

    async init() {
        // Load settings vào cache để truy xuất nhanh
        try {
            const data = await chrome.storage.sync.get(null);
            this.cache = data;
            
            // Lắng nghe thay đổi settings
            chrome.storage.onChanged.addListener((changes, area) => {
                if (area === 'sync') {
                    for (let key in changes) {
                        this.cache[key] = changes[key].newValue;
                    }
                }
            });
        } catch (e) {
            console.error("Settings init error:", e);
        }
    }

    async getSettings() {
        return this.cache;
    }

    async handleMessage(request) {
        if (request.action === 'get_settings') {
            return this.cache;
        }
        return null;
    }
}

// --- 2. CHAT MANAGER (Background Version) ---
class ChatManager {
    async init() {
        // Có thể load lịch sử chat gần nhất nếu cần
    }

    // Hàm này được gọi từ background.js
    async processMessage(text) {
        try {
            // Gọi AI xử lý (Mặc định tone creative nếu không có config)
            // Lưu ý: handleSmartChat cần truyền vào history (mảng) và tone
            // Ở đây ta xử lý đơn giản cho background
            const response = await handleSmartChat([{ role: 'user', parts: [{ text: text }] }], 'creative');
            return response;
        } catch (e) {
            console.error("Chat process error:", e);
            return { success: false, error: e.message };
        }
    }

    async handleMessage(request, sender) {
        // Xử lý các request chat từ UI gửi xuống (nếu có)
        return null;
    }
}

// --- 3. HISTORY MANAGER (Background Version) ---
class HistoryManager {
    async init() {
        // Dọn dẹp lịch sử cũ nếu cần
        this.cleanupOldHistory();
    }

    async cleanupOldHistory() {
        // Logic dọn dẹp chạy ngầm
        try {
            const data = await chrome.storage.local.get(['translationHistory']);
            let history = data.translationHistory || [];
            if (history.length > 1000) {
                // Giữ lại 1000 tin mới nhất
                history = history.slice(0, 1000);
                await chrome.storage.local.set({ translationHistory: history });
            }
        } catch (e) {
            console.error("History cleanup error:", e);
        }
    }

    async handleMessage(request) {
        if (request.action === 'clear_history') {
            await chrome.storage.local.set({ translationHistory: [] });
            return { success: true };
        }
        return null;
    }
}

// --- MAIN BACKGROUND SERVICES CLASS ---
export class BackgroundServices {
    constructor() {
        this.initialized = false;
        this.settingsManager = new SettingsManager();
        this.chatManager = new ChatManager();
        this.historyManager = new HistoryManager();
    }

    async init() {
        if (this.initialized) return;

        try {
            console.log('MeoU Service: Đang khởi động...');

            // Init song song các service
            await Promise.all([
                this.settingsManager.init(),
                this.chatManager.init(),
                this.historyManager.init()
            ]);

            this.setupMessageListeners();
            this.initialized = true;
            console.log('MeoU Service: Khởi động thành công!');
        } catch (error) {
            console.error('MeoU Service: Lỗi khởi động Fatal:', error);
        }
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            // Routing message đơn giản
            const route = async () => {
                switch (request.target) {
                    case 'settings':
                        return await this.settingsManager.handleMessage(request);
                    case 'chat':
                        return await this.chatManager.handleMessage(request, sender);
                    case 'history':
                        return await this.historyManager.handleMessage(request);
                    default:
                        if (request.action === 'PING') {
                            return { status: 'ok', version: chrome.runtime.getManifest().version };
                        }
                }
            };

            route().then(response => {
                if (response) sendResponse(response);
            });
            
            return true; // Async response
        });
    }
}

// Export Alias để khớp với file background.js của anh
export { SettingsManager as BgSettingsManager };
export { ChatManager as BgChatService };
export { HistoryManager as BgHistoryManager };