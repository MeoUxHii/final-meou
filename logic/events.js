// [FIXED] logic/events.js

// Đảm bảo nút dịch được khởi tạo
if (typeof window.createTranslateButton === 'function') {
    window.createTranslateButton();
}

// --- HÀM PHÒNG THỦ: Tự tạo contentState nếu thiếu ---
function ensureContentState() {
    if (!window.contentState) {
        window.contentState = {
            selectedText: "",
            selectionRange: null,
            isWibuMode: false,
            isSelecting: false,
            startX: 0,
            startY: 0,
            selectionBox: null
        };
    }
}

// --- HÀM PHÒNG THỦ: Tự tạo Selection Box nếu thiếu ---
function getOrCreateSelectionBox() {
    ensureContentState();
    
    // Kiểm tra xem box còn tồn tại trong DOM không
    if (window.contentState.selectionBox && document.contains(window.contentState.selectionBox)) {
        return window.contentState.selectionBox;
    }
    
    // Thử tìm trong DOM trước (tránh tạo trùng)
    let box = document.getElementById('wibu-selection-box');
    if (!box) {
        box = document.createElement("div");
        box.id = "wibu-selection-box";
        // CSS Inline quan trọng
        box.style.position = "fixed";
        box.style.border = "2px dashed #ff0055";
        box.style.background = "rgba(255, 0, 85, 0.1)";
        box.style.zIndex = "2147483647"; // Max z-index an toàn
        box.style.display = "none";
        box.style.pointerEvents = "none"; // Để click xuyên qua, không chặn sự kiện mouseup
        box.style.top = "0";
        box.style.left = "0";
        // Append vào html thay vì body để tránh bị ảnh hưởng bởi style của body
        (document.documentElement || document.body).appendChild(box);
    }
    
    window.contentState.selectionBox = box;
    return box;
}

// --- MOUSE UP: Kết thúc bôi đen & Xử lý (CAPTURE MODE) ---
document.addEventListener("mouseup", (e) => {
    ensureContentState();

    // 1. Logic Wibu Mode
    if (window.contentState.isWibuMode && window.contentState.isSelecting) {
        window.contentState.isSelecting = false;
        
        // Ngăn chặn sự kiện lan truyền để web không xử lý click này
        e.stopPropagation();
        e.preventDefault(); 
        
        const box = getOrCreateSelectionBox();
        const rect = box.getBoundingClientRect();
        
        // Nếu vùng chọn đủ lớn (>10px) thì mới xử lý
        if (rect.width > 10 && rect.height > 10) {
             // Gọi hàm xử lý ảnh
             if (typeof window.processSelection === 'function') {
                 window.processSelection(rect.left, rect.top, rect.width, rect.height);
             } else {
                 console.error("Lỗi: Hàm window.processSelection chưa được load!");
                 box.style.display = 'none';
             }
        } else {
            // Click nhầm -> ẩn box
            box.style.display = 'none';
        }
        return;
    }

    // 2. Logic hiển thị nút Dịch (Text)
    const path = e.composedPath();
    const { translateButton, popup, historyPopup } = window.uiGlobals || {};
    
    // [FIX] Chỉ cần check translateButton thôi, popup có thể chưa có
    if (!translateButton) return;

    // [FIX] Check an toàn hơn: Nếu popup chưa có thì bỏ qua check popup
    const isClickOnUI = path.some(el => 
        el === translateButton || 
        (popup && el === popup) || 
        (historyPopup && el === historyPopup) || 
        el.id === "ai-translate-popup" || 
        el.id === "ai-history-popup"
    );

    if (isClickOnUI) return;
    
    if ((popup && popup.classList.contains("ai-dragging")) || (historyPopup && historyPopup.classList.contains("ai-dragging"))) return;
    
    const text = window.getSelection().toString().trim();
    if (text.length > 0) {
        window.contentState.selectedText = text;
        try {
            window.contentState.selectionRange = window.getSelection().getRangeAt(0).cloneRange();
        } catch(err) {
            // Fallback nếu không lấy được range (vd trong input)
            window.contentState.selectionRange = null;
        }
        
        if (typeof window.showTranslateButton === 'function') {
            window.showTranslateButton(e.pageX, e.pageY);
        }
    } else {
        if (typeof window.hideTranslateButton === 'function') {
            window.hideTranslateButton();
        }
    }
}, { capture: true }); // QUAN TRỌNG: capture: true để bắt sự kiện trước website

// --- MOUSE DOWN: Bắt đầu bôi đen (CAPTURE MODE) ---
document.addEventListener("mousedown", (e) => {
    ensureContentState();
    const path = e.composedPath(); 

    // 1. Wibu Mode Start
    if (window.contentState.isWibuMode) {
        if (path.some(el => el.classList && el.classList.contains('manga-overlay-box'))) return;
        
        // Ngăn chặn hành vi kéo/bôi đen mặc định của trình duyệt/website
        e.stopPropagation();
        e.preventDefault();
        
        window.contentState.isSelecting = true;
        window.contentState.startX = e.clientX;
        window.contentState.startY = e.clientY;
        
        const box = getOrCreateSelectionBox();
        box.style.left = window.contentState.startX + "px";
        box.style.top = window.contentState.startY + "px";
        box.style.width = "0px";
        box.style.height = "0px";
        box.style.display = "block";
        return;
    }

    // 2. Click ra ngoài để đóng Popup (Logic thường)
    if (!window.uiGlobals || !window.uiGlobals.shadowRoot) return;
    const shadowRoot = window.uiGlobals.shadowRoot;
    const isClickInside = path.some(el => el === shadowRoot?.host);
    if (isClickInside) return;

    const { popup, historyPopup, translateButton } = window.uiGlobals;

    if (popup && popup.style.display === "block") {
        if (typeof popup.resetAudio === 'function') popup.resetAudio();
        popup.style.display = "none";
        const langSelector = popup.querySelector("#ai-lang-selector");
        if (langSelector) langSelector.style.display = "none";
    }
    
    if (historyPopup && historyPopup.style.display === "block") {
        historyPopup.style.display = "none";
    }

    if (translateButton && !translateButton.contains(e.target)) {
        // [FIX] Tăng delay một chút để tránh xung đột với sự kiện click nút
        setTimeout(() => {
            const selection = window.getSelection();
            // Chỉ ẩn nếu không còn bôi đen
            if (!selection || selection.toString().trim().length === 0) {
                if (typeof window.hideTranslateButton === 'function') {
                    window.hideTranslateButton();
                }
            }
        }, 150); 
    }
}, { capture: true }); // QUAN TRỌNG: capture: true

// --- MOUSE MOVE: Vẽ khung đỏ (CAPTURE MODE) ---
document.addEventListener("mousemove", (e) => {
    ensureContentState();
    
    // Chỉ chạy khi đang ở Wibu Mode VÀ đang giữ chuột
    if (!window.contentState.isWibuMode || !window.contentState.isSelecting) return;
    
    e.preventDefault();
    e.stopPropagation();

    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const width = Math.abs(currentX - window.contentState.startX);
    const height = Math.abs(currentY - window.contentState.startY);
    const left = Math.min(currentX, window.contentState.startX);
    const top = Math.min(currentY, window.contentState.startY);

    const box = getOrCreateSelectionBox();
    if (box) {
        box.style.width = width + "px";
        box.style.height = height + "px";
        box.style.left = left + "px";
        box.style.top = top + "px";
    }
}, { capture: true }); // QUAN TRỌNG: capture: true

// --- KEYDOWN: Phím tắt ---
document.addEventListener("keydown", async (e) => {
    ensureContentState();
    const historyPopup = window.uiGlobals ? window.uiGlobals.historyPopup : null;

    if (e.key === "T" && e.altKey && e.shiftKey) {
        e.preventDefault();
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (text.length > 0) {
            window.contentState.selectedText = text;
            try {
                window.contentState.selectionRange = selection.getRangeAt(0).cloneRange();
            } catch(e) {}
            
            if (typeof window.translateSelectedText === 'function') {
                await window.translateSelectedText();
            }
        }
    }
    
    if (e.ctrlKey && (e.key === "q" || e.key === "Q")) {
        e.preventDefault();
        if (typeof window.toggleWibuMode === 'function') {
            window.toggleWibuMode();
        }
    }
    
    if (e.key === "Escape" && historyPopup && historyPopup.style.display === "block") {
        historyPopup.style.display = "none";
    }
});