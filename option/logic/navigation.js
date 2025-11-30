// Xử lý Chuyển Tab (Navigation)

// Khai báo biến module-scope để dùng chung trong file
let navShortcuts, navAgents, navApi, navGame; // Thêm navGame
let headerShortcuts, headerAgents, headerApi;
let viewShortcuts, viewAgents, viewApi;
let apiKeysInput;

export function setupNavigation() {
    // 1. Lấy Elements (Lazy Load - Chỉ lấy khi hàm được gọi sau DOMContentLoaded)
    navShortcuts = document.getElementById('navShortcuts');
    navAgents = document.getElementById('navAgents');
    navApi = document.getElementById('navApi');
    navGame = document.getElementById('navGame'); // Lấy nút Game

    headerShortcuts = document.getElementById('headerShortcuts');
    headerAgents = document.getElementById('headerAgents');
    headerApi = document.getElementById('headerApi');

    viewShortcuts = document.getElementById('viewShortcuts');
    viewAgents = document.getElementById('viewAgents');
    viewApi = document.getElementById('viewApi');

    apiKeysInput = document.getElementById('apiKeys');

    // 2. Gắn sự kiện (Kiểm tra tồn tại để tránh lỗi null)
    if(navShortcuts) navShortcuts.addEventListener('click', (e) => { e.preventDefault(); switchView('shortcuts'); });
    if(navAgents) navAgents.addEventListener('click', (e) => { e.preventDefault(); switchView('agents'); });
    if(navApi) navApi.addEventListener('click', (e) => { e.preventDefault(); switchView('api'); });
    
    // SỰ KIỆN NÚT GAME
    if(navGame) {
        navGame.addEventListener('click', (e) => { 
            e.preventDefault(); 
            // Mở game trong tab mới
            chrome.tabs.create({ url: 'game/game.html' });
        });
    }

    console.log("✅ Navigation Setup Done!");
}

function switchView(viewName) {
    // Reset active state
    [navShortcuts, navAgents, navApi].forEach(el => el && el.classList.remove('active'));
    [headerShortcuts, headerAgents, headerApi].forEach(el => el && el.classList.add('hidden'));
    [viewShortcuts, viewAgents, viewApi].forEach(el => el && el.classList.add('hidden'));

    // Activate selected view
    if (viewName === 'shortcuts') {
        if(navShortcuts) navShortcuts.classList.add('active');
        if(headerShortcuts) headerShortcuts.classList.remove('hidden');
        if(viewShortcuts) viewShortcuts.classList.remove('hidden');
    } else if (viewName === 'agents') {
        if(navAgents) navAgents.classList.add('active');
        if(headerAgents) headerAgents.classList.remove('hidden');
        if(viewAgents) viewAgents.classList.remove('hidden');
    } else if (viewName === 'api') {
        if(navApi) navApi.classList.add('active');
        if(headerApi) headerApi.classList.remove('hidden');
        if(viewApi) viewApi.classList.remove('hidden');
        
        // Auto resize textarea khi chuyển qua tab API
        if(apiKeysInput) { 
            setTimeout(() => {
                apiKeysInput.style.height = 'auto'; 
                apiKeysInput.style.height = (apiKeysInput.scrollHeight) + 'px'; 
            }, 50);
        }
    }
}