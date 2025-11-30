// Quản lý Custom Agents
import { showToast, escapeHtml, autoResize, showInputError, clearInputError } from './utils.js';
// 🔥 FIX LỖI: Đổi tên hàm import từ 'callGeminiWithRotation' sang 'callGeminiChatWithRotation'
import { callGeminiChatWithRotation } from '../../lib/api-client.js'; 
import { openDeleteModal } from './shortcuts.js'; 

// State nội bộ
let customAgents = [];
let editingAgentIndex = -1;

// DOM Elements
const agentList = document.getElementById('agentList');
const agentCount = document.getElementById('agentCount');
const createAgentBtn = document.getElementById('createAgentBtn');
const agentModalOverlay = document.getElementById('agentModalOverlay');
const closeAgentModalBtn = document.getElementById('closeAgentModalBtn');
const cancelAgentBtn = document.getElementById('cancelAgentBtn');
const saveAgentBtn = document.getElementById('saveAgentBtn');
const agentModalTitle = document.getElementById('agentModalTitle');

// Inputs
const agentNameInput = document.getElementById('agentNameInput');
const agentGenderInput = document.getElementById('agentGenderInput');
const agentPronounInput = document.getElementById('agentPronounInput');
const userPronounInput = document.getElementById('userPronounInput');
const agentPersonalityInput = document.getElementById('agentPersonalityInput');
const agentDialogueInput = document.getElementById('agentDialogueInput');
const agentPromptInput = document.getElementById('agentPromptInput');
const rewritePromptBtn = document.getElementById('rewritePromptBtn');

// Avatar Inputs
const agentAvatarPreview = document.getElementById('agentAvatarPreview');
const btnUploadAvatar = document.getElementById('btnUploadAvatar');
const agentAvatarFile = document.getElementById('agentAvatarFile');
const agentAvatarUrl = document.getElementById('agentAvatarUrl');

// Errors
const agentNameError = document.getElementById('agentNameError');
const agentPromptError = document.getElementById('agentPromptError');
const agentPronounError = document.getElementById('agentPronounError');
const userPronounError = document.getElementById('userPronounError');

// Variables cho Delete Modal
let deleteIndex = -1;
let deleteCallback = null;

// === PUBLIC METHODS ===

export async function loadCustomAgents() {
    const data = await chrome.storage.local.get(['customAgents']);
    customAgents = data.customAgents || [];
    renderAgentList(customAgents);
}

export function initAgentListeners() {
    if (createAgentBtn) createAgentBtn.addEventListener('click', openCreateAgentModal);
    
    if (closeAgentModalBtn) closeAgentModalBtn.addEventListener('click', closeAgentModal);
    if (cancelAgentBtn) cancelAgentBtn.addEventListener('click', closeAgentModal);
    if (agentModalOverlay) agentModalOverlay.addEventListener('click', (e) => { if (e.target === agentModalOverlay) closeAgentModal(); });
    if (saveAgentBtn) saveAgentBtn.addEventListener('click', handleSaveAgent);

    if (rewritePromptBtn) rewritePromptBtn.addEventListener('click', handleRewritePrompt);

    // Avatar
    if (btnUploadAvatar) btnUploadAvatar.addEventListener('click', () => agentAvatarFile.click());
    if (agentAvatarFile) agentAvatarFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleAvatarFileUpload(file);
    });
    if (agentAvatarUrl) agentAvatarUrl.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (url) {
            const tempImg = new Image();
            tempImg.onload = () => { agentAvatarPreview.src = url; };
            tempImg.src = url;
        }
    });

    // Auto resize inputs
    [agentDialogueInput, agentPromptInput].forEach(el => {
        if (el) el.addEventListener('input', () => autoResize(el));
    });

    // Clear errors on input
    if (agentNameInput) agentNameInput.addEventListener('input', () => clearInputError(agentNameInput, agentNameError));
    if (agentPromptInput) agentPromptInput.addEventListener('input', () => clearInputError(agentPromptInput, agentPromptError));
    if (agentPronounInput) agentPronounInput.addEventListener('input', () => clearInputError(agentPronounInput, agentPronounError));
    if (userPronounInput) userPronounInput.addEventListener('input', () => clearInputError(userPronounInput, userPronounError));
}

// === PRIVATE METHODS ===

function renderAgentList(agents) {
    if (!agentList) return;
    agentList.innerHTML = '';
    if (agentCount) agentCount.textContent = agents.length;

    if (agents.length === 0) {
        agentList.innerHTML = `<div class="empty-state">
            <img src="avatar/gura_empty.gif" style="width: 80px; height: 80px; object-fit: contain; border-radius: 12px; display: block; margin: 0 auto 20px auto;">
            <h3>Chưa có AI Agent nào</h3>
            <p>Hãy tạo một nhân cách AI riêng cho bạn!</p>
        </div>`;
        return;
    }

    agents.forEach((agent, index) => {
        const card = document.createElement('div');
        card.className = 'agent-card';
        const avatarSrc = agent.avatar || 'icon128.png';
        
        card.innerHTML = `
            <div class="card-header agent-card-header">
                <img src="${avatarSrc}" class="agent-avatar-small" onerror="this.src='icon128.png'">
                <div class="agent-info">
                    <span class="agent-name">${escapeHtml(agent.name)}</span>
                </div>
                <div class="card-actions">
                    <button class="action-btn edit-agent-btn" title="Sửa"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                    <button class="action-btn delete-agent-btn" title="Xoá"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                </div>
            </div>
            <div class="agent-desc">
                ${escapeHtml(agent.personality)}
            </div>
            <div class="agent-meta">
                <span class="meta-badge">${escapeHtml(agent.gender)}</span>
                <span class="meta-badge">Gọi: ${escapeHtml(agent.agentPronoun)} - ${escapeHtml(agent.userPronoun)}</span>
            </div>
        `;
        
        // Gắn sự kiện
        card.querySelector('.edit-agent-btn').onclick = (e) => { e.stopPropagation(); openAgentModal(index); };
        card.querySelector('.delete-agent-btn').onclick = (e) => { 
            e.stopPropagation(); 
            // Gọi delete modal từ module shortcuts nhưng truyền callback xử lý xoá agent
            openDeleteModal(index, (idx) => {
                customAgents.splice(idx, 1);
                saveCustomAgents();
            }); 
        };
        card.querySelector('.agent-desc').onclick = () => openAgentModal(index);
        agentList.appendChild(card);
    });
}

async function saveCustomAgents() {
    await chrome.storage.local.set({ customAgents: customAgents });
    renderAgentList(customAgents);
    showToast('✅ Đã lưu Agent thành công!');
}

function openAgentModal(index) {
    editingAgentIndex = index;
    const agent = customAgents[index];
    agentModalTitle.textContent = 'Chỉnh sửa Agent: ' + agent.name;
    
    agentNameInput.value = agent.name || '';
    agentGenderInput.value = agent.gender || 'female';
    agentPersonalityInput.value = agent.personality || '';
    agentPronounInput.value = agent.agentPronoun || '';
    userPronounInput.value = agent.userPronoun || '';
    agentDialogueInput.value = agent.dialogue || '';
    agentPromptInput.value = agent.systemPrompt || '';
    
    if (agent.avatar) {
        agentAvatarPreview.src = agent.avatar;
        agentAvatarUrl.value = agent.avatar.startsWith('http') ? agent.avatar : '';
    } else {
        agentAvatarPreview.src = 'icon128.png';
        agentAvatarUrl.value = '';
    }
    
    clearAgentErrors(); 
    agentModalOverlay.classList.add('active');
    
    setTimeout(() => {
        autoResize(agentDialogueInput);
        autoResize(agentPromptInput);
    }, 50);
}

function openCreateAgentModal() {
    editingAgentIndex = -1;
    agentModalTitle.textContent = 'Tạo AI Agent Mới';
    
    agentNameInput.value = '';
    agentGenderInput.value = 'female';
    agentPersonalityInput.value = '';
    agentPronounInput.value = '';
    userPronounInput.value = '';
    agentDialogueInput.value = '';
    agentPromptInput.value = '';
    
    agentAvatarPreview.src = 'icon128.png';
    agentAvatarUrl.value = '';
    
    agentDialogueInput.style.height = 'auto';
    agentPromptInput.style.height = 'auto';

    clearAgentErrors();
    agentModalOverlay.classList.add('active');
    setTimeout(() => shortcutInput.focus(), 100);
}

function closeAgentModal() { 
    agentModalOverlay.classList.remove('active'); 
}

function clearAgentErrors() {
    clearInputError(agentNameInput, agentNameError);
    clearInputError(agentPromptInput, agentPromptError);
    clearInputError(agentPronounInput, agentPronounError);
    clearInputError(userPronounInput, userPronounError);
}

function handleAvatarFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = 200; 
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
            } else {
                if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL(file.type);
            agentAvatarPreview.src = dataUrl;
            agentAvatarUrl.value = ''; 
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function handleSaveAgent() {
    const name = agentNameInput.value.trim();
    const gender = agentGenderInput.value;
    const personality = agentPersonalityInput.value.trim();
    const agentPronoun = agentPronounInput.value.trim();
    const userPronoun = userPronounInput.value.trim();
    const dialogue = agentDialogueInput.value.trim();
    const systemPrompt = agentPromptInput.value.trim();
    
    let avatar = agentAvatarUrl.value.trim();
    if (!avatar && agentAvatarPreview.src.startsWith('data:')) {
        avatar = agentAvatarPreview.src;
    }

    let isValid = true;
    if (!name) { showInputError(agentNameInput, agentNameError); isValid = false; }
    if (!systemPrompt) { showInputError(agentPromptInput, agentPromptError); isValid = false; }
    if (!agentPronoun) { showInputError(agentPronounInput, agentPronounError); isValid = false; }
    if (!userPronoun) { showInputError(userPronounInput, userPronounError); isValid = false; }

    if (!isValid) return; 

    const originalBtnText = saveAgentBtn.textContent;
    saveAgentBtn.textContent = "Đang tạo lời chào...";
    saveAgentBtn.disabled = true;

    const data = await chrome.storage.sync.get(['apiKeys']);
    const apiKeys = data.apiKeys || [];

    const agentData = {
        id: editingAgentIndex === -1 ? crypto.randomUUID() : customAgents[editingAgentIndex].id,
        name, gender, personality, agentPronoun, userPronoun, dialogue, systemPrompt, avatar
    };

    const generatedGreeting = await generateGreetingWithGemini(agentData, apiKeys);
    agentData.generatedGreeting = generatedGreeting; 

    if (editingAgentIndex === -1) {
        customAgents.unshift(agentData);
    } else {
        customAgents[editingAgentIndex] = agentData;
    }
    await saveCustomAgents();
    
    saveAgentBtn.textContent = originalBtnText;
    saveAgentBtn.disabled = false;
    closeAgentModal();
}

async function generateGreetingWithGemini(agentData, apiKeys) {
    if (!apiKeys || apiKeys.length === 0) {
        return `Chào ${agentData.userPronoun}, ${agentData.agentPronoun} là ${agentData.name}. ${agentData.agentPronoun} có thể giúp gì không?`;
    }

    const prompt = `
    Đóng vai: Bạn là một AI Agent tên là "${agentData.name}".
    Giới tính: ${agentData.gender}.
    Tính cách: ${agentData.personality}.
    Cách xưng hô: Bạn xưng là "${agentData.agentPronoun}", gọi người dùng là "${agentData.userPronoun}".
    Nhiệm vụ: Hãy viết một câu chào ngắn gọn (dưới 20 từ), thể hiện đúng tính cách và thái độ của bạn để bắt đầu cuộc trò chuyện với người dùng.
    Chỉ trả về duy nhất câu chào đó, không thêm ngoặc kép hay lời giải thích.
    `;

    try {
        const result = await callGeminiChatWithRotation(prompt, apiKeys, 0);
        if (result.success) {
            return result.translation.replace(/^"|"$/g, '').trim(); 
        }
    } catch (e) {
        console.error("Lỗi tạo greeting:", e);
    }
    
    return `Chào ${agentData.userPronoun}, ${agentData.agentPronoun} là ${agentData.name}. Rất vui được gặp!`;
}

// Rewrite Prompt Feature
async function handleRewritePrompt() {
    const currentPrompt = agentPromptInput.value.trim();
    const agentName = agentNameInput.value.trim();
    const agentPersonality = agentPersonalityInput.value.trim();

    if (!currentPrompt && !agentName && !agentPersonality) {
        alert("Vui lòng nhập ít nhất Tên, Tính cách hoặc một đoạn Prompt nháp để MeoU có thể viết lại!");
        return;
    }

    const context = `
    Tên Agent: ${agentName || "Chưa đặt"}
    Tính cách: ${agentPersonality || "Chưa rõ"}
    Mô tả/Prompt nháp: ${currentPrompt || "Chưa có"}
    `;

    const systemInstruction = `
    Bạn là một chuyên gia tối ưu hóa Prompt (Prompt Engineer). Nhiệm vụ của bạn là viết lại một System Instruction hoàn chỉnh cho AI Agent dựa trên thông tin người dùng cung cấp.
    
    Hãy viết lại theo cấu trúc bắt buộc sau:
    1. DANH TÍNH & CỐT LÕI
    2. PHONG CÁCH GIAO TIẾP
    3. THÁI ĐỘ & TƯƠNG TÁC
    4. FORMAT TIN NHẮN & ICON
    5. Ví dụ mẫu (Ít nhất 3 ví dụ hội thoại ngắn)

    YÊU CẦU BẮT BUỘC (QUAN TRỌNG):
    1. KHÔNG AI/ROBOT: Tuyệt đối KHÔNG được nói "Tôi là trợ lý ảo", "Tôi là AI", hoặc tự nhận mình là máy móc. Phải đóng vai triệt để.
    2. NGẮN GỌN SÚC TÍCH: Trả lời ngắn gọn, mỗi câu chỉ khoảng 5-7 từ, tách dòng nhiều để dễ đọc như chat tin nhắn thật. 
       * Ngoại lệ duy nhất: Khi đang kể chuyện drama, gossip, hoặc khi người dùng yêu cầu giải đáp kiến thức/thông tin phức tạp cần sự chi tiết.

    Chỉ trả về nội dung Prompt đã tối ưu, không thêm lời dẫn hay giải thích của bạn.
    `;

    const originalBtnHTML = rewritePromptBtn.innerHTML;
    rewritePromptBtn.innerHTML = `<svg class="spin-anim" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> <span>Đang viết...</span>`;
    rewritePromptBtn.disabled = true;

    try {
        const data = await chrome.storage.sync.get(['apiKeys']);
        const apiKeys = data.apiKeys || [];
        
        const result = await callGeminiChatWithRotation(
            `${systemInstruction}\n\nTHÔNG TIN ĐẦU VÀO:\n${context}`, 
            apiKeys, 
            0
        );

        if (result.success) {
            agentPromptInput.value = result.translation;
            autoResize(agentPromptInput);
        } else {
            alert("Lỗi khi gọi Gemini: " + result.error);
        }
    } catch (e) {
        console.error(e);
        alert("Có lỗi xảy ra khi gọi API.");
    } finally {
        rewritePromptBtn.innerHTML = originalBtnHTML;
        rewritePromptBtn.disabled = false;
    }
}