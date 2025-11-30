// --- BIẾN TOÀN CỤC (Shared Globals) ---
window.uiGlobals = {
    translateButton: null,
    popup: null,
    historyPopup: null,
    shadowRoot: null,
    currentThemeIsDark: false,
    hideButtonTimer: null
};

// --- DEFINITIONS (ICONS & GRADIENTS) ---
window.UI_CONSTANTS = {
    GRADIENT_DEFS_DARK: `
        <defs>
            <linearGradient id="gradThemeDark" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#FFCCFF" />
                <stop offset="100%" stop-color="#CCFFFF" />
            </linearGradient>
        </defs>
    `,
    GRADIENT_DEFS_LIGHT: `
        <defs>
            <linearGradient id="gradThemeLight" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#FF0066" />
                <stop offset="50%" stop-color="#9900CC" />
                <stop offset="100%" stop-color="#6600FF" />
            </linearGradient>
        </defs>
    `
};

window.getIcons = (isDark) => {
    const defs = isDark ? window.UI_CONSTANTS.GRADIENT_DEFS_DARK : window.UI_CONSTANTS.GRADIENT_DEFS_LIGHT;
    const urlId = isDark ? "url(#gradThemeDark)" : "url(#gradThemeLight)";
    
    return {
        history: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${urlId}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-history-icon lucide-history">${defs}<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
        retranslate: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${urlId}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-languages-icon lucide-languages">${defs}<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
        copy: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${urlId}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-icon lucide-clipboard">${defs}<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${urlId}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-list-icon lucide-clipboard-list">${defs}<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>`,
        speak: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${urlId}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume2-icon lucide-volume-2">${defs}<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg>`,
        stop: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${urlId}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-off-icon lucide-volume-off">${defs}<path d="M16 9a5 5 0 0 1 .95 2.293"/><path d="M19.364 5.636a9 9 0 0 1 1.889 9.96"/><path d="m2 2 20 20"/><path d="m7 7-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11"/><path d="M9.828 4.172A.686.686 0 0 1 11 4.657v.686"/></svg>`,
        loading: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${urlId}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle-icon lucide-loader-circle ai-icon-spin">${defs}<path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
        close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        back: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-undo-dot-icon lucide-undo-dot"><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/><path d="M3 7v6h6"/><circle cx="12" cy="17" r="1"/></svg>`
    };
};

window.getShadowRoot = function() {
    if (window.uiGlobals.shadowRoot) return window.uiGlobals.shadowRoot;
    
    const target = document.body || document.documentElement;
    if (!target) return null;
    
    const host = document.createElement('div');
    host.id = 'meou-extension-host';   
    target.appendChild(host);
    window.uiGlobals.shadowRoot = host.attachShadow({ mode: 'open' });
    
    // Inject CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content.css');
    window.uiGlobals.shadowRoot.appendChild(link);
    
    // Inject Font Styles
    const fontStyle = document.createElement('style');
    fontStyle.textContent = `
        @font-face {
            font-family: 'MeoUFont';
            src: url('${chrome.runtime.getURL('fonts/meou.ttf')}') format('truetype');
            font-weight: normal;
            font-style: normal;
        }
        :host {
            font-family: 'MeoUFont', sans-serif;
        }
    `;
    window.uiGlobals.shadowRoot.appendChild(fontStyle);
    
    // Inject Extra Styles
    const style = document.createElement('style');
    style.textContent = `
        .ai-popup-back-to-translate {
            width: 30px !important;
            height: 30px !important;
            padding: 0 !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: transparent !important;
            margin-left: auto;
        }
        .ai-popup-back-to-translate:hover {
            background: rgba(255, 255, 255, 0.2) !important;
        }
    `;
    window.uiGlobals.shadowRoot.appendChild(style);

    return window.uiGlobals.shadowRoot;
};

window.updateIcons = function(isDark) {
    window.uiGlobals.currentThemeIsDark = isDark;
    const icons = window.getIcons(isDark);
    const { popup, historyPopup } = window.uiGlobals;

    if (popup) {
        const historyBtn = popup.querySelector(".ai-popup-show-history");
        const retranslateBtn = popup.querySelector(".ai-popup-retranslate");
        const copyBtn = popup.querySelector(".ai-popup-copy");
        const speakBtn = popup.querySelector(".ai-popup-speak");
        const closeBtn = popup.querySelector(".ai-popup-close");

        if (historyBtn) historyBtn.innerHTML = icons.history;
        if (retranslateBtn) retranslateBtn.innerHTML = icons.retranslate;
        if (copyBtn && !copyBtn.innerHTML.includes("clipboard-list")) copyBtn.innerHTML = icons.copy;
        
        if (speakBtn && !speakBtn.classList.contains("loading")) {
             if(speakBtn.innerHTML.includes("volume-off")) speakBtn.innerHTML = icons.stop;
             else speakBtn.innerHTML = icons.speak;
        }
        if (closeBtn) closeBtn.innerHTML = icons.close;
    }

    if (historyPopup) {
        const backBtn = historyPopup.querySelector(".ai-popup-back-to-translate");
        const closeBtn = historyPopup.querySelector(".ai-popup-close-history");

        if (backBtn) backBtn.innerHTML = icons.back;
        if (closeBtn) closeBtn.innerHTML = icons.close;
    }
};

window.applyThemeToElements = function() {
    chrome.storage.sync.get(['userTheme'], (data) => {
        const theme = data.userTheme || {
            colors: ["#6DD5FA", "#FFDA63"], 
            angle: 135,
            opacity: 100
        };

        const gradient = window.getGradientString ? window.getGradientString(theme) : 'linear-gradient(135deg, #667eea, #764ba2)';
        const isDark = window.isThemeDark ? window.isThemeDark(theme.colors) : false;
        const textColor = window.getTextColor ? window.getTextColor(isDark) : '#333';
        
        window.updateIcons(isDark);

        const { popup, historyPopup } = window.uiGlobals;

        if (popup) {
            const header = popup.querySelector('.ai-popup-header');
            if (header) {
                header.style.background = gradient;
                header.style.color = textColor;
            }
        }

        if (historyPopup) {
            const header = historyPopup.querySelector('.ai-popup-header');
            if (header) {
                header.style.background = gradient;
                header.style.color = textColor;
            }
        }
    });
};
