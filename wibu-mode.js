// Đảm bảo contentState tồn tại
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

function showToast(message) {
    // Kiểm tra shadowRoot trước khi dùng
    const root = window.getShadowRoot ? window.getShadowRoot() : document.body;
    const toast = document.createElement("div");
    toast.className = "wibu-toast";
    toast.textContent = message;
    
    // Nếu chưa có CSS cho toast trong shadowRoot thì inject style inline tạm
    if (!window.getShadowRoot) {
        toast.style.cssText = "position:fixed;top:20px;left:50%;transform:translate(-50%);background:rgba(0,0,0,0.8);color:white;padding:10px 20px;border-radius:20px;z-index:1000000;font-family:sans-serif;pointer-events:none;";
    }
    
    root.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

// --- HÀM TOGGLE CHÍNH ---
window.toggleWibuMode = function() {
    // FIX: Sử dụng window.contentState thay vì biến cục bộ
    window.contentState.isWibuMode = !window.contentState.isWibuMode;
    
    if (window.contentState.isWibuMode) {
        document.body.classList.add("wibu-mode-active");
        showToast("✨ Wibu Mode: ON");
    } else {
        document.body.classList.remove("wibu-mode-active");
        showToast("🐶 Wibu Mode: OFF");
        // Ẩn khung đỏ nếu đang hiện
        if (window.contentState.selectionBox) {
            window.contentState.selectionBox.style.display = 'none';
        }
    }
};

function fitText(container, text) {
    container.innerHTML = text;
    let fontSize = 100; 
    container.style.fontSize = fontSize + "px";
    while ((container.scrollHeight > container.clientHeight || container.scrollWidth > container.clientWidth) && fontSize > 10) {
        fontSize -= 2; 
        container.style.fontSize = fontSize + "px";
    }
}

function createMangaOverlay(x, y, width, height, theme = 'light') {
    const box = document.createElement("div");
    box.className = "manga-overlay-box";
    box.classList.add(theme === 'dark' ? 'glass-dark' : 'glass-light');
    box.style.left = (x + window.scrollX) + "px";
    box.style.top = (y + window.scrollY) + "px";
    box.style.width = width + "px";
    box.style.height = height + "px";

    const closeBtn = document.createElement("div");
    closeBtn.className = "manga-close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = (e) => { e.stopPropagation(); box.remove(); };
    box.appendChild(closeBtn);

    const content = document.createElement("div");
    content.className = "manga-text-content";
    content.innerHTML = '<div class="manga-loading">Đang dịch...</div>';
    
    box.appendChild(content);
    
    const root = window.getShadowRoot ? window.getShadowRoot() : document.body;
    root.appendChild(box);
    
    return { box, content };
}

function analyzeBrightnessSimple(canvas) {
    // Logic đơn giản để chọn màu chữ (có thể mở rộng sau)
    return 'light';
}

// --- HÀM XỬ LÝ CHÍNH ---
// Hàm này được gọi từ logic/events.js khi nhả chuột
window.processSelection = async function(x, y, w, h) {
    // Ẩn khung selection đỏ đi
    if (window.contentState.selectionBox) {
        window.contentState.selectionBox.style.display = 'none';
    }

    try {
        chrome.runtime.sendMessage({ action: "capture_visible_tab" }, (response) => {
            if (chrome.runtime.lastError || !response || response.error) {
                showToast("Lỗi chụp: " + (chrome.runtime.lastError?.message || "Unknown"));
                return;
            }
            
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                
                // Xử lý tỉ lệ màn hình (Retina displays)
                const ratio = window.devicePixelRatio || 1;
                canvas.width = w * ratio;
                canvas.height = h * ratio;
                
                // Cắt ảnh từ screenshot gốc
                ctx.drawImage(img, x * ratio, y * ratio, w * ratio, h * ratio, 0, 0, w * ratio, h * ratio);
                
                const brightnessTheme = analyzeBrightnessSimple(canvas);
                
                // Tạo khung hiển thị kết quả đè lên vị trí cũ
                const { content } = createMangaOverlay(x, y, w, h, brightnessTheme);

                const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
                
                // Gửi ảnh đi dịch
                chrome.runtime.sendMessage({ action: "translate_image_data", imageData: croppedDataUrl }, (transResponse) => {
                    if (transResponse && transResponse.success) { 
                        fitText(content, transResponse.translation); 
                    } else { 
                        content.innerHTML = `<span style="color:red;font-size:12px">Lỗi: ${transResponse?.error || "Unknown"}</span>`; 
                    }
                });
            };
            img.src = response.dataUrl;
        });
    } catch (e) { console.error(e); }
};

// Inject CSS con trỏ chuột cho toàn trang
(function injectGlobalCursorStyle() {
    const style = document.createElement('style');
    style.textContent = `
        body.wibu-mode-active, body.wibu-mode-active * { cursor: crosshair !important; user-select: none !important; }
    `;
    if (document.head) document.head.appendChild(style);
    else document.addEventListener('DOMContentLoaded', () => { document.head.appendChild(style); });
})();