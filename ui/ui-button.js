window.createTranslateButton = function() {
    if (window.uiGlobals.translateButton) return window.uiGlobals.translateButton;

    const btn = document.createElement("div");
    btn.id = "ai-translate-btn";
    btn.innerHTML = "🧐";
    btn.style.display = "none";
    window.getShadowRoot().appendChild(btn);
    window.uiGlobals.translateButton = btn;

    btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        window.hideTranslateButton();
        if(typeof translateSelectedText === 'function') {
             await translateSelectedText({ clientX: e.clientX, clientY: e.clientY });
        }
    });

    return btn;
};

window.showTranslateButton = function(x, y) {
    if (!window.uiGlobals.translateButton) {
        window.createTranslateButton();
    }
    const btn = window.uiGlobals.translateButton;
    const buttonWidth = 50;
    const buttonHeight = 50;
    const pad = 10;
    let left = x + 10;
    let top = y + 10;
    if (left + buttonWidth + pad > window.innerWidth + window.scrollX) {
        left = x - buttonWidth - 5;
    }
    if (top + buttonHeight + pad > window.innerHeight + window.scrollY) {
        top = y - buttonHeight - 5;
    }
    btn.style.left = `${left}px`;
    btn.style.top = `${top}px`;
    btn.style.display = "flex";
    
    if (window.uiGlobals.hideButtonTimer) {
        clearTimeout(window.uiGlobals.hideButtonTimer);
    }
    window.uiGlobals.hideButtonTimer = setTimeout(() => {
        window.hideTranslateButton();
    }, 2000);
};

window.hideTranslateButton = function() {
    if (window.uiGlobals.translateButton) {
        window.uiGlobals.translateButton.style.display = "none";
    }
    if (window.uiGlobals.hideButtonTimer) {
        clearTimeout(window.uiGlobals.hideButtonTimer);
        window.uiGlobals.hideButtonTimer = null;
    }
};