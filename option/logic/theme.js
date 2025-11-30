// Xử lý Theme (Giao diện)

export async function loadTheme() {
    const data = await chrome.storage.sync.get(['userTheme']);
    if (data.userTheme) applyTheme(data.userTheme);
    
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync' && changes.userTheme) {
            applyTheme(changes.userTheme.newValue);
        }
    });
}

function applyTheme(theme) {
    // Kiểm tra hàm global từ utils.js gốc hoặc định nghĩa lại nếu cần
    // Ở đây giả định window.getGradientString và window.isThemeDark đã có sẵn 
    // (do options.html load utils.js trước options.js)
    if (!window.getGradientString || !window.isThemeDark) return;
    
    const gradient = window.getGradientString(theme);
    const isDark = window.isThemeDark(theme.colors);
    
    document.body.style.background = gradient;
    const root = document.documentElement;
    
    if (isDark) {
        root.style.setProperty('--text-main', '#ffffff');
        root.style.setProperty('--text-sub', 'rgba(255, 255, 255, 0.7)');
        root.style.setProperty('--bg-sidebar', 'rgba(0, 0, 0, 0.2)');
        root.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.1)');
        root.style.setProperty('--bg-card-hover', 'rgba(60, 60, 60, 0.9)');
        root.style.setProperty('--border', 'rgba(255, 255, 255, 0.15)');
    } else {
        root.style.setProperty('--text-main', '#111827');
        root.style.setProperty('--text-sub', '#4b5563');
        root.style.setProperty('--bg-sidebar', 'rgba(255, 255, 255, 0.6)');
        root.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.8)');
        root.style.setProperty('--bg-card-hover', 'rgba(255, 255, 255, 0.95)');
        root.style.setProperty('--border', 'rgba(0, 0, 0, 0.05)');
    }
}