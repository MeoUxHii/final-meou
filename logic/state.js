// Quản lý trạng thái chung của Content Script
window.contentState = {
    selectedText: "",
    selectionRange: null,
    isWibuMode: false,
    isSelecting: false,
    startX: 0,
    startY: 0,
    selectionBox: null
};

// Hàm helper để tạo selection box cho Wibu Mode (nếu chưa có)
window.createSelectionBox = function() {
    if (window.contentState.selectionBox) return window.contentState.selectionBox;
    
    const box = document.createElement("div");
    box.id = "wibu-selection-box";
    box.style.position = "fixed";
    box.style.border = "2px dashed #ff0055";
    box.style.background = "rgba(255, 0, 85, 0.1)";
    box.style.zIndex = "2147483646";
    box.style.display = "none";
    box.style.pointerEvents = "none";
    document.body.appendChild(box);
    
    window.contentState.selectionBox = box;
    return box;
};

// Hàm toggle Wibu Mode
window.toggleWibuMode = function() {
    window.contentState.isWibuMode = !window.contentState.isWibuMode;
    const msg = window.contentState.isWibuMode ? "Wibu Mode: ON (Kéo chuột để dịch truyện)" : "Wibu Mode: OFF";
    
    // Tạo toast thông báo đơn giản
    const toast = document.createElement("div");
    toast.className = "wibu-toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    
    if (window.contentState.isWibuMode) {
        document.body.classList.add("wibu-mode-active");
    } else {
        document.body.classList.remove("wibu-mode-active");
        if (window.contentState.selectionBox) window.contentState.selectionBox.style.display = 'none';
    }
    
    setTimeout(() => toast.remove(), 2000);
};