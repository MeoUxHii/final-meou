console.log("✅ Sidepanel script loaded!");

let currentResultUrl = ""; 
const DEFAULT_BASE_WIDTH = 800; 
let userZoomLevel = 1.0; 

// --- [MỚI] HÀM XỬ LÝ THEME ---
function hexToRgba(hex, alphaPercent) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = alphaPercent / 100;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function getGradientString(theme) {
    if (!theme || !theme.colors) return 'linear-gradient(135deg, #667eea, #764ba2)';
    const rgbaColors = theme.colors.map(c => hexToRgba(c, theme.opacity));
    return `linear-gradient(${theme.angle}deg, ${rgbaColors.join(", ")})`;
}

function isThemeDark(colors) {
    if (!colors || colors.length === 0) return false;
    let totalLum = 0;
    colors.forEach(hex => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const lum = (0.299 * r + 0.587 * g + 0.114 * b);
        totalLum += lum;
    });
    return (totalLum / colors.length) < 140;
}

function applyTheme() {
    chrome.storage.sync.get(['userTheme'], (data) => {
        const theme = data.userTheme || {
            colors: ["#6DD5FA", "#FFDA63"], 
            angle: 135,
            opacity: 100
        };

        const gradient = getGradientString(theme);
        const isDark = isThemeDark(theme.colors);
        const textColor = isDark ? '#ffffff' : '#333333';
        const accentColor = isDark ? '#FF69B4' : '#007bff'; // Hồng nếu nền tối, xanh nếu nền sáng

        // Cập nhật biến CSS
        const root = document.documentElement;
        root.style.setProperty('--bg-color', gradient); // Set background là gradient
        root.style.setProperty('--text-color', textColor);
        root.style.setProperty('--accent-color', accentColor);
        
        // Nếu background là gradient thì set background-image
        document.body.style.background = gradient;
    });
}

// Gọi hàm apply theme ngay khi load
applyTheme();

// Lắng nghe thay đổi theme từ trang Options
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.userTheme) {
        applyTheme();
    }
});
// -----------------------------

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "SIDE_PANEL_LOADING") {
      showLoading();
  }
  
  if (message.action === "SHOW_RESULT") {
      console.log("🔗 URL:", message.url);
      currentResultUrl = message.url;
      userZoomLevel = 1.0; 
      renderIframe(); 
  }

  if (message.action === "SHOW_ERROR") {
      showError(message.message);
  }
});

function renderIframe() {
    if (!currentResultUrl) return;

    // Giữ lại theme khi render lại HTML
    // Lưu ý: Iframe Google Lens sẽ đè lên background, nhưng phần rìa (nếu zoom nhỏ) vẫn thấy background
    document.body.innerHTML = `
        <div id="lens-container" style="width: 100vw; height: 100vh; overflow: hidden; position: relative;">
            <iframe 
                id="lens-frame"
                src="${currentResultUrl}" 
                style="
                    border: none;
                    position: absolute;
                    top: 0;
                    left: 0;
                    z-index: 1;
                "
                allow="camera;microphone;geolocation"
            ></iframe>
        </div>
        
        <div style="position:fixed; bottom:20px; right:20px; display:flex; flex-direction:column; gap:10px; z-index:9999;">
            <button id="btn-zoom-in" style="width:40px; height:40px; border-radius:50%; border:none; background:rgba(0,0,0,0.6); color:white; box-shadow:0 4px 10px rgba(0,0,0,0.2); cursor:pointer; font-size:20px; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);">+</button>
            <button id="btn-zoom-reset" style="width:40px; height:40px; border-radius:50%; border:none; background:rgba(0,0,0,0.6); color:#8ab4f8; box-shadow:0 4px 10px rgba(0,0,0,0.2); cursor:pointer; font-size:12px; font-weight:bold; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);">1x</button>
            <button id="btn-zoom-out" style="width:40px; height:40px; border-radius:50%; border:none; background:rgba(0,0,0,0.6); color:white; box-shadow:0 4px 10px rgba(0,0,0,0.2); cursor:pointer; font-size:20px; display:flex; align-items:center; justify-content:center; backdrop-filter: blur(5px);">-</button>
            <a href="${currentResultUrl}" target="_blank" 
               style="width:40px; height:40px; border-radius:50%; background:var(--accent-color, #ff69b4); color:white; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 10px rgba(0,0,0,0.2); text-decoration:none;">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
        </div>
    `;

    document.getElementById('btn-zoom-in').addEventListener('click', () => changeZoom(0.1));
    document.getElementById('btn-zoom-out').addEventListener('click', () => changeZoom(-0.1));
    document.getElementById('btn-zoom-reset').addEventListener('click', () => { userZoomLevel = 1.0; updateLayout(); });

    updateLayout();
}

function updateLayout() {
    const iframe = document.getElementById('lens-frame');
    if (!iframe) return;

    const panelWidth = window.innerWidth;
    const safeWidth = Math.max(panelWidth, 100);
    const baseScale = safeWidth / DEFAULT_BASE_WIDTH;
    const finalScale = baseScale * userZoomLevel;

    iframe.style.width = `${100 / finalScale}%`;
    iframe.style.height = `${100 / finalScale}%`;
    iframe.style.transform = `scale(${finalScale})`;
    iframe.style.transformOrigin = '0 0';

    const resetBtn = document.getElementById('btn-zoom-reset');
    if (resetBtn) resetBtn.innerText = Math.round(userZoomLevel * 10) / 10 + 'x';
}

function changeZoom(delta) {
    userZoomLevel = Math.max(0.5, Math.min(userZoomLevel + delta, 3.0));
    updateLayout();
}

window.addEventListener('resize', updateLayout);

function showLoading() {
    // Tái tạo loading với style dùng biến theme
    document.body.innerHTML = `
        <div id="status-container" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;">
            <div class="loader" id="loader"></div>
            <h3 id="status">Đang phân tích...</h3>
            <p id="subtext">Meou đang gửi ảnh cho Google...</p>
        </div>
    `;
    // Apply lại theme (phòng trường hợp innerHTML xóa mất style inline của body)
    applyTheme();
}

function showError(msg) {
    document.body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;color:red;text-align:center;padding:20px;">
            <h3>Oops!</h3>
            <p>${msg}</p>
        </div>
    `;
    applyTheme();
}