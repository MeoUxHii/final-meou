// Xử lý API Settings
import { showToast } from './utils.js';

const apiKeysInput = document.getElementById('apiKeys');
const gcpKeyInput = document.getElementById('gcpTtsApiKey');
const saveApiBtn = document.getElementById('saveApiBtn');

export async function loadApiSettings() {
    const data = await chrome.storage.sync.get(['apiKeys', 'gcpTtsApiKey']);
    if (data.apiKeys && Array.isArray(data.apiKeys) && apiKeysInput) {
        apiKeysInput.value = data.apiKeys.join('\n');
        apiKeysInput.style.height = 'auto'; 
        apiKeysInput.style.height = (apiKeysInput.scrollHeight) + 'px';
    }
    if (data.gcpTtsApiKey && gcpKeyInput) {
        gcpKeyInput.value = data.gcpTtsApiKey;
    }
}

export function initApiListeners() {
    if (saveApiBtn) saveApiBtn.addEventListener('click', saveApiSettings);
    if (apiKeysInput) {
        apiKeysInput.addEventListener('input', function() { 
            this.style.height = 'auto'; 
            this.style.height = (this.scrollHeight) + 'px'; 
        });
    }
}

function saveApiSettings() {
    const rawKeys = apiKeysInput ? apiKeysInput.value : '';
    const keysArray = rawKeys.split('\n').map(k => k.trim()).filter(k => k.length > 0);
    const gcpKey = gcpKeyInput ? gcpKeyInput.value.trim() : '';
    
    chrome.storage.sync.set({ apiKeys: keysArray, gcpTtsApiKey: gcpKey }, () => {
        showToast('✅ Đã lưu cấu hình API!');
    });
}