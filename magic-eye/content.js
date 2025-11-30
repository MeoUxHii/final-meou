// content.js - Magic Eye Integration
(() => {
    let overlay = null;
    let freezeImage = null;
    let gradientLayer = null;

    // Lắng nghe lệnh từ Background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "SHOW_TOAST") {
            showToast(request.text);
        }
        if (request.action === "FREEZE_SCREEN") {
            startSelectionProcess(request.imageUrl);
        }
    });

    function showToast(text) {
        const toast = document.createElement("div");
        toast.innerText = text;
        toast.className = "mai-toast-message"; 
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    function cleanup() {
        if (overlay) { overlay.remove(); overlay = null; }
        if (freezeImage) { freezeImage.remove(); freezeImage = null; }
        if (gradientLayer) { gradientLayer.remove(); gradientLayer = null; }
        
        document.removeEventListener("keydown", handleEscPress);
    }

    function handleEscPress(e) {
        if (e.key === "Escape") {
            cleanup();
        }
    }

    function startSelectionProcess(dataUrl) {
        if (freezeImage) freezeImage.remove();
        freezeImage = document.createElement("img");
        freezeImage.src = dataUrl;
        freezeImage.id = "mai-freeze-img"; 
        document.body.appendChild(freezeImage);

        if (gradientLayer) gradientLayer.remove();
        gradientLayer = document.createElement("div");
        gradientLayer.id = "mai-gradient-layer"; 
        document.body.appendChild(gradientLayer);

        setTimeout(() => {
            if (gradientLayer) gradientLayer.remove();
        }, 1000);

        if (overlay) overlay.remove();
        overlay = document.createElement("div");
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", width: "100%", height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.3)", 
            zIndex: "2147483647", 
            cursor: "crosshair"
        });
        
        const selection = document.createElement("div");
        Object.assign(selection.style, {
            position: "absolute",
            border: "2px solid #fff",
            borderRadius: "30px 30px 0 30px",
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
            display: "none"
        });
        overlay.appendChild(selection);
        document.body.appendChild(overlay);

        document.addEventListener("keydown", handleEscPress);

        let startX, startY, isDragging = false;

        overlay.addEventListener("mousedown", (e) => {
            if (e.button === 2) { cleanup(); return; }
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            selection.style.left = startX + "px";
            selection.style.top = startY + "px";
            selection.style.width = "0px";
            selection.style.height = "0px";
            selection.style.display = "block";
        });

        overlay.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            const currentX = e.clientX;
            const currentY = e.clientY;
            
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);
            const left = Math.min(currentX, startX);
            const top = Math.min(currentY, startY);

            selection.style.width = width + "px";
            selection.style.height = height + "px";
            selection.style.left = left + "px";
            selection.style.top = top + "px";
        });

        overlay.addEventListener("mouseup", (e) => {
            if (!isDragging) return;
            isDragging = false;
            const rect = selection.getBoundingClientRect();
            cleanup(); 

            if (rect.width < 10 || rect.height < 10) return;

            chrome.runtime.sendMessage({
                action: "CROP_IMAGE",
                area: {
                    x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                    deviceScale: window.devicePixelRatio
                }
            });
        });
    }
})();