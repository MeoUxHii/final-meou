// Quản lý Tags
import { getAllTemplates, saveTemplates, renderList } from './shortcuts.js';
import { stringToColor } from './utils.js';

let currentTagIndex = -1;

const tagModalOverlay = document.getElementById('tagModalOverlay');
const closeTagModalBtn = document.getElementById('closeTagModalBtn');
const saveTagsBtn = document.getElementById('saveTagsBtn');
const newTagInput = document.getElementById('newTagInput');
const addTagBtn = document.getElementById('addTagBtn');
const availableTagsList = document.getElementById('availableTagsList');

export function initTagListeners() {
    if (closeTagModalBtn) closeTagModalBtn.addEventListener('click', closeTagModal);
    if (tagModalOverlay) tagModalOverlay.addEventListener('click', (e) => { if (e.target === tagModalOverlay) closeTagModal(); });
    if (addTagBtn) addTagBtn.addEventListener('click', handleAddNewTag);
    if (newTagInput) newTagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAddNewTag(); });
    if (saveTagsBtn) saveTagsBtn.addEventListener('click', () => { 
        saveTemplates(); 
        closeTagModal(); 
        renderList(getAllTemplates()); 
    });
}

export function openTagModal(index) {
    currentTagIndex = index;
    const allTemplates = getAllTemplates();
    const item = allTemplates[index];
    if (!item.tags) item.tags = [];
    renderAvailableTags();
    tagModalOverlay.classList.add('active');
    setTimeout(() => newTagInput.focus(), 100);
}

function closeTagModal() { 
    tagModalOverlay.classList.remove('active'); 
}

function getAllUniqueTags() {
    const tags = new Set();
    const allTemplates = getAllTemplates();
    allTemplates.forEach(t => { if (t.tags) t.tags.forEach(tag => tags.add(tag)); });
    return Array.from(tags);
}

function renderAvailableTags() {
    const allTemplates = getAllTemplates();
    const currentTags = allTemplates[currentTagIndex].tags;
    const allTags = getAllUniqueTags();
    availableTagsList.innerHTML = '';
    
    if (allTags.length === 0) {
        availableTagsList.innerHTML = '<p style="font-size:12px; color:var(--text-sub); width:100%;">Chưa có tag nào. Hãy tạo mới!</p>';
    }

    allTags.forEach(tag => {
        const isSelected = currentTags.includes(tag);
        const chip = document.createElement('div');
        chip.className = `tag-option ${isSelected ? 'selected' : ''}`;
        chip.style.backgroundColor = stringToColor(tag);
        chip.textContent = tag;
        chip.onclick = () => toggleTag(tag);
        availableTagsList.appendChild(chip);
    });
}

function toggleTag(tag) {
    const allTemplates = getAllTemplates();
    const item = allTemplates[currentTagIndex];
    if (item.tags.includes(tag)) {
        item.tags = item.tags.filter(t => t !== tag);
    } else {
        item.tags.push(tag);
    }
    renderAvailableTags();
}

function handleAddNewTag() {
    const newTag = newTagInput.value.trim();
    if (!newTag) return;
    const allTemplates = getAllTemplates();
    if (!allTemplates[currentTagIndex].tags.includes(newTag)) {
        allTemplates[currentTagIndex].tags.push(newTag);
    }
    newTagInput.value = '';
    renderAvailableTags();
}