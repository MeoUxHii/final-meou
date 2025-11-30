// Import các module chuẩn ES6
import { handleSmartChat } from "./lib/chat-service.js";
import { translateText, handleImageTranslation, handleCroppedImageTranslation } from "./lib/translation-service.js";
import { callGoogleCloudTTS, getGoogleVoices } from "./lib/api-client.js";
// [ĐÃ XÓA] import { AdblockManager } ...
import { BgSettingsManager, BgChatService, BgHistoryManager } from './modules/bg-services.js';
// [MỚI] Import Magic Eye Service để xử lý chụp ảnh
import { MagicEyeService } from './modules/magic-eye-service.js';

// --- KHỞI TẠO CÁC SERVICE ---
// [ĐÃ XÓA] const adblockManager = new AdblockManager();
const settingsManager = new BgSettingsManager();
const chatService = new BgChatService();
const historyManager = new BgHistoryManager();
// [QUAN TRỌNG] Khởi tạo Magic Eye để nó nạp luật sửa lỗi YouTube
const magicEyeService = new MagicEyeService();

console.log("🚀 MeoU Background Services Loaded!");

// Khởi tạo Context Menu và xử lý INSTALL
chrome.runtime.onInstalled.addListener((details) => {
  console.log('MeoU đã được cài đặt/cập nhật!');
  
  if (details.reason === 'install') {
    if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        chrome.tabs.create({ url: 'options.html' });
    }
  }
  
  chrome.contextMenus.create({ id: "translate_image", title: "Hình đó có gì?", contexts: ["image"] });
  // [ĐÃ XÓA] Menu toggle-adblock-menu
  // [ĐÃ XÓA] adblockManager.init();
  
  // [ĐÃ XÓA] Phần khởi tạo stats totalAdsBlocked
});

// [ĐÃ XÓA] updateStats function
// [ĐÃ XÓA] chrome.declarativeNetRequest.onRuleMatchedDebug

// --- XỬ LÝ TIN NHẮN TỪ CONTENT SCRIPT ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // [ĐÃ XÓA] handler cho 'ad_blocked'
    
    // Chat & Dịch thuật
    if (request.action === 'chat_request') { chatService.processMessage(request.text).then(sendResponse); return true; }
    // [ĐÃ XÓA] handler cho 'get_adblock_status'
    // [ĐÃ XÓA] handler cho 'set_adblock_status'

    if (request.action === "translate") { translateText(request.text, request.targetLangOverride).then(sendResponse); return true; }
    if (request.action === "speak") { callGoogleCloudTTS(request.text).then(sendResponse); return true; }
    if (request.action === "get_voices") { getGoogleVoices(request.langCode).then(sendResponse); return true; }
    if (request.action === "getHistory") { chrome.storage.local.get(["translationHistory"], (data) => sendResponse({ history: data.translationHistory || [] })); return true; }
    if (request.action === "clearHistory") { chrome.storage.local.set({ translationHistory: [] }, () => sendResponse({ success: true })); return true; }
    
    // Screenshot & Magic Eye
    if (request.action === "capture_visible_tab") { chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 80 }, (dataUrl) => sendResponse(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : { dataUrl })); return true; }
    if (request.action === "translate_image_data") { handleCroppedImageTranslation(request.imageData).then(sendResponse); return true; }
    
    // AI Chat Stream
    if (request.action === "chat") { processChatResponse(request, sendResponse); sendResponse({ status: "processing" }); return true; }
    
    // Lưu ý: Các message "CROP_IMAGE", "CROP_COMPLETE" của Magic Eye 
    // đã được magicEyeService.setupListeners() tự động lắng nghe rồi, không cần thêm ở đây.
});

// Context Menus
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "translate-selection") handleTranslation(info.selectionText, tab);
    // [ĐÃ XÓA] handler cho toggle-adblock-menu
    else if (info.menuItemId === "translate_image" && tab.id) handleImageTranslation(info.srcUrl, tab.id);
});

// --- [QUAN TRỌNG] XỬ LÝ PHÍM TẮT (COMMANDS) ---
chrome.commands.onCommand.addListener((command) => {
    console.log(`🎹 Command received: ${command}`);
    
    if (command === "translate-text") {
        // Dịch văn bản bôi đen
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) chrome.scripting.executeScript({ target: {tabId: tabs[0].id}, function: () => window.getSelection().toString() }, (results) => { if (results?.[0]?.result) handleTranslation(results[0].result, tabs[0]); });
        });
    } 
    // [ĐÃ XÓA] Command toggle-adblock
    else if (command === "activate_magic_eye") {
        // [FIXED] Gọi Magic Eye Service để chụp màn hình
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                console.log("✨ Kích hoạt Magic Eye trên tab:", tabs[0].id);
                magicEyeService.handleCommand(command, tabs[0]);
            }
        });
    }
});

async function handleTranslation(text, tab) {
    const settings = await settingsManager.getSettings();
    chrome.tabs.sendMessage(tab.id, { action: "show_translation_ui", text: text });
}

function safeSendMessage(message) { chrome.runtime.sendMessage(message).catch(() => {}); }
function calculateTypingDelay(text) { return Math.min(Math.max(400 + (text ? text.length * 100 : 500), 600), 3500); }

async function processChatResponse(request, sendResponse) {
    const response = await handleSmartChat(request.history, request.tone);
    if (!response.success) { safeSendMessage({ action: "chat_error", error: response.error, tone: request.tone }); return; }
    const fullReply = response.reply;
    const lines = fullReply.split('\n').filter(line => line.trim() !== '');
    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i].trim();
        if (!lineText) continue;
        if (i > 0) {
            safeSendMessage({ action: "chat_typing", tone: request.tone, isTyping: true });
            await new Promise(r => setTimeout(r, calculateTypingDelay(lineText)));
        }
        const botMsgObj = { role: "model", parts: [{ text: lineText }] };
        const currentData = await chrome.storage.local.get("chatData"); 
        let currentAllChatData = currentData.chatData || {};
        if (!currentAllChatData[request.tone]) currentAllChatData[request.tone] = [];
        currentAllChatData[request.tone].push(botMsgObj);
        if (currentAllChatData[request.tone].length > 50) currentAllChatData[request.tone] = currentAllChatData[request.tone].slice(-50);
        await chrome.storage.local.set({ chatData: currentAllChatData });
        safeSendMessage({ action: "chat_incoming_message", tone: request.tone, message: botMsgObj, isLast: i === lines.length - 1 });
    }
    safeSendMessage({ action: "chat_typing", tone: request.tone, isTyping: false });
}