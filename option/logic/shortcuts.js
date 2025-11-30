// Quản lý Magic Shortcuts
import { showToast, escapeHtml, stringToColor } from './utils.js';
import { openTagModal } from './tags.js';

// State nội bộ
let allTemplates = [];
let editingIndex = -1;

// DOM Elements
const templateList = document.getElementById('templateList');
const templateCount = document.getElementById('templateCount');
const createBtn = document.getElementById('createBtn');
const searchInput = document.getElementById('searchInput');

const modalOverlay = document.getElementById('modalOverlay');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
const shortcutInput = document.getElementById('shortcutInput');
const contentInput = document.getElementById('contentInput');
const modalTitle = document.getElementById('modalTitle');

const deleteModalOverlay = document.getElementById('deleteModalOverlay');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

// Variables cho Delete Modal
let deleteIndex = -1;
let deleteCallback = null;

// === PUBLIC METHODS ===

export async function loadTemplates() {
    const dataLocal = await chrome.storage.local.get(['magicTemplates', 'magicShortcuts']);
    const dataSync = await chrome.storage.sync.get(['magicTemplates']);
    allTemplates = dataLocal.magicTemplates || dataLocal.magicShortcuts || dataSync.magicTemplates || [];
    renderList(allTemplates);
}

export function getAllTemplates() {
    return allTemplates;
}

export function initShortcutListeners() {
    if (createBtn) createBtn.addEventListener('click', openCreateModal);
    if (searchInput) searchInput.addEventListener('input', (e) => filterTemplates(e.target.value));

    // Modal Events
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    if (saveTemplateBtn) saveTemplateBtn.addEventListener('click', handleSave);

    // Delete Modal Events
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDelete);
    if (deleteModalOverlay) deleteModalOverlay.addEventListener('click', (e) => { if (e.target === deleteModalOverlay) closeDeleteModal(); });
}

export function renderList(templates = allTemplates) {
    if (!templateList) return;
    templateList.innerHTML = '';
    if (templateCount) templateCount.textContent = templates.length;

    if (templates.length === 0) {
        const emptyStateHtml = `
            <div id="emptyState" style="padding-top: 40px; text-align: center; color: var(--text-sub);">
                <img id="emptyStateGif" 
                     src="avatar/gif_1764241746.gif" 
                     alt="MeoU Magic" 
                     class="empty-image-small" /> 
                <p class="text-xl font-semibold" style="margin-top: 5px;">Chưa có phép thuật nào</p>
                <p class="text-md">Tạo shortcut đầu tiên của bạn!</p>
            </div>`;
        templateList.innerHTML = `<div class="empty-state">${emptyStateHtml}</div>`;
        return;
    }

    templates.forEach((item, index) => {
        // Tìm index thực trong mảng gốc nếu đang render mảng lọc
        const realIndex = allTemplates.indexOf(item);
        
        const card = document.createElement('div');
        card.className = 'magic-card';
        const tagsHtml = (item.tags || []).map(tag => `<span class="tag-chip" style="background-color: ${stringToColor(tag)}">${escapeHtml(tag)}</span>`).join('');

        card.innerHTML = `
            <div class="card-header">
                <span class="shortcut-tag">${escapeHtml(item.shortcut)}</span>
                <div class="card-actions">
                    <button class="action-btn edit-btn" title="Sửa"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>
                    <button class="action-btn delete-btn" title="Xoá"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                </div>
            </div>
            <div class="card-body">${escapeHtml(item.content)}</div>
            <div class="card-footer">
                ${tagsHtml}
                <button class="add-tag-btn" title="Thêm Tag"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg></button>
            </div>
        `;
        
        // Gắn sự kiện
        card.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); openEditModal(realIndex); };
        card.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); openDeleteModal(realIndex); };
        card.querySelector('.card-body').onclick = () => openEditModal(realIndex);
        card.querySelector('.add-tag-btn').onclick = (e) => { e.stopPropagation(); openTagModal(realIndex); };
        
        templateList.appendChild(card);
    });
}

export async function saveTemplates() {
    const updates = {
        magicTemplates: allTemplates,
        magicShortcuts: allTemplates 
    };
    await chrome.storage.local.set(updates);
    await chrome.storage.sync.set({ magicTemplates: allTemplates });
    renderList(allTemplates);
}

// === PRIVATE/INTERNAL FUNCTIONS ===

function filterTemplates(query) {
    const lowerQuery = query.toLowerCase();
    const filtered = allTemplates.filter(t => t.shortcut.toLowerCase().includes(lowerQuery) || t.content.toLowerCase().includes(lowerQuery));
    renderList(filtered);
}

function openEditModal(index) {
    editingIndex = index;
    const item = allTemplates[index];
    if (modalTitle) modalTitle.textContent = 'Chỉnh sửa Magic';
    shortcutInput.value = item.shortcut;
    contentInput.value = item.content;
    modalOverlay.classList.add('active');
}

function openCreateModal() {
    editingIndex = -1;
    if (modalTitle) modalTitle.textContent = 'Thêm Magic mới';
    shortcutInput.value = ''; 
    contentInput.value = '';
    modalOverlay.classList.add('active');
    setTimeout(() => shortcutInput.focus(), 100);
}

function closeModal() { 
    modalOverlay.classList.remove('active'); 
}

function handleSave() {
    const shortcut = shortcutInput.value.trim();
    const content = contentInput.value;
    if (!shortcut || !content) { alert('Vui lòng nhập đủ thông tin!'); return; }

    if (editingIndex === -1) {
        if (allTemplates.some(t => t.shortcut === shortcut)) { alert('Phím tắt đã tồn tại!'); return; }
        allTemplates.unshift({ shortcut, content, tags: [] });
    } else {
        if (allTemplates.some((t, i) => t.shortcut === shortcut && i !== editingIndex)) { alert('Phím tắt trùng!'); return; }
        allTemplates[editingIndex].shortcut = shortcut;
        allTemplates[editingIndex].content = content;
    }
    saveTemplates(); 
    closeModal(); 
    showToast('Đã lưu thành công!');
}

// --- DELETE MODAL ---
export function openDeleteModal(index, callback) {
    deleteIndex = index;
    deleteCallback = callback; // Optional callback for agents
    deleteModalOverlay.classList.add('active');
}

function closeDeleteModal() {
    deleteModalOverlay.classList.remove('active');
    deleteIndex = -1;
    deleteCallback = null;
}

function confirmDelete() {
    if (deleteIndex > -1) {
        if (deleteCallback) {
            // Nếu có callback (dùng cho Agent)
            deleteCallback(deleteIndex);
        } else {
            // Mặc định xoá shortcut
            allTemplates.splice(deleteIndex, 1);
            saveTemplates();
        }
        closeDeleteModal();
        showToast('Đã xóa rồi nha! 🗑️');
    }
}