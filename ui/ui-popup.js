window.createPopup = function() {
    if (window.uiGlobals.popup) return window.uiGlobals.popup;

    const icons = window.getIcons(false); // Default Icons
    const popup = document.createElement("div");
    popup.id = "ai-translate-popup";
    popup.innerHTML = `
        <div class="ai-popup-content">
            <div class="ai-popup-header">
                <div class="ai-popup-title">🧐 Bản Dịch</div>
                <div class="ai-header-buttons">
                    <button class="ai-popup-show-history" title="Lịch sử">${icons.history}</button>
                    <button class="ai-popup-retranslate" title="Dịch lại">${icons.retranslate}</button>
                    <button class="ai-popup-copy" title="Copy bản dịch">${icons.copy}</button>
                    <button class="ai-popup-speak" title="Đọc văn bản">${icons.speak}</button>
                </div>
                <button class="ai-popup-close" title="Đóng">${icons.close}</button>
            </div>
            <div class="ai-popup-body">
                <div class="ai-translated">
                    <div class="ai-text ai-translated-text"></div>
                </div>
            </div>
            <div id="ai-lang-selector"></div>
        </div>
    `;
    window.getShadowRoot().appendChild(popup);
    window.uiGlobals.popup = popup;
    
    window.applyThemeToElements();

    // --- DRAG LOGIC ---
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    const header = popup.querySelector(".ai-popup-header");

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
        const rect = popup.getBoundingClientRect();
        isDragging = true;
        popup.classList.add("ai-dragging");
        dragOffsetX = clientX - rect.left;
        dragOffsetY = clientY - rect.top;
    }

    function onMove(clientX, clientY) {
        if (!isDragging) return;
        const pos = clampPosition(clientX - dragOffsetX, clientY - dragOffsetY, popup);
        popup.style.left = pos.x + "px";
        popup.style.top = pos.y + "px";
    }

    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        popup.classList.remove("ai-dragging");
        chrome.storage.sync.set({ 
            popupPos: { 
                left: parseFloat(popup.style.left) || 0, 
                top: parseFloat(popup.style.top) || 0 
            } 
        });
    }

    header.addEventListener("mousedown", (e) => {
        if (e.button === 0 && !e.target.closest('button')) {
            e.preventDefault(); startDrag(e.clientX, e.clientY);
        }
    });
    document.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
    document.addEventListener("mouseup", endDrag);

    // --- AUDIO LOGIC ---
    let currentAudio = null;
    let currentAudioText = "";
    
    popup.resetAudio = function() {
        const icons = window.getIcons(window.uiGlobals.currentThemeIsDark);
        const speakBtn = popup.querySelector(".ai-popup-speak");
        
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        currentAudioText = "";
        if (speakBtn) {
            speakBtn.innerHTML = icons.speak;
            speakBtn.classList.remove("loading");
        }
    };

    const speakBtn = popup.querySelector(".ai-popup-speak");
    speakBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const icons = window.getIcons(window.uiGlobals.currentThemeIsDark);
        const translatedDiv = popup.querySelector(".ai-translated-text");
        const textContent = translatedDiv.textContent;
        const isWaitingMode = translatedDiv.querySelector(".ai-loading") || textContent.includes("Đang dịch") || textContent.includes("Đợi");

        chrome.storage.sync.get(["audioVolume"], (data) => {
            const volume = data.audioVolume !== undefined ? data.audioVolume / 100 : 1.0;

            // Nhạc chờ khi đang dịch
            if (isWaitingMode) {
                if (currentAudio && currentAudioText === "WAITING_MUSIC") {
                    if (currentAudio.paused) {
                        currentAudio.volume = volume;
                        currentAudio.play();
                        speakBtn.innerHTML = icons.speak;
                    } else {
                        currentAudio.pause();
                        speakBtn.innerHTML = icons.stop;
                    }
                    return; 
                }
                
                popup.resetAudio();
                const randomTrackPath = window.getRandomWaitingMusic ? window.getRandomWaitingMusic() : null;
                if (randomTrackPath) {
                    currentAudio = new Audio(chrome.runtime.getURL(randomTrackPath));
                    currentAudioText = "WAITING_MUSIC"; 
                    currentAudio.volume = volume;
                    speakBtn.innerHTML = icons.loading;
                    speakBtn.classList.add("loading");

                    currentAudio.play().then(() => { 
                        speakBtn.innerHTML = icons.speak;
                        speakBtn.classList.remove("loading");
                    });
                    currentAudio.onended = () => { 
                        currentAudio = null; currentAudioText = ""; speakBtn.innerHTML = icons.speak; 
                    };
                }
                return;
            }

            // Đọc văn bản
            if (speakBtn.classList.contains("loading")) return;
            if (!textContent) return;

            if (currentAudio && currentAudioText === textContent) {
                if (currentAudio.paused) {
                    currentAudio.volume = volume;
                    currentAudio.play();
                    speakBtn.innerHTML = icons.speak; 
                } else {
                    currentAudio.pause();
                    speakBtn.innerHTML = icons.stop; 
                }
                return; 
            }

            popup.resetAudio();
            speakBtn.innerHTML = icons.loading;
            speakBtn.classList.add("loading");

            chrome.runtime.sendMessage({ action: "speak", text: textContent }, (response) => {
                if (popup.style.display === "none") { popup.resetAudio(); return; }
                
                if (response && response.success && response.audioBase64) {
                    const audioBlob = new Blob([new Uint8Array(atob(response.audioBase64).split("").map(c => c.charCodeAt(0)))], { type: "audio/mp3" });
                    currentAudio = new Audio(URL.createObjectURL(audioBlob));
                    currentAudioText = textContent; 
                    currentAudio.volume = volume;
                    
                    currentAudio.play();
                    speakBtn.innerHTML = icons.speak; 
                    speakBtn.classList.remove("loading");
                    currentAudio.onended = () => { 
                        currentAudio = null; currentAudioText = ""; speakBtn.innerHTML = icons.speak; 
                    };
                } else { 
                    speakBtn.innerHTML = icons.speak; speakBtn.classList.remove("loading"); 
                }
            });
        });
    });

    // --- OTHER BUTTONS ---
    const langSelector = popup.querySelector("#ai-lang-selector");
    popup.querySelector(".ai-popup-close").addEventListener("click", () => {
        popup.resetAudio();
        popup.style.display = "none";
        langSelector.style.display = "none";
    });

    popup.querySelector(".ai-popup-copy").addEventListener("click", (e) => {
        e.stopPropagation();
        const icons = window.getIcons(window.uiGlobals.currentThemeIsDark);
        const text = popup.querySelector(".ai-translated-text").textContent;
        
        // FIX LỖI NULL: Lưu reference nút ngay lúc click
        const btn = e.target.closest('button'); 

        if (text && btn) {
            navigator.clipboard.writeText(text).then(() => {
                // Sử dụng btn đã lưu thay vì e.target (vì DOM có thể đã đổi)
                btn.innerHTML = icons.check;
                setTimeout(() => { btn.innerHTML = icons.copy; }, 2000);
            }).catch(err => {
                console.error("Copy failed:", err);
            });
        }
    });

    const retranslateBtn = popup.querySelector(".ai-popup-retranslate");
    if (window.supportedLangs) {
        window.supportedLangs.forEach(lang => {
            const langBtn = document.createElement("button");
            langBtn.className = "ai-lang-btn";
            langBtn.textContent = lang.name;
            langBtn.dataset.langCode = lang.code;
            langSelector.appendChild(langBtn);
        });
    }

    retranslateBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        langSelector.style.display = langSelector.style.display === "block" ? "none" : "block";
    });

    langSelector.addEventListener("click", (e) => {
        const btn = e.target.closest(".ai-lang-btn");
        if (btn) {
            const langCode = btn.dataset.langCode;
            
            // FIX LỖI RETRANSLATE: Lấy text từ contentState thay vì biến global cũ
            const textToTranslate = window.contentState ? window.contentState.selectedText : "";
            const translatedDiv = popup.querySelector(".ai-translated-text");

            if (!textToTranslate || !langCode) return;

            langSelector.style.display = "none";
            popup.resetAudio();
            translatedDiv.innerHTML = '<div class="ai-loading">Đợi bố mày tí...</div>';

            chrome.runtime.sendMessage(
                { action: "translate", text: textToTranslate, targetLangOverride: langCode }, 
                (response) => {
                    if (response.success) {
                        translatedDiv.textContent = response.translation;
                    } else {
                        translatedDiv.style.whiteSpace = 'normal';
                        translatedDiv.innerHTML = `<div class="ai-error">❌ ${response.error}</div>`;
                    }
                }
            );
        }
    });

    popup.querySelector(".ai-popup-show-history").addEventListener("click", (e) => {
        e.stopPropagation();
        popup.resetAudio();
        window.showHistoryPopup();
    });

    return popup;
};