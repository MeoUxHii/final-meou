import { escapeHTML } from './ui-utils.js';
import { optimizeAvatars } from './avatar-manager.js';
import { 
    loadMediaState, 
    saveMediaState, 
    resetMediaState, 
    mediaState, 
    COOLDOWN_TIME,
    getRandomDriveImage,
    getRandomDiscordVideo 
} from './media-handler.js';
import { 
    initChatRenderer, 
    renderMessageRow, 
    displayMessage, 
    renderBubble, 
    showTypingIndicator, 
    removeTypingIndicator, 
    scrollToBottom 
} from './chat-renderer.js';

// [CẤU HÌNH MẬT KHẨU & BẢO MẬT]
const LOCKED_MODE_HASH = "114870508"; // Pass cho Bé Đảm Đang
const ISEKAI_MODE_HASH = "-812629930"; // Pass cho Isekai (Reset Bé Cưng)
const MAX_PASSWORD_ATTEMPTS = 5;
const PASSWORD_LOCKOUT_TIME = 60; 

// Hàm băm mật khẩu
function hashPassword(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0; 
    }
    return hash.toString();
}
window.hashPassword = hashPassword;

let currentReplyContext = null;
let passwordAttempts = 0;
let passwordLockoutUntil = 0; 
let passwordLockoutTimer = null;

export async function initChat() {
    const chatInputWrapper = document.querySelector(".chat-input-wrapper"); 
    const chatInput = document.getElementById("chatInput");
    const chatHistory = document.getElementById("chat-history");
    const chatResetBtn = document.getElementById("chatResetBtn");
    const chatSendBtn = document.getElementById("chatSendBtn");
    const attachBtn = document.getElementById("attachBtn"); 
    const previewContainer = document.getElementById("attachmentPreviewContainer");
    const attachmentContent = document.getElementById("attachmentContent");

    const toneTriggerBtn = document.getElementById("toneTriggerBtn");
    const toneMenu = document.getElementById("toneMenu");
    const currentToneLabel = document.getElementById("currentToneLabel");

    // --- TẠO UI REPLY PREVIEW ---
    if (chatInputWrapper && !chatInputWrapper.querySelector('#replyPreviewContainer')) {
        const replyDiv = document.createElement('div');
        replyDiv.id = 'replyPreviewContainer';
        replyDiv.innerHTML = `
            <div class="reply-content">
                <span class="reply-label">Trả lời:</span>
                <span id="replyTextContent">...</span>
            </div>
            <button class="reply-close-btn" id="closeReplyBtn">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        `;
        chatInputWrapper.prepend(replyDiv);

        replyDiv.querySelector('#closeReplyBtn').addEventListener('click', () => {
            replyDiv.classList.remove('show');
            replyDiv.style.display = 'none';
            currentReplyContext = null; 
        });
    }
    const replyPreviewContainer = document.getElementById('replyPreviewContainer');
    const replyTextContent = document.getElementById('replyTextContent');

    // --- TẠO UI BLOCK ---
    if (chatInputWrapper && !chatInputWrapper.querySelector('.blocked-message-container')) {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'blocked-message-container';
        blockDiv.style.display = 'none'; 
        blockDiv.innerHTML = `
            <div class="blocked-info">
                <svg class="blocked-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                <span>Không thể liên lạc với người dùng này</span>
            </div>
            <div class="blocked-link" id="btnShowBlockDetail">Tìm hiểu thêm</div>
        `;
        chatInputWrapper.prepend(blockDiv);

        const overlay = document.createElement('div');
        overlay.id = 'blockOverlay';
        document.querySelector('#chat-content').appendChild(overlay);

        const modal = document.createElement('div');
        modal.id = 'blockDetailModal';
        modal.innerHTML = `
            <div class="gif-heart-wrapper">
                <img src="avatar/gif_1764185543.gif" class="block-detail-icon" alt="Blocked Icon">
                <div class="heart-container">
                    <button id="btnHeartUnblock" class="btn-heart-unblock" title="Dỗ bé cưng đi...">
                        <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 768 663">
                            <defs>
                                <linearGradient id="heartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stop-color="#ff9a9e" />
                                    <stop offset="100%" stop-color="#ffffff" />
                                </linearGradient>
                            </defs>
                            <path fill="url(#heartGradient)" d="M582 30c166 0 221 192 163 297c-89 163-361 336-361 336S111 490 23 327C-35 222 19 30 186 30c154 0 193 133 198 153c5-20 44-153 198-153z"/>
                        </svg>
                    </button>
                    <div id="minusTimeText" class="floating-minus-time">-30s</div>
                </div>
            </div>
            <div class="block-detail-text">
                Bạn đã bị chặn do ngôn từ không phù hợp khiến bé cưng giận. <br>
                Chat sẽ được mở sau <span id="blockCountdown" class="block-countdown">--:--</span>
            </div>
            <button class="btn-agree" id="btnCloseBlockModal">Tôi dong tinh</button>
        `;
        document.querySelector('#chat-content').appendChild(modal);

        let heartClickCount = 0;
        let heartResetTimer = null;
        const btnHeart = modal.querySelector('#btnHeartUnblock');
        const minusText = modal.querySelector('#minusTimeText');

        btnHeart.addEventListener('click', async (e) => {
            const svg = btnHeart.querySelector('svg');
            svg.style.transform = "scale(0.9)";
            setTimeout(() => svg.style.transform = "scale(1)", 100);
            heartClickCount++;
            if (heartResetTimer) clearTimeout(heartResetTimer);
            heartResetTimer = setTimeout(() => { heartClickCount = 0; }, 1000);

            if (heartClickCount >= 10) {
                heartClickCount = 0; 
                minusText.classList.add('show');
                setTimeout(() => { minusText.classList.remove('show'); }, 500);
                const data = await chrome.storage.local.get(['beCungBlockState']);
                if (data.beCungBlockState && data.beCungBlockState.blockedUntil) {
                    let newBlockedUntil = data.beCungBlockState.blockedUntil - 30000; 
                    if (newBlockedUntil <= Date.now()) {
                        unblockUI();
                        chrome.storage.local.remove(['beCungBlockState']);
                    } else {
                        await chrome.storage.local.set({ beCungBlockState: { blockedUntil: newBlockedUntil } });
                        blockUI(newBlockedUntil);
                    }
                }
            }
        });

        blockDiv.querySelector('#btnShowBlockDetail').addEventListener('click', (e) => {
            e.stopPropagation(); overlay.classList.add('active'); modal.classList.add('active');
        });
        modal.querySelector('#btnCloseBlockModal').addEventListener('click', () => {
            overlay.classList.remove('active'); modal.classList.remove('active');
        });
        overlay.addEventListener('click', () => {
            overlay.classList.remove('active'); modal.classList.remove('active');
        });
    }
    const blockCountdown = document.getElementById('blockCountdown');
    const blockedMessageContainer = chatInputWrapper.querySelector('.blocked-message-container');

    // --- KHỞI TẠO ---
    initChatRenderer(chatHistory);
    window.chatScrollToBottom = scrollToBottom; 
    loadMediaState();
    
    let allChatData = { "dan_chuyen": [], "lao_vo_cung": [], "be_cung": [], "mot_con_meo": [] };
    let currentTone = "dan_chuyen"; 
    let currentAttachment = null; 
    let currentWeatherContext = "";
    let activeRequestCount = 0; 
    let blockCheckInterval = null; 

    const DEFAULT_GREETINGS = {
        "dan_chuyen": "Chào bạn! Tôi là trợ lý AI chuyên nghiệp. Tôi có thể giúp gì cho bạn hôm nay?",
        "lao_vo_cung": "Mày nhìn cái chó gì? Có việc gì thì sủa lẹ lên, bố mày đang bận. 😒",
        "be_cung": "Anh yêu ơi! 😍 Em nhớ anh quá à. Nay anh có chuyện gì vui kể em nghe đi :3",
        "mot_con_meo": "Thằng kia! 😾 Khui pate chưa mà dám gọi trẫm? Có việc gì tâu mau!",
        "be_dam_dang": "Dạ... em chào anh ạ 😳. Anh đi làm về có mệt hông...? 👉👈"
    };

    function getGreeting(tone) {
        if (DEFAULT_GREETINGS[tone]) return DEFAULT_GREETINGS[tone];
        const agent = customAgents.find(a => a.id === tone);
        if (agent) {
            if (agent.generatedGreeting && agent.generatedGreeting.trim() !== "") return agent.generatedGreeting;
            if (agent.dialogue) {
                const lines = agent.dialogue.split('\n');
                const agentLine = lines.find(l => l.toLowerCase().startsWith('agent:') || l.toLowerCase().startsWith('ai:'));
                if (agentLine) return agentLine.replace(/^(Agent:|AI:)\s*/i, '').trim();
            }
            return `Chào ${agent.userPronoun || 'bạn'}, mình là ${agent.name}.`;
        }
        return "Xin chào!";
    }

    // --- LOGIC LOCKOUT CHUNG (Dùng cho cả Bé Đảm Đang và Isekai) ---
    function checkLockout(normalState, lockoutState, countdownEl, statusMsg, input) {
        const now = Date.now();
        if (now < passwordLockoutUntil) {
            normalState.style.display = 'none';
            lockoutState.style.display = 'block';
            
            if (passwordLockoutTimer) clearInterval(passwordLockoutTimer);
            
            const updateCountdown = () => {
                const remainingSeconds = Math.ceil((passwordLockoutUntil - Date.now()) / 1000);
                if (remainingSeconds <= 0) {
                    clearInterval(passwordLockoutTimer);
                    passwordAttempts = 0;
                    passwordLockoutUntil = 0;
                    normalState.style.display = 'block';
                    lockoutState.style.display = 'none';
                    statusMsg.textContent = "Vui lòng nhập mật khẩu:";
                    statusMsg.style.color = "#666";
                    statusMsg.style.fontStyle = "normal";
                    input.value = "";
                    input.focus();
                } else {
                    countdownEl.textContent = `${remainingSeconds}s`;
                }
            };
            
            updateCountdown();
            passwordLockoutTimer = setInterval(updateCountdown, 1000);
            return true;
        }
        return false;
    }

    // --- MODAL CHUYỂN MODE BÉ ĐẢM ĐANG ---
    function createPasswordModal(onSuccess) {
        const oldModal = document.getElementById('password-modal-overlay');
        if(oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'password-modal-overlay';
        modal.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 2000; animation: fadeIn 0.2s;`;
        
        modal.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 16px; width: 250px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <div style="margin-bottom: 10px;"><img src="avatar/gif_1764367124.gif" alt="Secret Lock" style="width: 50px; height: 50px; object-fit: contain;"></div>
                <h3 style="margin: 0 0 10px 0; color: #333; font-size: 16px;">Khu vực bí mật</h3>
                <div id="passwordNormalState">
                    <p id="passwordStatusMsg" style="font-size: 12px; color: #666; margin-bottom: 15px;">Vui lòng nhập mật khẩu:</p>
                    <input type="password" id="modePasswordInput" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 15px; outline: none; font-size: 13px; text-align: center;">
                    <div style="display: flex; gap: 10px;">
                        <button id="cancelPassBtn" style="flex: 1; padding: 8px; border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; color: #666;">Thôi</button>
                        <button id="confirmPassBtn" style="flex: 1; padding: 8px; border: none; background: #ff6b6b; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">Mở khóa</button>
                    </div>
                </div>
                <div id="passwordLockoutState" style="display: none;">
                    <p style="font-size: 13px; color: #ef4444; font-weight: bold; margin-bottom: 10px;">Bạn nhập sai quá nhiều lần!</p>
                    <p style="font-size: 12px; color: #666;">Vui lòng thử lại sau: <br><span id="passwordCountdown" style="font-size: 20px; font-weight: bold; color: #333;">60s</span></p>
                    <button id="closeLockoutBtn" style="margin-top: 15px; width: 100%; padding: 8px; border: 1px solid #ddd; background: #f5f5f5; border-radius: 8px; cursor: pointer; font-size: 12px;">Tôi dong tinh</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setupPasswordLogic(modal, onSuccess, LOCKED_MODE_HASH); // Sử dụng pass của Bé Đảm Đang
    }

    // --- [MỚI] MODAL ISEKAI (RESET CHAT BÉ CƯNG) ---
    function showIsekaiModal(onSuccess) {
        const oldModal = document.getElementById('password-modal-overlay');
        if(oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'password-modal-overlay'; // Tái sử dụng ID để style giống nhau
        modal.style.cssText = `position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 2000; animation: fadeIn 0.2s;`;
        
        modal.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 16px; width: 280px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 2px solid #ff6b6b;">
                <!-- ĐÃ ĐỔI GIF MỚI -->
                <div style="margin-bottom: 15px;"><img src="avatar/gif_1764445763.gif" alt="Yandere Lock" style="width: 60px; height: 60px; object-fit: contain;"></div>
                <p style="font-size: 13px; color: #333; margin-bottom: 5px; font-weight: 600;">Bạn không nên nói chuyện với cô gái khác.</p>
                <p style="font-size: 12px; color: #666; margin-bottom: 15px; font-style: italic;">Hãy có trách nhiệm với bạn gái hiện tại của mình!</p>
                
                <div id="passwordNormalState">
                    <p id="passwordStatusMsg" style="font-size: 12px; color: #ff6b6b; margin-bottom: 10px; font-weight: bold;">Nhập mật khẩu để Isekai sang thế giới khác:</p>
                    <input type="password" id="modePasswordInput" style="width: 100%; padding: 10px; border: 1px solid #ff6b6b; border-radius: 8px; margin-bottom: 15px; outline: none; font-size: 14px; text-align: center; color: #dc2626;">
                    <div style="display: flex; gap: 10px;">
                        <button id="cancelPassBtn" style="flex: 1; padding: 10px; border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; color: #666;">Thôi</button>
                        <button id="confirmPassBtn" style="flex: 1; padding: 10px; border: none; background: #dc2626; color: white; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px; box-shadow: 0 4px 10px rgba(220, 38, 38, 0.3);">Tôi dong tinh</button>
                    </div>
                </div>

                <div id="passwordLockoutState" style="display: none;">
                    <p style="font-size: 13px; color: #ef4444; font-weight: bold; margin-bottom: 10px;">Bạn nhập sai quá nhiều lần!</p>
                    <p style="font-size: 12px; color: #666;">Vui lòng thử lại sau: <br><span id="passwordCountdown" style="font-size: 20px; font-weight: bold; color: #333;">60s</span></p>
                    <button id="closeLockoutBtn" style="margin-top: 15px; width: 100%; padding: 8px; border: 1px solid #ddd; background: #f5f5f5; border-radius: 8px; cursor: pointer; font-size: 12px;">Tôi dong tinh</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setupPasswordLogic(modal, onSuccess, ISEKAI_MODE_HASH); // Sử dụng pass riêng cho Isekai
    }

    // --- LOGIC XỬ LÝ MẬT KHẨU CHUNG (ĐÃ NÂNG CẤP) ---
    function setupPasswordLogic(modal, onSuccess, targetHash = LOCKED_MODE_HASH) {
        const normalState = modal.querySelector('#passwordNormalState');
        const lockoutState = modal.querySelector('#passwordLockoutState');
        const statusMsg = modal.querySelector('#passwordStatusMsg');
        const input = modal.querySelector('#modePasswordInput');
        const btnConfirm = modal.querySelector('#confirmPassBtn');
        const btnCancel = modal.querySelector('#cancelPassBtn');
        const countdownEl = modal.querySelector('#passwordCountdown');
        const btnCloseLockout = modal.querySelector('#closeLockoutBtn');

        if (!checkLockout(normalState, lockoutState, countdownEl, statusMsg, input)) {
            input.focus();
        }

        const checkPass = () => {
            if (checkLockout(normalState, lockoutState, countdownEl, statusMsg, input)) return;

            const hashedInput = hashPassword(input.value);
            // So sánh với targetHash (pass được truyền vào)
            if(hashedInput === targetHash) {
                modal.remove();
                passwordAttempts = 0;
                onSuccess(); 
            } else {
                passwordAttempts++;
                const remaining = MAX_PASSWORD_ATTEMPTS - passwordAttempts;
                input.style.borderColor = 'red';
                input.classList.add('shake-animation');
                setTimeout(() => input.classList.remove('shake-animation'), 400);
                input.value = '';
                
                if (remaining > 0) {
                    statusMsg.textContent = `Bạn còn ${remaining} lần thử`;
                    statusMsg.style.color = "#ef4444"; 
                    statusMsg.style.fontStyle = "italic";
                } else {
                    passwordLockoutUntil = Date.now() + (PASSWORD_LOCKOUT_TIME * 1000);
                    checkLockout(normalState, lockoutState, countdownEl, statusMsg, input);
                }
            }
        };

        btnConfirm.onclick = checkPass;
        btnCancel.onclick = () => {
            if (passwordLockoutTimer) clearInterval(passwordLockoutTimer);
            modal.remove();
        };
        btnCloseLockout.onclick = () => {
            if (passwordLockoutTimer) clearInterval(passwordLockoutTimer);
            modal.remove();
        }
        input.onkeydown = (e) => { if(e.key === 'Enter') checkPass(); };
    }

    // --- HÀM RENDER MENU CHUẨN ---
    function renderToneMenu(agents) {
        if (!toneMenu) return;
        toneMenu.innerHTML = '';
        const defaults = [
            { id: 'dan_chuyen', name: 'Dân chuyên' },
            { id: 'lao_vo_cung', name: 'Láo vô cùng' },
            { id: 'be_cung', name: 'Bé cưng' },
            { id: 'mot_con_meo', name: 'Một con mèo' },
            { id: 'be_dam_dang', name: 'Bé đảm đang 🔒' } 
        ];
        
        defaults.forEach(def => {
            const div = document.createElement('div');
            div.className = 'tone-option'; div.dataset.value = def.id; div.textContent = def.name;
            if (def.id === 'be_dam_dang') div.style.color = '#ff6b6b'; 
            toneMenu.appendChild(div);
        });

        if (agents.length > 0) {
            const separator = document.createElement('div');
            separator.style.height = '1px'; separator.style.backgroundColor = 'rgba(0,0,0,0.1)'; separator.style.margin = '4px 0';
            toneMenu.appendChild(separator);
            agents.forEach(agent => {
                const div = document.createElement('div');
                div.className = 'tone-option'; div.dataset.value = agent.id;
                div.innerHTML = `<span>${escapeHTML(agent.name)}</span> <span style="font-size:10px; opacity:0.6">✨</span>`;
                toneMenu.appendChild(div);
            });
        }

        toneMenu.querySelectorAll('.tone-option').forEach(opt => {
            opt.addEventListener("click", (e) => {
                e.stopPropagation();
                const newTone = opt.dataset.value;
                
                if (newTone === currentTone) {
                    toneMenu.classList.remove("show");
                    return;
                }

                if (newTone === 'be_dam_dang') {
                    toneMenu.classList.remove("show");
                    createPasswordModal(() => {
                        changeToneLogic(newTone, opt);
                    });
                } else {
                    toneMenu.classList.remove("show");
                    changeToneLogic(newTone, opt);
                }
            });
        });
    }

    function changeToneLogic(newTone, optElement) {
        document.querySelectorAll(".tone-option").forEach(o => o.classList.remove("selected"));
        if(optElement) optElement.classList.add("selected");
        
        if (currentToneLabel) {
            let name = newTone;
            if(optElement) name = optElement.textContent.replace('🔒', '').trim();
            else if (newTone === 'be_dam_dang') name = "Bé đảm đang";
            currentToneLabel.textContent = name;
        }

        chrome.storage.sync.set({ chatTone: newTone });
        switchChatMode(newTone);
    }

    let customAgents = [];
    try {
        const data = await chrome.storage.local.get(['customAgents']);
        customAgents = data.customAgents || [];
    } catch (e) { console.error("Lỗi load agent:", e); }

    renderToneMenu(customAgents);
    optimizeAvatars();

    async function checkBlockStatus() {
        if (currentTone !== 'be_cung') {
            unblockUI();
            return;
        }
        const data = await chrome.storage.local.get(['beCungBlockState']);
        const blockState = data.beCungBlockState; 
        if (blockState && blockState.blockedUntil && blockState.blockedUntil > Date.now()) {
            blockUI(blockState.blockedUntil);
        } else {
            unblockUI();
        }
    }

    function blockUI(blockedUntil) {
        if (!chatInputWrapper) return;
        chatInputWrapper.classList.add('blocked');
        if (blockedMessageContainer) blockedMessageContainer.style.display = 'flex';
        
        if (blockCheckInterval) clearInterval(blockCheckInterval);
        
        const updateTimer = () => {
            const now = Date.now();
            const remaining = blockedUntil - now;
            
            if (remaining <= 0) {
                unblockUI();
                chrome.storage.local.remove(['beCungBlockState']);
                return;
            }

            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
            if (blockCountdown) blockCountdown.textContent = `${minutes}p ${seconds}s`;
        };

        updateTimer(); 
        blockCheckInterval = setInterval(updateTimer, 1000);
    }

    function unblockUI() {
        if (!chatInputWrapper) return;
        chatInputWrapper.classList.remove('blocked');
        if (blockedMessageContainer) blockedMessageContainer.style.display = 'none';
        
        const overlay = document.getElementById('blockOverlay');
        const modal = document.getElementById('blockDetailModal');
        if (overlay) overlay.classList.remove('active');
        if (modal) modal.classList.remove('active');

        if (blockCheckInterval) {
            clearInterval(blockCheckInterval);
            blockCheckInterval = null;
        }
    }

    function analyzeImageIntent(text) { if (!text) return null; const lowerText = text.toLowerCase(); const negKeywords = ["không", "đừng", "chả", "chẳng", "khỏi", "thôi", "đéo", "éo"]; const actionKeywords = ["xem", "gửi", "coi"]; const hasAction = actionKeywords.some(kw => lowerText.includes(kw)); const hasNegation = negKeywords.some(kw => lowerText.includes(kw)); if (hasAction && hasNegation) return null; const contextRules = [{folder:'di_choi',keywords:["có đi đâu chơi không","đi chơi không","đi đâu chơi","đi đu đưa"]},{folder:'di_lam',keywords:["đang đi làm hả","có đi làm không","ở công ty","ở văn phòng"]},{folder:'o_nha',keywords:["em chưa ngủ hả","thức khuya","chuẩn bị ngủ","mới ngủ dậy","ở nhà"]},{folders:['di_lam','o_nha'],keywords:["đang làm gì đấy","đang làm gì đó","làm gì thế","đang làm chi"]}]; let allowedFolders = []; contextRules.forEach(rule => {if (rule.keywords.some(kw => lowerText.includes(kw))) {if (rule.folders) {allowedFolders.push(...rule.folders);} else {allowedFolders.push(rule.folder);}}}); if (allowedFolders.length > 0) {return [...new Set(allowedFolders)];} const genericKeywords = ["xem hình", "gửi ảnh", "xem ảnh", "gửi hình", "coi hình"]; if (genericKeywords.some(kw => lowerText.includes(kw))) {return ['di_choi', 'di_lam', 'o_nha'];} return null; }
    function analyzeAudioIntent(text) { if (!text) return null; const lowerText = text.toLowerCase(); const negKeywords = ["không", "đừng", "chả", "chẳng", "khỏi", "thôi", "im"]; if (negKeywords.some(kw => lowerText.includes(kw)) && ["hát", "nói", "voice", "nghe"].some(kw => lowerText.includes(kw))) {return null;} const audioRules = [{folder:'chuc_ngu_ngon',keywords:["chúc em ngủ ngon","khuya rồi","anh đi ngủ đây"]},{folder:'anh_iu_em_ko',keywords:["em yêu anh không","em có thương anh không","em ghét anh không","em gửi voice","muốn nghe giọng em"]},{folder:'an_gi_chua',keywords:["anh chưa ăn cơm","anh đói quá","anh chưa ăn gì"]},{folder:'gian_doi',keywords:["anh đang ngoài đường","anh chưa đi làm về","anh chưa về"]},{folder:'hoi_han',keywords:["mới đi làm về","đi làm về mệt"]},{folder:'sao_chua_ngu',keywords:["sao em chưa ngủ","em chưa ngủ à"]},{folder:'ui_thuong_the',keywords:["đi làm mệt quá","mới đi làm về"]},{folder:'chia_tay',keywords:["mình dừng lại","mình chia tay"]},{folder:'dan_do',keywords:["chuẩn bị đi làm","chuẩn bị ra ngoài"]},{folder:'em_nho_anh',keywords:["anh nhớ em quá à"]}]; let allowedFolders = []; audioRules.forEach(rule => {if (rule.keywords.some(kw => lowerText.includes(kw))) {allowedFolders.push(rule.folder);}}); if (allowedFolders.length > 0) {return [...new Set(allowedFolders)];} return null; }
    function getCurrentTime() {const now = new Date();const hours = now.getHours().toString().padStart(2, '0');const minutes = now.getMinutes().toString().padStart(2, '0');return `${hours}:${minutes}`;}

    function saveMessageReaction(msgIndex, emoji) {
        if (!allChatData[currentTone] || !allChatData[currentTone][msgIndex]) return;
        allChatData[currentTone][msgIndex].reaction = emoji;
        chrome.storage.local.set({ chatData: allChatData });
    }

    function handleReply(originalText) {
        if (!originalText) return;
        const words = originalText.trim().split(/\s+/);
        let previewText = words.slice(0, 6).join(" ");
        if (words.length > 6) previewText += "...";
        if (replyPreviewContainer && replyTextContent) {
            replyTextContent.textContent = previewText;
            replyPreviewContainer.style.display = 'flex'; 
            replyPreviewContainer.classList.add('show');
            if(chatInput) chatInput.focus();
        }
        currentReplyContext = originalText;
    }

    function renderChatHistory(messages) {
        if (!chatHistory) return;
        messages.forEach((msg, index) => {
            const roleClass = msg.role === "user" ? "user" : "bot";
            let contentText = "";
            if (msg.parts && Array.isArray(msg.parts)) {
                const textPart = msg.parts.find(p => p.text);
                if (textPart) {
                    let rawText = textPart.text;
                    rawText = rawText.split('\n\n[Hệ thống (Ẩn):')[0]; 
                    rawText = rawText.split('\n\n[SYSTEM_OVERRIDE:')[0]; 
                    rawText = rawText.replace(/\[\[BLOCK:\d+\]\]/g, "");
                    contentText = rawText.trim();
                }
            }
            const time = msg.timestamp || null;
            const reaction = msg.reaction || null; 
            const replyTo = msg.replyTo || null;
            const onReaction = (emoji) => saveMessageReaction(index, emoji);
            const onReply = () => handleReply(contentText);

            if (roleClass === 'user') {
                let text = contentText;
                let imgSrc = null; let fileInfo = null;
                if (msg.parts) {
                     const imgPart = msg.parts.find(p => p.inline_data);
                     if (imgPart) imgSrc = `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}`;
                }
                displayMessage(roleClass, text, imgSrc, fileInfo, false, time, currentTone, reaction, onReaction, onReply, replyTo);
            } else {
                if (contentText) renderMessageRow(roleClass, contentText, time, true, currentTone, reaction, onReaction, onReply, replyTo);
            }
        });
        scrollToBottom();
    }

    async function sendMessage() {
        if (chatInputWrapper.classList.contains('blocked')) return;
        const text = chatInput.value.trim();
        if (!text && !currentAttachment) return;
        const parts = [];
        let uiText = text;
        let uiImg = null;
        let uiFile = null;
        if (text) parts.push({ text: text });
        if (currentAttachment) {
            if (currentAttachment.type === 'image') {
                parts.push({ inline_data: { mime_type: currentAttachment.mime, data: currentAttachment.data } });
                uiImg = `data:${currentAttachment.mime};base64,${currentAttachment.data}`;
                if (!text) parts.push({ text: "Phân tích hình ảnh này." });
            } else if (currentAttachment.type === 'file') {
                const fileContext = `\n\n--- File Attached: ${currentAttachment.name} ---\n${currentAttachment.data}\n------------------\n`;
                if (parts.length > 0 && parts[0].text) parts[0].text += fileContext; else parts.push({ text: fileContext });
                uiFile = { name: currentAttachment.name };
            }
        }
        let systemContext = "";
        const timestamp = getCurrentTime();
        const newMsgIndex = (allChatData[currentTone] ? allChatData[currentTone].length : 0);
        const onReaction = (emoji) => saveMessageReaction(newMsgIndex, emoji);
        const onReply = () => handleReply(text);
        const replyTo = currentReplyContext;

        displayMessage("user", uiText, uiImg, uiFile, true, timestamp, currentTone, null, onReaction, onReply, replyTo);
        
        chatInput.value = ""; chatInput.style.height = '18px';
        currentAttachment = null; renderAttachmentPreview();
        
        if (replyPreviewContainer) {
            replyPreviewContainer.style.display = 'none';
            replyPreviewContainer.classList.remove('show');
        }
        currentReplyContext = null; 

        activeRequestCount++; 
        showTypingIndicator(currentTone);
        
        const userMsgObj = { 
            role: "user", 
            parts: parts, 
            timestamp: timestamp,
            replyTo: replyTo 
        }; 

        if (!allChatData[currentTone]) allChatData[currentTone] = [];
        allChatData[currentTone].push(userMsgObj);
        if (allChatData[currentTone].length > 50) allChatData[currentTone] = allChatData[currentTone].slice(-50);
        chrome.storage.local.set({ chatData: allChatData });
        const nowTime = new Date().getTime();
        const timeDiff = nowTime - mediaState.lastImageTime; 
        const isCooldownActive = timeDiff < COOLDOWN_TIME;
        const allowedImageContexts = analyzeImageIntent(text); 
        const allowedAudioContexts = analyzeAudioIntent(text); 
        const isAskingForImage = allowedImageContexts !== null;
        const isAskingForAudio = allowedAudioContexts !== null;
        let overrideInstruction = "";
        if (isAskingForAudio) {
            const contextStr = allowedAudioContexts.join(", ");
            overrideInstruction = `\n\n[SYSTEM_OVERRIDE: User request implies a VOICE/AUDIO response. Contexts detected: [${contextStr}]. You MUST send a suitable audio using syntax {{AUDIO:category_name}} (e.g., {{AUDIO:${allowedAudioContexts[0]}}}). Do NOT send text only.]`;
        } 
        else if (isAskingForImage && isCooldownActive) {
            const minutesLeft = Math.ceil((COOLDOWN_TIME - timeDiff) / 60000);
            overrideInstruction = `\n\n[SYSTEM_OVERRIDE: User asked for an image BUT cooldown is ACTIVE (wait ${minutesLeft} minutes). DO NOT send image. Politely refuse or make an excuse to wait.]`;
        } 
        else if (isAskingForImage && !isCooldownActive) {
            const contextStr = allowedImageContexts.join(", ");
            overrideInstruction = `\n\n[SYSTEM_OVERRIDE: User explicitly REQUESTED an image. Contexts allowed: [${contextStr}]. You MUST send a suitable image from one of these folders using syntax {{IMG:folder_id}} (e.g., {{IMG:${allowedImageContexts[0]}_1}}). Do NOT send images from other folders.]`;
        }
        else {
            overrideInstruction = `\n\n[SYSTEM_OVERRIDE: User DID NOT ask for media. Reply with text normally.]`;
        }
        const historyForApi = JSON.parse(JSON.stringify(allChatData[currentTone]));
        
        const historyClean = historyForApi.map(msg => ({
            role: msg.role, 
            parts: msg.parts, 
            reaction: msg.reaction, 
            replyTo: msg.replyTo
        }));

        const lastMsg = historyClean[historyClean.length - 1];
        const now = new Date();
        const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        systemContext += `\n\n[Hệ thống (Ẩn): Hiện tại là ${timeString}, ${dateString}${currentWeatherContext}.]`;
        systemContext += overrideInstruction; 
        if (lastMsg.parts && lastMsg.parts.length > 0) {
            if (lastMsg.parts[0].text) lastMsg.parts[0].text += systemContext;
            else lastMsg.parts.push({ text: systemContext });
        } else { lastMsg.parts = [{ text: systemContext }]; }
        chrome.runtime.sendMessage({ action: "chat", history: historyClean, tone: currentTone });
    }

    async function handleIncomingMessage(request) {
        let messageToSave = request.message; 
        let textContent = messageToSave.parts && messageToSave.parts[0] ? messageToSave.parts[0].text : "";
        const blockMatch = textContent.match(/\[\[BLOCK:(\d+)\]\]/);
        if (blockMatch && currentTone === 'be_cung') {
            const minutes = parseInt(blockMatch[1]);
            const blockedUntil = Date.now() + (minutes * 60 * 1000);
            await chrome.storage.local.set({ beCungBlockState: { blockedUntil } });
            blockUI(blockedUntil);
            textContent = textContent.replace(blockMatch[0], "").trim();
            if (messageToSave.parts[0]) messageToSave.parts[0].text = textContent;
        }

        if (currentTone === 'be_dam_dang' && textContent.includes('{{DRIVE_IMG}}')) {
            textContent = textContent.replace('{{DRIVE_IMG}}', '').trim();
            const driveImage = await getRandomDriveImage();
            
            if (driveImage) {
                textContent += ` {{DRIVE_DIRECT:${driveImage.src}}}`;
                if (messageToSave.parts[0]) messageToSave.parts[0].text = textContent;
            } else {
                textContent += "\n(Hic... em tìm mãi không thấy tấm hình nào hết á...)";
                if (messageToSave.parts[0]) messageToSave.parts[0].text = textContent;
            }
        }

        if (currentTone === 'be_dam_dang' && textContent.includes('{{DRIVE_VIDEO}}')) {
            textContent = textContent.replace('{{DRIVE_VIDEO}}', '').trim();
            const videoObj = await getRandomDiscordVideo();
            
            if (videoObj) {
                const w = videoObj.width || 1920;
                const h = videoObj.height || 1080;
                textContent += ` {{VIDEO_DIRECT:${videoObj.src}|${w}|${h}}}`;
                
                if (messageToSave.parts[0]) messageToSave.parts[0].text = textContent;
            } else {
                textContent += "\n(Hic... em tìm mãi không thấy clip nào hết á...)";
                if (messageToSave.parts[0]) messageToSave.parts[0].text = textContent;
            }
        }

        const hasMedia = textContent.includes("{{IMG") || textContent.includes("{{AUDIO") || textContent.includes("{{DRIVE_DIRECT") || textContent.includes("{{VIDEO_DIRECT");
        const delayTime = hasMedia ? 3000 : 0; 
        if (hasMedia) showTypingIndicator(currentTone);
        
        const finalProcessing = () => {
            const timestamp = getCurrentTime();
            messageToSave.timestamp = timestamp;
            const newMsgIndex = (allChatData[currentTone] ? allChatData[currentTone].length : 0);
            const onReaction = (emoji) => saveMessageReaction(newMsgIndex, emoji);
            const onReply = () => handleReply(textContent);
            if (textContent) renderMessageRow("bot", textContent, timestamp, false, currentTone, null, onReaction, onReply, null);
            if (!allChatData[currentTone]) allChatData[currentTone] = [];
            allChatData[currentTone].push(messageToSave);
            if (allChatData[currentTone].length > 50) allChatData[currentTone] = allChatData[currentTone].slice(-50);
            chrome.storage.local.set({ chatData: allChatData });
            activeRequestCount--; 
            if (activeRequestCount <= 0) {
                activeRequestCount = 0; 
                removeTypingIndicator(); 
            }
        };
        if (delayTime > 0) setTimeout(finalProcessing, delayTime);
        else finalProcessing();
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.tone !== currentTone) return;
        if (request.action === "chat_incoming_message") handleIncomingMessage(request);
        if (request.action === "chat_typing") { if (request.isTyping) showTypingIndicator(currentTone); } 
        if (request.action === "chat_error") {
            activeRequestCount = 0; removeTypingIndicator(); 
            renderBubble("error", "❌ Lỗi: " + request.error, null, currentTone); 
            scrollToBottom();
        }
    });

    async function fetchWeatherContext() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`);
                const data = await response.json();
                if (data.current) {
                    const temp = data.current.temperature_2m;
                    const isDay = data.current.is_day ? "Ban ngày" : "Ban đêm";
                    const code = data.current.weather_code;
                    let weatherDesc = "Bình thường";
                    if (code === 0) weatherDesc = "Trời quang đãng";
                    else if (code >= 95) weatherDesc = "Giông bão";
                    currentWeatherContext = `, Thời tiết: ${temp}°C (${weatherDesc}), ${isDay}`;
                }
            } catch (e) { console.log("Weather error:", e); }
        }, (err) => console.log("Loc error:", err));
    }
    fetchWeatherContext();

    chrome.storage.sync.get(["chatTone"], (data) => {
        if (data.chatTone) {
            currentTone = data.chatTone;
            updateToneUI(currentTone);
        } else { 
            updateToneUI("dan_chuyen"); 
        }
        loadChatData();
    });

    function loadChatData() {
        chrome.storage.local.get(["chatData", "chatMessages"], (result) => {
            if (result.chatData) { allChatData = { ...allChatData, ...result.chatData }; } 
            else if (result.chatMessages && result.chatMessages.length > 0) {
                allChatData[currentTone] = result.chatMessages;
                chrome.storage.local.set({ chatData: allChatData });
                chrome.storage.local.remove("chatMessages");
            }
            switchChatMode(currentTone);
        });
    }

    function switchChatMode(tone) {
        currentTone = tone;
        checkBlockStatus(); 
        if (!allChatData[tone]) allChatData[tone] = [];
        const history = allChatData[tone];
        chatHistory.innerHTML = ''; 
        if (history.length === 0) {
            const greeting = getGreeting(tone);
            const timestamp = getCurrentTime();
            const botMsgObj = { role: "model", parts: [{ text: greeting }], timestamp: timestamp };
            
            const onReaction = (emoji) => saveMessageReaction(0, emoji);
            const onReply = () => handleReply(greeting);
            
            renderMessageRow("bot", greeting, timestamp, false, currentTone, null, onReaction, onReply, null); 
            
            allChatData[tone].push(botMsgObj);
            chrome.storage.local.set({ chatData: allChatData });
        } else { 
            renderChatHistory(history); 
        }
    }

    function updateToneUI(value) {
        const options = document.querySelectorAll(".tone-option");
        options.forEach(opt => {
            if (opt.dataset.value === value) {
                opt.classList.add("selected");
                if (currentToneLabel) {
                    const clone = opt.cloneNode(true);
                    const icon = clone.querySelector('span[style*="opacity"]');
                    if (icon) icon.remove();
                    currentToneLabel.textContent = clone.textContent.replace('🔒', '').trim();
                }
            } else { opt.classList.remove("selected"); }
        });
    }

    if (toneTriggerBtn) {
        toneTriggerBtn.addEventListener("click", (e) => { e.stopPropagation(); toneMenu.classList.toggle("show"); });
    }

    document.addEventListener("click", (e) => {
        if (toneMenu && toneMenu.classList.contains("show")) {
            if (!toneMenu.contains(e.target) && e.target !== toneTriggerBtn) { toneMenu.classList.remove("show"); }
        }
    });

    if (chatSendBtn) chatSendBtn.addEventListener("click", sendMessage);
    if (chatInput) {
        chatInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; if (this.value === '') this.style.height = '18px'; });
        chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
        chatInput.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let i = 0; i < items.length; i++) { if (items[i].type.indexOf("image") === 0) { e.preventDefault(); const blob = items[i].getAsFile(); handleFileSelect(blob); return; } }
        });
    }
    
    // --- [HÀM RESET CHAT (TÁCH BIỆT)] ---
    function performReset() {
        allChatData[currentTone] = [];
        resetMediaState();
        chrome.storage.local.set({ chatData: allChatData });
        chatHistory.innerHTML = '';
        const greeting = getGreeting(currentTone);
        const timestamp = getCurrentTime();
        
        const onReaction = (emoji) => saveMessageReaction(0, emoji);
        const onReply = () => handleReply(greeting);

        renderMessageRow("bot", greeting, timestamp, false, currentTone, null, onReaction, onReply, null);
        
        if (!allChatData[currentTone]) allChatData[currentTone] = [];
        allChatData[currentTone].push({ role: "model", parts: [{ text: greeting }], timestamp: timestamp });
        chrome.storage.local.set({ chatData: allChatData });
        currentAttachment = null; renderAttachmentPreview();
    }

    // --- [XỬ LÝ NÚT RESET VỚI LOGIC BÉ CƯNG] ---
    if (chatResetBtn) {
        chatResetBtn.addEventListener("click", () => {
            if (currentTone === 'be_cung') {
                showIsekaiModal(() => {
                    performReset();
                });
            } else {
                performReset();
            }
        });
    }

    if (attachBtn) {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*, .txt,.js,.html,.css,.json,.py,.java,.cpp,.c,.h,.md"; 
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);
        attachBtn.addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
        fileInput.addEventListener("change", (e) => { handleFileSelect(e.target.files[0]); fileInput.value = ''; });
    }

    function renderAttachmentPreview() {
        attachmentContent.innerHTML = "";
        if (!currentAttachment) { previewContainer.style.display = "none"; return; }
        previewContainer.style.display = "block";
        const removeBtn = document.createElement("button");
        removeBtn.className = "preview-remove-btn";
        removeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
        removeBtn.onclick = () => { currentAttachment = null; renderAttachmentPreview(); };
        if (currentAttachment.type === 'image') {
            const img = document.createElement("img");
            img.src = `data:${currentAttachment.mime};base64,${currentAttachment.data}`;
            img.className = "preview-img-thumb";
            attachmentContent.appendChild(img);
            attachmentContent.appendChild(removeBtn);
        } else if (currentAttachment.type === 'file') {
            const fileCard = document.createElement("div");
            fileCard.className = "preview-file-card";
            fileCard.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg><span class="preview-file-name">${escapeHTML(currentAttachment.name)}</span>`;
            attachmentContent.appendChild(fileCard);
            attachmentContent.appendChild(removeBtn);
        }
        chatInput.focus();
    }

    function handleFileSelect(file) {
        if (!file) return;
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (e) => { currentAttachment = { type: 'image', data: e.target.result.split(',')[1], mime: file.type }; renderAttachmentPreview(); };
            reader.readAsDataURL(file);
        } else {
            const reader = new FileReader();
            reader.onload = (event) => { currentAttachment = { type: 'file', data: event.target.result, name: file.name, mime: "text/plain" }; renderAttachmentPreview(); };
            reader.readAsText(file);
        }
    }
}