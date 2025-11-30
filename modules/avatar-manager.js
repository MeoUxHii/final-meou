// Module quản lý Avatar và hiển thị Media (Ảnh/Video)
export const AVATAR_MAP = {
    "dan_chuyen": "avatar/avatar_dan_chuyen.png",
    "lao_vo_cung": "avatar/avatar_lao_vo_cung.png",
    "be_cung": "avatar/avatar_be_cung.png",
    "mot_con_meo": "avatar/avatar_mot_con_meo.png",
    "be_dam_dang": "avatar/avatar_be_cung.png" 
};

const CACHED_AVATARS = {};

const processAvatar = async (src) => {
    if (!src) return "icon48.png";
    if (src.startsWith("data:image")) return src;
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = src;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const size = 128;
            canvas.width = size; canvas.height = size;
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => { resolve(src); };
    });
};

export async function optimizeAvatars() {
    for (const [tone, src] of Object.entries(AVATAR_MAP)) {
        try { CACHED_AVATARS[tone] = await processAvatar(src); } catch (e) {}
    }
    try {
        const data = await chrome.storage.local.get(['customAgents']);
        const agents = data.customAgents || [];
        for (const agent of agents) {
            if (agent.avatar) CACHED_AVATARS[agent.id] = await processAvatar(agent.avatar);
        }
    } catch (e) {}
    updateAllAvatarImages();
}

function updateAllAvatarImages() {
    const existingImgs = document.querySelectorAll(`.chat-avatar`);
    existingImgs.forEach(img => {
        const tone = img.dataset.tone;
        if (tone && CACHED_AVATARS[tone]) img.src = CACHED_AVATARS[tone];
    });
}

export function getAvatarSrc(tone) {
    if (CACHED_AVATARS[tone]) return CACHED_AVATARS[tone];
    if (AVATAR_MAP[tone]) return AVATAR_MAP[tone];
    return "icon48.png"; 
}

// --- [HELPER] TẠO VIDEO PLAYER CHO MODAL (Tái sử dụng logic Custom Controls) ---
function createModalVideoPlayer(src, closeModalFunc) {
    const videoContainer = document.createElement("div");
    videoContainer.className = "chat-video-container modal-video-player"; // Class mới để style to
    videoContainer.style.position = "relative";
    videoContainer.style.display = "inline-block";
    videoContainer.style.overflow = "hidden"; 
    
    // Lấy volume đã lưu
    let currentVolume = parseFloat(localStorage.getItem('meou_video_volume')) || 1.0;

    const video = document.createElement("video");
    video.className = "chat-video-content";
    video.src = src;
    video.controls = false; // TẮT CONTROLS MẶC ĐỊNH
    video.autoplay = true;
    video.playsInline = true;
    // Style đè cho modal
    video.style.width = "auto"; 
    video.style.height = "auto";
    video.style.maxWidth = "90vw"; 
    video.style.maxHeight = "85vh"; 
    video.style.borderRadius = "12px";
    video.style.backgroundColor = "#000"; 
    
    video.volume = currentVolume;
    if(currentVolume === 0) video.muted = true;

    // Click video để play/pause
    const togglePlay = (e) => {
        e && e.stopPropagation();
        video.paused ? video.play() : video.pause();
    };
    video.onclick = togglePlay;

    // --- NÚT THU NHỎ (COMPRESS) ---
    const compressBtn = document.createElement('div');
    compressBtn.className = 'video-expand-btn';
    compressBtn.title = "Thu nhỏ / Đóng";
    // Icon 2 mũi tên chụm vào nhau
    compressBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>`;
    
    compressBtn.onclick = (e) => {
        e.stopPropagation(); e.preventDefault();
        closeModalFunc();
    };

    // --- CUSTOM CONTROLS (Copy logic từ chat-renderer) ---
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'custom-video-controls';

    // Play/Pause
    const playBtn = document.createElement('button');
    playBtn.className = 'video-ctrl-btn play-btn';
    playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`; // Đang autoplay nên hiện Pause
    playBtn.onclick = togglePlay;

    video.onplay = () => playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    video.onpause = () => playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    video.onended = () => playBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;

    // Volume
    const volWrapper = document.createElement('div');
    volWrapper.className = 'video-volume-wrapper';
    const volSliderContainer = document.createElement('div');
    volSliderContainer.className = 'video-volume-slider-container';
    
    const volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.className = 'video-volume-slider';
    volSlider.min = 0; volSlider.max = 1; volSlider.step = 0.1;
    volSlider.value = currentVolume;
    
    volSlider.oninput = (e) => {
        e.stopPropagation();
        const newVol = parseFloat(volSlider.value);
        video.volume = newVol;
        video.muted = (newVol === 0);
        localStorage.setItem('meou_video_volume', newVol); // Sync volume
        updateVolIcon();
    };
    volSlider.onclick = (e) => e.stopPropagation();

    volSliderContainer.appendChild(volSlider);

    const volBtn = document.createElement('button');
    volBtn.className = 'video-ctrl-btn vol-btn';
    
    const updateVolIcon = () => {
        if (video.muted || video.volume === 0) {
            volBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
        } else {
            volBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
        }
    };
    updateVolIcon();

    volBtn.onclick = (e) => {
        e.stopPropagation();
        if (video.muted) {
            video.muted = false;
            if (video.volume === 0) video.volume = 0.5;
        } else {
            video.muted = true;
        }
        volSlider.value = video.muted ? 0 : video.volume;
        if (!video.muted) localStorage.setItem('meou_video_volume', video.volume);
        updateVolIcon();
    };

    volWrapper.appendChild(volSliderContainer);
    volWrapper.appendChild(volBtn);
    controlsDiv.appendChild(playBtn);
    controlsDiv.appendChild(volWrapper);

    // Progress Bar
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
    videoContainer.appendChild(compressBtn); // Dùng nút thu nhỏ
    videoContainer.appendChild(controlsDiv);
    videoContainer.appendChild(progressBarContainer);

    return videoContainer;
}

export function showMediaModal(src, type = 'image', currentTone = null) {
    let modal = document.getElementById('avatar-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'avatar-modal';
        modal.innerHTML = `
            <span class="close-modal">&times;</span>
            <div id="media-modal-container" style="display:flex;justify-content:center;align-items:center;width:100%;height:100%;"></div>
        `;
        document.body.appendChild(modal);

        const closeFunc = () => {
            const v = modal.querySelector('video');
            if (v) v.pause();
            modal.style.display = "none";
            // Xóa nội dung để dừng video hẳn và giải phóng bộ nhớ
            document.getElementById('media-modal-container').innerHTML = ''; 
        };

        modal.querySelector('.close-modal').onclick = closeFunc;
        modal.onclick = (e) => { 
            if (e.target === modal || e.target.id === 'media-modal-container') closeFunc(); 
        };
    }

    const container = document.getElementById('media-modal-container');
    container.innerHTML = ''; 

    const closeFunc = () => {
        const v = modal.querySelector('video');
        if (v) v.pause();
        modal.style.display = "none";
        container.innerHTML = '';
    };

    if (type === 'video') {
        // Dùng hàm tạo player mới thay vì tạo thẻ video trần
        const videoPlayer = createModalVideoPlayer(src, closeFunc);
        container.appendChild(videoPlayer);
    } else {
        let imgSrc = src;
        if (!src && currentTone) imgSrc = getAvatarSrc(currentTone);
        const img = document.createElement('img');
        img.src = imgSrc;
        img.id = "img-full-view";
        img.className = "modal-content";
        container.appendChild(img);
    }

    modal.style.display = "flex";
}

export function showAvatarModal(src, currentTone) {
    showMediaModal(src, 'image', currentTone);
}