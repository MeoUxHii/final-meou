window.createHistoryPopup = function() {
    if (window.uiGlobals.historyPopup) return window.uiGlobals.historyPopup;

    const icons = window.getIcons(false);
    const historyPopup = document.createElement("div");
    historyPopup.id = "ai-history-popup";
    historyPopup.innerHTML = `
        <div class="ai-popup-content">
            <div class="ai-popup-header">
                <div class="ai-popup-title">Lịch Sử Dịch</div>
                <div class="ai-header-buttons">
                    <button class="ai-popup-back-to-translate" title="Quay lại">${icons.back}</button> 
                </div>
                <button class="ai-popup-close-history" title="Đóng" style="margin-left: 8px;">${icons.close}</button>
            </div>
            <div id="ai-history-body" class="ai-popup-body">
                <div id="ai-history-list"></div>
                <div id="ai-no-history" style="display: none;">Chưa có lịch sử</div>
            </div>
        </div>
    `;
    window.getShadowRoot().appendChild(historyPopup);
    window.uiGlobals.historyPopup = historyPopup;
    
    window.applyThemeToElements();

    historyPopup.querySelector('.ai-popup-close-history').addEventListener('click', () => {
        historyPopup.style.display = 'none';
    });

    historyPopup.querySelector('.ai-popup-back-to-translate').addEventListener('click', () => {
        historyPopup.style.display = 'none';
        if (window.uiGlobals.popup) {
            window.uiGlobals.popup.style.display = 'block';
        }
    });

    // --- DRAG LOGIC FOR HISTORY ---
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    const header = historyPopup.querySelector(".ai-popup-header");

    function clampPosition(x, y, popupEl) {
        const pad = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = popupEl.getBoundingClientRect();
        const maxX = vw - rect.width - pad;
        const maxY = vh - rect.height - pad;
        return { 
            x: Math.min(Math.max(x, pad), Math.max(maxX, pad)),
            y: Math.min(Math.max(y, pad), Math.max(maxY, pad))
        };
    }

    function startDrag(clientX, clientY) {
        const rect = historyPopup.getBoundingClientRect();
        isDragging = true;
        historyPopup.classList.add("ai-dragging");
        dragOffsetX = clientX - rect.left;
        dragOffsetY = clientY - rect.top;
    }

    function onMove(clientX, clientY) {
        if (!isDragging) return;
        const pos = clampPosition(clientX - dragOffsetX, clientY - dragOffsetY, historyPopup);
        historyPopup.style.left = pos.x + "px";
        historyPopup.style.top = pos.y + "px";
    }

    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        historyPopup.classList.remove("ai-dragging");
    }

    header.addEventListener("mousedown", (e) => {
        if (e.button === 0 && !e.target.closest('button')) {
            e.preventDefault(); startDrag(e.clientX, e.clientY);
        }
    });
    document.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
    document.addEventListener("mouseup", endDrag);

    return historyPopup;
};

window.showHistoryPopup = function() {
    const hPopup = window.createHistoryPopup();
    if (window.uiGlobals.popup) {
        window.uiGlobals.popup.style.display = 'none';
        const langSelector = window.uiGlobals.popup.querySelector("#ai-lang-selector");
        if (langSelector) langSelector.style.display = "none";
    }
    
    if (window.uiGlobals.popup && window.uiGlobals.popup.style.left) {
        hPopup.style.left = window.uiGlobals.popup.style.left;
        hPopup.style.top = window.uiGlobals.popup.style.top;
    } else {
        hPopup.style.left = '100px';
        hPopup.style.top = '100px';
    }
    
    hPopup.style.display = 'block';
    window.loadHistoryInPage();
};

window.loadHistoryInPage = function() {
    const historyPopup = window.uiGlobals.historyPopup;
    if (!historyPopup) return;

    const historyList = historyPopup.querySelector('#ai-history-list');
    const noHistory = historyPopup.querySelector('#ai-no-history');
    historyList.innerHTML = '';
    noHistory.style.display = 'none';

    chrome.runtime.sendMessage({ action: "getHistory" }, (response) => {
        if (response && response.history && response.history.length > 0) {
            response.history.forEach(item => {
                const el = document.createElement('div');
                el.className = 'ai-history-item'; 
                const safeOriginal = window.escapeHTML ? window.escapeHTML(item.original) : item.original;
                const safeTranslation = window.escapeHTML ? window.escapeHTML(item.translation) : item.translation;
                el.innerHTML = `<div class="history-text-original">${safeOriginal}</div><div class="history-text-translation">${safeTranslation}</div>`;
                historyList.appendChild(el);
            });
        } else { 
            noHistory.style.display = 'block'; 
        }
    });
};