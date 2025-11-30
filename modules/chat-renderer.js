// Module chuyên trách việc vẽ UI Chat (Bubble, Row, Timestamp)
import { escapeHTML } from './ui-utils.js';
import { createAudioBubble, parseMessageContent } from './media-handler.js';
import { getAvatarSrc, showAvatarModal, showMediaModal } from './avatar-manager.js';

let chatHistoryContainer = null;

// [MỚI] Biến lưu volume mặc định (Load từ local storage nếu có)
let globalVideoVolume = parseFloat(localStorage.getItem('meou_video_volume')) || 1.0;

export function initChatRenderer(container) {
    chatHistoryContainer = container;
}

export function scrollToBottom() {
    if (chatHistoryContainer) {
        requestAnimationFrame(() => {
            chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
        });
    }
}

function renderSelectedReaction(emoji) {
    const reactDiv = document.createElement("div");
    reactDiv.className = "selected-reaction";
    reactDiv.textContent = emoji;
    return reactDiv;
}

function createReplyLabel(originalText, isUserReply = true) {
    const div = document.createElement("div");
    div.className = "chat-reply-label";
    
    const words = originalText.trim().split(/\s+/);
    const truncated = words.length > 6 ? words.slice(0, 6).join(" ") + "..." : originalText;
    const replyLabelText = isUserReply ? "Bạn đã trả lời:" : "Đã trả lời:";

    div.innerHTML = `
        <div class="reply-meta">
            <svg class="chat-reply-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 15v-3a4 4 0 0 0-4-4H9"/><path d="m13 4-4 4 4 4"/></svg>
            <span>${replyLabelText}</span>
        </div>
        <span class="reply-text-quote">${escapeHTML(truncated)}</span>
    `;
    return div;
}

function createMsgActions(onSelect, onReply) {
    const container = document.createElement("div");
    container.className = "msg-actions";

    const reactionBar = document.createElement("div");
    reactionBar.className = "reaction-bar";
    
    const emojis = ["👍", "😘", "😆", "😭", "😡"];
    emojis.forEach((emoji, index) => {
        const btn = document.createElement("button");
        btn.className = "reaction-btn";
        btn.textContent = emoji;
        const dist = Math.abs(index - 2); 
        btn.style.setProperty('--delay', `${dist * 0.06}s`);
        
        btn.onclick = (e) => {
            e.stopPropagation();
            const msgBubble = container.closest('.chat-msg');
            if (msgBubble) {
                const oldReact = msgBubble.querySelector(".selected-reaction");
                if (oldReact) oldReact.remove();
                msgBubble.appendChild(renderSelectedReaction(emoji));
                if (typeof onSelect === 'function') onSelect(emoji);
            }
            reactionBar.classList.remove("show");
        };
        reactionBar.appendChild(btn);
    });

    const btnSmile = document.createElement("button");
    btnSmile.className = "msg-action-btn";
    btnSmile.title = "Thả cảm xúc";
    btnSmile.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-smile-icon lucide-smile"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>`;
    
    btnSmile.onclick = (e) => {
        e.stopPropagation();
        document.querySelectorAll('.reaction-bar.show').forEach(el => {
            if(el !== reactionBar) el.classList.remove('show');
        });
        reactionBar.classList.toggle("show");
    };

    const btnReply = document.createElement("button");
    btnReply.className = "msg-action-btn";
    btnReply.title = "Trả lời";
    btnReply.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-reply-icon lucide-reply"><path d="M20 18v-2a4 4 0 0 0-4-4H4"/><path d="m9 17-5-5 5-5"/></svg>`;
    btnReply.onclick = (e) => {
        e.stopPropagation();
        if (typeof onReply === 'function') onReply();
    };

    container.appendChild(reactionBar);
    container.appendChild(btnSmile);
    container.appendChild(btnReply);

    return container;
}

function wrapSensitiveMedia(mediaElement, currentTone) {
    if (currentTone !== 'be_dam_dang') return mediaElement;

    const wrapper = document.createElement('div');
    wrapper.className = 'sensitive-media-wrapper';
    wrapper.style.position = "relative";
    wrapper.style.display = "inline-block"; 
    wrapper.style.overflow = "hidden"; 
    wrapper.style.borderRadius = "12px";
    wrapper.style.maxWidth = "100%"; 
    wrapper.style.height = "auto";
    
    const blurOverlay = document.createElement('div');
    blurOverlay.className = 'sensitive-blur-overlay';
    
    blurOverlay.style.position = "absolute";
    blurOverlay.style.top = "0";
    blurOverlay.style.left = "0";
    blurOverlay.style.width = "100%";
    blurOverlay.style.height = "100%";
    blurOverlay.style.zIndex = "10"; 
    
    blurOverlay.innerHTML = `
        <div class="sensitive-icon-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Ấn để xem</span>
        </div>
    `;

    wrapper.onclick = (e) => {
        if (!wrapper.classList.contains('revealed')) {
            e.stopPropagation(); 
            wrapper.classList.add('revealed');
            // Tìm video bên trong container (nếu có lồng nhau)
            const video = wrapper.querySelector('video');
            if (video) {
                // [UPDATE] Set volume đã nhớ trước khi play
                video.volume = globalVideoVolume;
                if (globalVideoVolume === 0) video.muted = true;
                
                video.play().catch(e => console.log("Auto-play blocked:", e)); 
            }
        }
    };

    wrapper.appendChild(blurOverlay);
    wrapper.appendChild(mediaElement);
    return wrapper;
}

function createChatRowWithWrapper(roleClass, currentTone) {
    const row = document.createElement("div");
    row.className = `chat-row ${roleClass}`;

    if (roleClass === 'bot') {
        const wrapper = document.createElement("div");
        wrapper.className = "chat-avatar-wrapper";
        wrapper.innerHTML = `
            <svg class="avatar-ring" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="url(#avatarGradient)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <defs><linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00C6FF" /><stop offset="100%" stop-color="#0072FF" /></linearGradient></defs>
                <circle cx="12" cy="12" r="10"/>
            </svg>
        `;
        const avatar = document.createElement("img");
        avatar.className = "chat-avatar";
        avatar.src = getAvatarSrc(currentTone);
        avatar.dataset.tone = currentTone;
        avatar.onclick = (e) => { e.stopPropagation(); showAvatarModal(avatar.src, currentTone); };
        wrapper.appendChild(avatar);
        row.appendChild(wrapper);
    }

    const contentWrapper = document.createElement("div");
    contentWrapper.className = "chat-content-wrapper";
    row.appendChild(contentWrapper);

    return { row, contentWrapper };
}

function appendTimestamp(element, timestamp) {
    if (!timestamp || !element) return;
    const timeSpan = document.createElement("div");
    timeSpan.className = "msg-time";
    timeSpan.textContent = timestamp;
    element.appendChild(timeSpan);
}

// --- HÀM TẠO VIDEO CONTAINER VỚI CUSTOM CONTROLS ---
function createVideoElementWithControls(src) {
    const videoContainer = document.createElement("div");
    videoContainer.className = "chat-video-container"; 
    videoContainer.style.position = "relative";
    videoContainer.style.display = "inline-block";
    videoContainer.style.overflow = "hidden"; 

    const video = document.createElement("video");
    video.className = "chat-video-content";
    video.src = src;
    video.controls = false; 
    video.playsInline = true;
    video.preload = "metadata";
    video.style.width = "auto"; 
    video.style.height = "auto";
    video.style.maxWidth = "240px"; 
    video.style.maxHeight = "320px"; 
    video.style.borderRadius = "12px";
    video.style.marginTop = "4px";
    video.style.backgroundColor = "#000"; 
    video.style.objectFit = "contain"; 
    video.style.display = "block"; 
    
    // [UPDATE] Set volume khởi tạo từ biến toàn cục
    video.volume = globalVideoVolume;
    if(globalVideoVolume === 0) video.muted = true;

    // Nút Expand
    const expandBtn = document.createElement('div');
    expandBtn.className = 'video-expand-btn';
    expandBtn.title = "Phóng to video";
    expandBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>`;
    expandBtn.onclick = (e) => {
        e.stopPropagation(); e.preventDefault();
        showMediaModal(src, 'video');
    };

    // --- CUSTOM CONTROLS ---
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'custom-video-controls';

    // 1. Play/Pause Button (Left)
    const playBtn = document.createElement('button');
    playBtn.className = 'video-ctrl-btn play-btn';
    playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`; // Play

    const togglePlay = (e) => {
        e && e.stopPropagation();
        video.paused ? video.play() : video.pause();
    };
    playBtn.onclick = togglePlay;
    video.onclick = togglePlay;

    video.onplay = () => playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`; // Pause
    video.onpause = () => playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`; // Play
    video.onended = () => playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`; // Replay

    // 2. Volume Group (Right)
    const volWrapper = document.createElement('div');
    volWrapper.className = 'video-volume-wrapper';

    const volSliderContainer = document.createElement('div');
    volSliderContainer.className = 'video-volume-slider-container';
    
    const volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.className = 'video-volume-slider';
    volSlider.min = 0; volSlider.max = 1; volSlider.step = 0.1;
    
    // [UPDATE] Set giá trị slider theo volume đã nhớ
    volSlider.value = globalVideoVolume;
    
    volSlider.oninput = (e) => {
        e.stopPropagation();
        const newVol = parseFloat(volSlider.value);
        video.volume = newVol;
        video.muted = (newVol === 0);
        
        // [QUAN TRỌNG] Lưu volume mới vào biến toàn cục và Local Storage
        globalVideoVolume = newVol;
        localStorage.setItem('meou_video_volume', newVol);
        
        // Cập nhật icon loa
        updateVolIcon();
    };
    volSlider.onclick = (e) => e.stopPropagation();

    volSliderContainer.appendChild(volSlider);

    // Nút Loa
    const volBtn = document.createElement('button');
    volBtn.className = 'video-ctrl-btn vol-btn';
    
    // Hàm cập nhật icon loa
    const updateVolIcon = () => {
        if (video.muted || video.volume === 0) {
            volBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`; // Muted
        } else {
            volBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`; // Loa to
        }
    };
    
    // Gọi lần đầu để set icon đúng
    updateVolIcon();
    
    volBtn.onclick = (e) => {
        e.stopPropagation();
        // Toggle Mute: Nếu đang có tiếng -> Tắt tiếng (nhưng giữ volume cũ để restore nếu cần)
        // Nếu đang tắt tiếng -> Bật lại volume cũ
        if (video.muted) {
            video.muted = false;
            // Nếu volume đang 0 thì set lên 1 ít để nghe thấy
            if (video.volume === 0) {
                 video.volume = 0.5;
                 globalVideoVolume = 0.5;
            }
        } else {
            video.muted = true;
        }
        
        // Update Slider
        volSlider.value = video.muted ? 0 : video.volume;
        
        // Lưu trạng thái (nếu muốn lưu cả trạng thái mute thì cần thêm biến, ở đây em lưu volume thôi)
        if (!video.muted) {
             globalVideoVolume = video.volume;
             localStorage.setItem('meou_video_volume', globalVideoVolume);
        }
        
        updateVolIcon();
    };

    volWrapper.appendChild(volSliderContainer); 
    volWrapper.appendChild(volBtn);

    controlsDiv.appendChild(playBtn);
    controlsDiv.appendChild(volWrapper);

    // --- THANH TIẾN TRÌNH ---
    const progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'video-progress-container';
    
    const progressBar = document.createElement('div');
    progressBar.className = 'video-progress-bar';
    
    const progressFill = document.createElement('div');
    progressFill.className = 'video-progress-fill';
    
    progressBar.appendChild(progressFill);
    progressBarContainer.appendChild(progressBar);

    video.ontimeupdate = () => {
        const percent = (video.currentTime / video.duration) * 100;
        progressFill.style.width = `${percent}%`;
    };

    progressBarContainer.onclick = (e) => {
        e.stopPropagation();
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        video.currentTime = pos * video.duration;
    };

    videoContainer.appendChild(video);
    videoContainer.appendChild(expandBtn);
    videoContainer.appendChild(controlsDiv);
    videoContainer.appendChild(progressBarContainer);

    return videoContainer;
}

export function renderMessageRow(roleClass, textContent, timestamp = null, isHistory = false, currentTone = 'dan_chuyen', reaction = null, onReactionSelect = null, onReply = null, replyTo = null) {
    if (!chatHistoryContainer) return;

    const { displayText, mediaItems } = parseMessageContent(textContent, isHistory);
    if (!displayText && mediaItems.length === 0) return;

    const { row, contentWrapper } = createChatRowWithWrapper(roleClass, currentTone);
    let lastElement = null;

    if (replyTo) {
        contentWrapper.appendChild(createReplyLabel(replyTo, false));
    }

    if (displayText) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${roleClass}`;
        const textSpan = document.createElement("div");
        textSpan.textContent = displayText;
        msgDiv.appendChild(textSpan);
        
        if (roleClass === 'bot') {
            msgDiv.appendChild(createMsgActions(onReactionSelect, onReply));
        }
        if (reaction) msgDiv.appendChild(renderSelectedReaction(reaction));
        contentWrapper.appendChild(msgDiv);
        lastElement = msgDiv;
    }

    if (mediaItems.length > 0) {
        mediaItems.forEach(item => {
            const msgDiv = document.createElement("div");
            msgDiv.className = `chat-msg ${roleClass} media-msg`;

            if (item.type === 'image') {
                const img = document.createElement("img");
                if (item.isExternal) {
                    img.src = item.src;
                } else {
                    img.src = chrome.runtime.getURL(item.src);
                }
                img.className = "chat-img-content";
                img.onclick = () => showMediaModal(img.src, 'image'); 
                
                const wrappedContent = wrapSensitiveMedia(img, currentTone);
                msgDiv.appendChild(wrappedContent);

            } else if (item.type === 'voice') {
                const fullPath = chrome.runtime.getURL(item.src);
                const audioBubble = createAudioBubble(fullPath);
                msgDiv.appendChild(audioBubble);

            } else if (item.type === 'video') {
                const videoContainer = createVideoElementWithControls(item.src);
                const wrappedContent = wrapSensitiveMedia(videoContainer, currentTone);
                msgDiv.appendChild(wrappedContent);
            }
            
            if (roleClass === 'bot') {
                msgDiv.appendChild(createMsgActions(onReactionSelect, onReply));
            }
            
            contentWrapper.appendChild(msgDiv);
            lastElement = msgDiv;
        });
    }

    if (lastElement) {
        appendTimestamp(lastElement, timestamp);
    }

    chatHistoryContainer.appendChild(row);
    scrollToBottom();
}

export function displayMessage(roleClass, text, imgSrc, fileInfo, scroll = true, timestamp = null, currentTone = 'dan_chuyen', reaction = null, onReactionSelect = null, onReply = null, replyTo = null) {
    if (!chatHistoryContainer) return;

    const { row, contentWrapper } = createChatRowWithWrapper(roleClass, currentTone);
    let lastElement = null;

    if (replyTo) {
        contentWrapper.appendChild(createReplyLabel(replyTo, true));
    }

    if (text) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${roleClass}`;
        const t = document.createElement("div");
        t.textContent = text;
        msgDiv.appendChild(t);
        if (reaction) msgDiv.appendChild(renderSelectedReaction(reaction));
        contentWrapper.appendChild(msgDiv);
        lastElement = msgDiv;
    }

    if (imgSrc) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${roleClass} media-msg`;
        const i = document.createElement("img");
        i.src = imgSrc;
        i.className = "chat-img-content";
        i.onclick = () => showMediaModal(imgSrc, 'image'); 
        msgDiv.appendChild(i);
        if (reaction && !text) msgDiv.appendChild(renderSelectedReaction(reaction));
        contentWrapper.appendChild(msgDiv);
        lastElement = msgDiv;
    }

    if (fileInfo) {
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${roleClass}`;
        const f = document.createElement("div");
        f.className = "chat-file-chip";
        f.innerHTML = `<span>${escapeHTML(fileInfo.name)}</span>`;
        msgDiv.appendChild(f);
        if (reaction && !text && !imgSrc) msgDiv.appendChild(renderSelectedReaction(reaction));
        contentWrapper.appendChild(msgDiv);
        lastElement = msgDiv;
    }

    if (lastElement) {
        appendTimestamp(lastElement, timestamp);
    }

    chatHistoryContainer.appendChild(row);
    if (scroll) scrollToBottom();
}

export function renderBubble(roleClass, text, timestamp = null, currentTone = 'dan_chuyen', reaction = null, onReactionSelect = null, onReply = null) {
    if (!chatHistoryContainer) return;
    
    const targetRole = roleClass === 'error' ? 'bot' : roleClass;
    const { row, contentWrapper } = createChatRowWithWrapper(targetRole, currentTone);
    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-msg ${roleClass}`;

    if (text.includes('<svg')) {
        msgDiv.innerHTML = text;
    } else {
        const textSpan = document.createElement("div");
        textSpan.textContent = text;
        msgDiv.appendChild(textSpan);
    }
    
    if (roleClass !== 'error' && roleClass !== 'user') {
        msgDiv.appendChild(createMsgActions(onReactionSelect, onReply));
        if (reaction) msgDiv.appendChild(renderSelectedReaction(reaction));
    }

    if (timestamp) appendTimestamp(msgDiv, timestamp);
    contentWrapper.appendChild(msgDiv);
    chatHistoryContainer.appendChild(row);
    scrollToBottom();
}

export function showTypingIndicator(currentTone) {
    if (!chatHistoryContainer || chatHistoryContainer.querySelector(".typing-indicator-row")) return;
    renderBubble("bot", `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-ellipsis-icon lucide-ellipsis"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`, null, currentTone);
    const lastRow = chatHistoryContainer.lastElementChild;
    if (lastRow) lastRow.classList.add("typing-indicator-row");
    scrollToBottom();
}
export function removeTypingIndicator() {
    if (!chatHistoryContainer) return;
    const indicator = chatHistoryContainer.querySelector(".typing-indicator-row");
    if (indicator) indicator.remove();
}