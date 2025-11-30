// Hàm xử lý dịch text bôi đen
window.translateSelectedText = async function(clickCoords = null) {
    if (!window.contentState.selectedText) return;

    const popupEl = window.createPopup();
    
    if (typeof popupEl.resetAudio === 'function') popupEl.resetAudio();

    const translatedDiv = popupEl.querySelector(".ai-translated-text");
    const titleEl = popupEl.querySelector(".ai-popup-title");
    const langSelector = popupEl.querySelector("#ai-lang-selector");
    
    if (langSelector) langSelector.style.display = "none";
    if (window.uiGlobals.historyPopup) window.uiGlobals.historyPopup.style.display = 'none';

    titleEl.textContent = "Bản Dịch";
    translatedDiv.style.whiteSpace = 'pre-wrap';
    translatedDiv.innerHTML = '<div class="ai-loading">Đợi bố mày tí...</div>';

    let targetLeft, targetTop;
    if (clickCoords) {
        targetLeft = clickCoords.clientX + 5;
        targetTop = clickCoords.clientY + 5;
    } else {
        try {
            const rect = window.contentState.selectionRange.getBoundingClientRect();
            targetLeft = rect.left;
            targetTop = rect.bottom + 8;
        } catch (error) { targetLeft = 100; targetTop = 100; }
    }

    popupEl.style.display = "block";
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popupWidth = 400;
    const popupMaxHeight = 240;
    const maxLeft = Math.max(vw - popupWidth - pad, pad);
    const maxTop = Math.max(vh - popupMaxHeight - pad, pad);
    targetLeft = Math.max(targetLeft, pad);
    targetTop = Math.max(targetTop, pad);
    targetLeft = Math.min(targetLeft, maxLeft);
    targetTop = Math.min(targetTop, maxTop);
    
    popupEl.style.left = targetLeft + "px";
    popupEl.style.top = targetTop + "px";

    try {
        const result = await chrome.runtime.sendMessage({
            action: "translate",
            text: window.contentState.selectedText,
            targetLangOverride: null
        });
        if (result.success) translatedDiv.textContent = result.translation;
        else {
            translatedDiv.style.whiteSpace = 'normal';
            translatedDiv.innerHTML = `<div class="ai-error">❌ ${result.error}</div>`;
        }
    } catch (error) {
        translatedDiv.style.whiteSpace = 'normal';
        translatedDiv.innerHTML = `<div class="ai-error">❌ Lỗi: ${error.message} (Thử F5 lại trang)</div>`;
    }
};

// Hàm định vị popup (Dùng cho loading/result message)
window.positionAndShowImagePopup = async function(popupEl) {
     let initialLeft, initialTop;
     try {
        const data = await chrome.storage.sync.get(["popupPos"]);
        const saved = data.popupPos;
        if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
            initialLeft = saved.left; initialTop = saved.top;
        } else {
            const popupWidth = 400; initialLeft = (window.innerWidth - popupWidth) / 2; initialTop = 20;
        }
    } catch (error) {
        const popupWidth = 400; initialLeft = (window.innerWidth - popupWidth) / 2; initialTop = 20;
    }
    popupEl.style.display = "block";
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popupWidth = 400;
    const popupMaxHeight = 240;
    const maxLeft = Math.max(vw - popupWidth - pad, pad);
    const maxTop = Math.max(vh - popupMaxHeight - pad, pad);
    let clampedLeft = Math.max(initialLeft, pad);
    let clampedTop = Math.max(initialTop, pad);
    clampedLeft = Math.min(clampedLeft, maxLeft);
    clampedTop = Math.min(clampedTop, maxTop);
    popupEl.style.left = clampedLeft + "px";
    popupEl.style.top = clampedTop + "px";
};

// Listener nhận message từ Background
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    // 1. Phím tắt dịch text
    if (request.action === "translate-shortcut") {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (text.length > 0) {
            window.contentState.selectedText = text;
            window.contentState.selectionRange = selection.getRangeAt(0).cloneRange();
            await window.translateSelectedText();
        }
        return; 
    }
    
    // 2. Loading Popup (Chỉ dùng khi không có Wibu Mode, hoặc fallback)
    if (request.action === "show_loading_popup" || request.action === "update_loading_popup") {
        const popupEl = window.createPopup();
        const titleEl = popupEl.querySelector(".ai-popup-title");
        const translatedDiv = popupEl.querySelector(".ai-translated-text");
        const langSelector = popupEl.querySelector("#ai-lang-selector");
        
        if (langSelector) langSelector.style.display = "none";
        if (window.uiGlobals.historyPopup) window.uiGlobals.historyPopup.style.display = 'none';
        if (titleEl) titleEl.textContent = request.title;
        translatedDiv.style.whiteSpace = 'pre-wrap';
        translatedDiv.innerHTML = '<div class="ai-loading">Đợi bố mày tí...</div>';
        
        if (typeof popupEl.resetAudio === 'function') popupEl.resetAudio();
        if (popupEl.style.display !== 'block') await window.positionAndShowImagePopup(popupEl);
        return; 
    }
    
    // 3. Kết quả dịch ảnh (Fallback nếu không dùng overlay)
    if (request.action === "show_translation_result") {
        const popupEl = window.createPopup();
        const titleEl = popupEl.querySelector(".ai-popup-title");
        const translatedDiv = popupEl.querySelector(".ai-translated-text");
        
        if (titleEl) titleEl.textContent = "Kết quả Phân tích Ảnh";
        if (request.success) {
            translatedDiv.style.whiteSpace = 'pre-wrap';
            translatedDiv.textContent = request.translation;
        } else {
            translatedDiv.style.whiteSpace = 'normal';
            translatedDiv.innerHTML = `<div class="ai-error">❌ ${request.error}</div>`;
        }
        if (popupEl.style.display !== 'block') await window.positionAndShowImagePopup(popupEl);
        return; 
    }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.userTheme && window.applyThemeToElements) {
        window.applyThemeToElements();
    }
});
