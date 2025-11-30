// Các hàm tiện ích dùng chung cho trang Options

export function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg; 
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

export function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}

export function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { 
        hash = str.charCodeAt(i) + ((hash << 5) - hash); 
    }
    const h = Math.abs(hash) % 360; 
    return `hsl(${h}, 70%, 45%)`;
}

export function autoResize(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
}

export function showInputError(inputEl, errorEl) {
    if (!inputEl) return;
    inputEl.classList.add('input-error');
    inputEl.classList.add('shake-animation');
    if (errorEl) {
        errorEl.style.display = 'block';
    }
    setTimeout(() => {
        inputEl.classList.remove('shake-animation');
    }, 400);
}

export function clearInputError(inputEl, errorEl) {
    if (!inputEl) return;
    inputEl.classList.remove('input-error');
    if (errorEl) {
        errorEl.style.display = 'none';
    }
}