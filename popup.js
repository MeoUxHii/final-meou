import { initSettings } from './modules/settings-manager.js';
import { initTheme } from './modules/theme-manager.js';
import { initChat } from './modules/chat-manager.js';
import { initHistory } from './modules/history-manager.js';
import { escapeHTML } from './modules/ui-utils.js';

async function loadTabContent(url, elementId) {
    try {
        const response = await fetch(chrome.runtime.getURL(url));
        if (!response.ok) throw new Error('Network response was not ok');
        const html = await response.text();
        const container = document.getElementById(elementId);
        if (container) container.innerHTML = html;
    } catch (error) {
        console.error(`Lỗi không load được tab ${url}:`, error);
    }
}

// --- HELPER QUAN TRỌNG: Format ngày phải khớp với background.js ---
function getDateKey(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getCurrentWeekDates() {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = CN, 1 = T2...
    
    // Tính ngày Thứ 2 của tuần này
    const diff = currentDay === 0 ? 6 : currentDay - 1; 
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        weekDates.push(getDateKey(day));
    }
    return weekDates;
}

// --- LOGIC TAB SHIELD ---
let isShieldInitialized = false;

function initShieldTab() {
    const toggleInput = document.getElementById('toggle-shield-input');
    if (!toggleInput) return; 

    if (!isShieldInitialized) {
        chrome.storage.sync.get(['adblockEnabled'], (data) => {
            const isEnabled = data.adblockEnabled !== false; 
            toggleInput.checked = isEnabled; 
            updateShieldState(isEnabled); 
        });

        toggleInput.addEventListener('change', function() {
            const isEnabled = this.checked;
            updateShieldState(isEnabled);
            chrome.runtime.sendMessage({ action: 'set_adblock_status', enabled: isEnabled });
            chrome.storage.sync.set({ adblockEnabled: isEnabled });
        });
        isShieldInitialized = true;
    }
    refreshShieldData();
}

function updateShieldState(isEnabled) {
    const blockCountDisplay = document.getElementById('block-count-display');
    const shieldPathOn = document.getElementById('shield-path-on'); 
    const shieldPulse = document.getElementById('shield-pulse');
    
    if (!blockCountDisplay || !shieldPathOn) return;

    if (isEnabled) {
        blockCountDisplay.style.opacity = '1';
        shieldPathOn.style.opacity = '1'; 
        if(shieldPulse) {
            shieldPulse.classList.remove('pulse-red');
            shieldPulse.classList.add('pulse-green');
        }
    } else {
        blockCountDisplay.style.opacity = '0.5';
        shieldPathOn.style.opacity = '0';
        if(shieldPulse) {
            shieldPulse.classList.remove('pulse-green');
            shieldPulse.classList.add('pulse-red');
        }
    }
}

function refreshShieldData() {
    const currentWebsiteDisplay = document.getElementById('current-website');
    const blockCountDisplay = document.getElementById('block-count-display');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (currentWebsiteDisplay && tabs && tabs[0] && tabs[0].url) {
            try {
                const url = new URL(tabs[0].url);
                if (url.protocol.startsWith('http')) {
                    currentWebsiteDisplay.textContent = url.hostname;
                } else {
                    currentWebsiteDisplay.textContent = "Trang hệ thống";
                }
            } catch (e) {
                currentWebsiteDisplay.textContent = "MeoU Extension";
            }
        }
    });

    chrome.storage.local.get(['totalAdsBlocked', 'dailyStats'], (data) => {
        const total = data.totalAdsBlocked || 0;
        if (blockCountDisplay) blockCountDisplay.textContent = total.toLocaleString();
        
        console.log("Popup Read Daily Stats:", data.dailyStats); // Debug
        renderChart(data.dailyStats || {});
    });
}

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.totalAdsBlocked) {
            const blockCountDisplay = document.getElementById('block-count-display');
            if (blockCountDisplay) blockCountDisplay.textContent = (changes.totalAdsBlocked.newValue || 0).toLocaleString();
        }
        if (changes.dailyStats) {
            renderChart(changes.dailyStats.newValue || {});
        }
    }
    if (namespace === 'sync' && changes.adblockEnabled) {
         const isEnabled = changes.adblockEnabled.newValue;
         const toggleInput = document.getElementById('toggle-shield-input');
         if (toggleInput) toggleInput.checked = isEnabled;
         updateShieldState(isEnabled);
    }
});

let myChart = null;

function renderChart(dailyStats) {
    const ctx = document.getElementById('statsChart');
    if (!ctx) return;

    if (!window.Chart) {
        const parent = ctx.parentElement;
        if (parent && !parent.querySelector('.chart-error')) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'chart-error';
            errorMsg.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #ef4444; font-size: 11px; background: rgba(255,255,255,0.8); z-index: 10;';
            errorMsg.innerHTML = '⚠️ <b>Lỗi hiển thị</b><br>Thiếu thư viện lib/chart.js';
            parent.appendChild(errorMsg);
        }
        return;
    }
    const existingError = ctx.parentElement.querySelector('.chart-error');
    if (existingError) existingError.remove();

    const weekKeys = getCurrentWeekDates();
    const dataValues = weekKeys.map(key => dailyStats[key] || 0);

    const context = ctx.getContext('2d');
    let gradient = context.createLinearGradient(0, 0, 0, 150);
    gradient.addColorStop(0, 'rgba(74, 222, 128, 0.6)');
    gradient.addColorStop(1, 'rgba(74, 222, 128, 0.0)');

    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(context, {
        type: 'line',
        data: {
            labels: ['', '', '', '', '', '', ''], 
            datasets: [{
                label: 'Quảng cáo',
                data: dataValues,
                borderColor: '#4ade80',
                backgroundColor: gradient,
                borderWidth: 3,
                pointRadius: 4, 
                pointBackgroundColor: '#fff',
                pointBorderColor: '#4ade80',
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false }, 
                tooltip: { 
                    enabled: true, 
                    mode: 'index', 
                    intersect: false,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyFont: { size: 13 },
                    displayColors: false,
                    callbacks: {
                        title: () => null, 
                        label: (context) => `Đã chặn: ${context.raw}`
                    }
                } 
            },
            scales: {
                x: { display: false, grid: { display: false } },
                y: { display: false, beginAtZero: true, suggestedMax: Math.max(...dataValues) > 0 ? Math.max(...dataValues) + 2 : 5 }
            },
            interaction: { mode: 'nearest', axis: 'x', intersect: false },
            elements: { line: { borderCapStyle: 'round', borderJoinStyle: 'round' } }
        }
    });
}

// --- MAGIC EXPANDER CLASS ---
class PopupMagicExpander {
    constructor() {
        this.shortcuts = [];
        this.enabled = true;
        this.loadSettings();
        this.initListener();
    }
    loadSettings() {
        chrome.storage.sync.get(['magicTemplates', 'magicEnabled'], (data) => {
            if (data.magicTemplates) this.shortcuts = data.magicTemplates;
            if (data.magicEnabled !== undefined) this.enabled = data.magicEnabled;
        });
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                if (changes.magicTemplates) this.shortcuts = changes.magicTemplates.newValue || [];
                if (changes.magicEnabled) this.enabled = changes.magicEnabled.newValue;
            }
        });
    }
    initListener() { document.addEventListener('input', (e) => this.handleInput(e)); }
    handleInput(e) {
        if (!this.enabled || !e.target) return;
        if (e.inputType && (e.inputType.startsWith('delete') || e.inputType === 'historyUndo')) return;
        const target = e.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        if (!isInput) return; 
        this.expandInput(target);
    }
    expandInput(target) {
        if (this.shortcuts.length === 0) return;
        const text = target.value;
        const cursorPosition = target.selectionStart;
        const textBeforeCursor = text.slice(Math.max(0, cursorPosition - 50), cursorPosition);
        for (const template of this.shortcuts) {
            if (textBeforeCursor.endsWith(template.shortcut)) {
                const cutIndex = cursorPosition - template.shortcut.length;
                const newText = text.slice(0, cutIndex) + template.content + text.slice(cursorPosition);
                const scrollTop = target.scrollTop;
                target.value = newText; 
                const newCursorPos = cutIndex + template.content.length;
                target.setSelectionRange(newCursorPos, newCursorPos);
                target.scrollTop = scrollTop;
                target.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
        }
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await Promise.all([
        loadTabContent('tabs/settings.html', 'settings-content'),
        loadTabContent('tabs/chat.html', 'chat-content'),
        loadTabContent('tabs/history.html', 'history-content'),
        loadTabContent('tabs/theme.html', 'theme-content'),
        loadTabContent('tabs/magic.html', 'magic-content'),
        loadTabContent('tabs/shield.html', 'shield-content')
    ]);

    initSettings();
    initTheme();
    initChat();
    initHistory();
    new PopupMagicExpander();
    
    initShieldTab();

    const tabs = [ 
        { btn: 'settingsTabBtn', content: 'settings-content' }, 
        { btn: 'historyTabBtn', content: 'history-content' }, 
        { btn: 'themeTabBtn', content: 'theme-content' },
        { btn: 'chatTabBtn', content: 'chat-content' },
        { btn: 'magicTabBtn', content: 'magic-content' },
        { btn: 'shieldTabBtn', content: 'shield-content' } 
    ];

    if (!document.querySelector('.tab-content.active')) {
        const defaultTab = document.getElementById('settings-content');
        if (defaultTab) defaultTab.classList.add('active');
    }

    tabs.forEach(tab => {
        const btn = document.getElementById(tab.btn);
        if(btn) {
            btn.addEventListener('click', () => {
                tabs.forEach(t => { 
                    const b = document.getElementById(t.btn);
                    const c = document.getElementById(t.content);
                    if (b) b.classList.remove('active'); 
                    if (c) { c.classList.remove('active'); c.style.display = ''; }
                });
                
                btn.classList.add('active'); 
                const content = document.getElementById(tab.content);
                if (content) content.classList.add('active');
                
                if (tab.btn === 'historyTabBtn' && window.loadHistoryFunc) window.loadHistoryFunc();
                if (tab.btn === 'chatTabBtn' && window.chatScrollToBottom) setTimeout(() => window.chatScrollToBottom(), 50); 
                if (tab.btn === 'shieldTabBtn') initShieldTab(); 
                
                if (tab.btn === 'magicTabBtn') {
                    const magicList = document.getElementById('magicListPopup');
                    const magicCount = document.getElementById('magicCountPopup');
                    chrome.storage.sync.get(['magicTemplates'], (data) => {
                       const templates = data.magicTemplates || [];
                       if (magicList) {
                           magicList.innerHTML = '';
                           if(magicCount) magicCount.textContent = templates.length;
                           if (templates.length === 0) {
                                magicList.innerHTML = `<div class="empty-magic-state">Chưa có shortcut nào.<br>Bấm "Quản lý" để thêm mới nhé!</div>`;
                           } else {
                               templates.forEach(item => {
                                   const card = document.createElement('div');
                                   card.className = 'magic-card';
                                   card.onclick = () => { if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage(); };
                                   card.innerHTML = `<div class="magic-card-shortcut">${escapeHTML(item.shortcut)}</div><div class="magic-card-preview">${escapeHTML(item.content)}</div>`;
                                   magicList.appendChild(card);
                               });
                           }
                       }
                    });
                }
            });
        }
    });

    const magicToggle = document.getElementById('magicToggle');
    const openOptionsBtn = document.getElementById('openOptionsBtn');
    const magicSearch = document.getElementById('magicSearchPopup');
    let allShortcuts = [];

    chrome.storage.sync.get(['magicEnabled', 'magicTemplates'], (data) => {
        if(magicToggle) magicToggle.checked = data.magicEnabled !== false; 
        allShortcuts = data.magicTemplates || [];
    });

    if(magicToggle) {
        magicToggle.addEventListener('change', (e) => { chrome.storage.sync.set({ magicEnabled: e.target.checked }); });
    }

    if (openOptionsBtn) {
        openOptionsBtn.addEventListener('click', () => {
            if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
            else window.open(chrome.runtime.getURL('options.html'));
        });
    }

    if (magicSearch) {
        magicSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const magicList = document.getElementById('magicListPopup');
            if(!magicList) return;
            const filtered = allShortcuts.filter(t => t.shortcut.toLowerCase().includes(query) || t.content.toLowerCase().includes(query));
            magicList.innerHTML = '';
            filtered.forEach(item => {
                const card = document.createElement('div');
                card.className = 'magic-card';
                card.onclick = () => { if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage(); };
                card.innerHTML = `<div class="magic-card-shortcut">${escapeHTML(item.shortcut)}</div><div class="magic-card-preview">${escapeHTML(item.content)}</div>`;
                magicList.appendChild(card);
            });
        });
    }
});