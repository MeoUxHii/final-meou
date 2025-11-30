
import { showStatus, initCustomSelect } from './ui-utils.js';

export function initSettings() {
    const targetLangSelect = document.getElementById("targetLang");
    const voiceSelector = document.getElementById("voiceSelector");
    const toggleFavoriteBtn = document.getElementById("toggleFavoriteBtn");
    const demoVoiceBtn = document.getElementById("demoVoiceBtn");
    const speakingRateSlider = document.getElementById("speakingRate");
    const volumeSlider = document.getElementById("volumeLevel");
    const saveBtn = document.getElementById("saveBtn");
    
    // Các element này có thể không tồn tại ở Popup nữa (do đã chuyển sang Options)
    const gcpInput = document.getElementById("gcpTtsApiKey");
    const apiInput = document.getElementById("apiKeys");
    const saveApiBtn = document.getElementById("saveApiBtn");

    const translationService = document.getElementById("translationService");
    const translationTone = document.getElementById("translationTone");
    
    let demoAudio = null;

    // --- LOAD SETTINGS ---
    chrome.storage.sync.get(
        [
            "gcpTtsApiKey", "apiKeys", "targetLang", "voicePrefs", "favoriteVoices",
            "translationService", "speakingRate", "audioVolume", "translationTone"
        ],
        (data) => {
            // Chỉ điền dữ liệu nếu element tồn tại (Fix lỗi crash)
            if (gcpInput && data.gcpTtsApiKey) gcpInput.value = data.gcpTtsApiKey;
            if (apiInput && data.apiKeys && Array.isArray(data.apiKeys)) apiInput.value = data.apiKeys.join("\n");
            
            if (translationService && data.translationService) translationService.value = data.translationService;
            if (translationTone && data.translationTone) translationTone.value = data.translationTone;

            const rate = data.speakingRate || 1.0;
            if (speakingRateSlider) speakingRateSlider.value = rate;

            const vol = data.audioVolume !== undefined ? data.audioVolume : 100;
            if (volumeSlider) volumeSlider.value = vol;

            const currentLang = data.targetLang || "vi-VN";
            if (targetLangSelect) targetLangSelect.value = currentLang;

            loadVoicesForLanguage(currentLang, data.voicePrefs || {}, data.favoriteVoices || {});

            // Khởi tạo Custom Select (Giao diện đẹp)
            if (document.getElementById("translationService")) initCustomSelect("translationService");
            if (document.getElementById("targetLang")) initCustomSelect("targetLang");
            if (document.getElementById("translationTone")) initCustomSelect("translationTone");
            if (document.getElementById("voiceSelector")) initCustomSelect("voiceSelector");
        }
    );

    // --- EVENTS ---
    if (targetLangSelect) {
        targetLangSelect.addEventListener("change", () => {
            const newLang = targetLangSelect.value;
            if (voiceSelector) {
                voiceSelector.innerHTML = '<option>Đang tải...</option>';
                voiceSelector.disabled = true;
                // Re-init để update UI
                initCustomSelect("voiceSelector"); 
            }
            chrome.storage.sync.get(["voicePrefs", "favoriteVoices"], (data) => {
                loadVoicesForLanguage(newLang, data.voicePrefs || {}, data.favoriteVoices || {});
            });
        });
    }

    if (voiceSelector) {
        voiceSelector.addEventListener("change", updateFavoriteBtnState);
    }

    if (toggleFavoriteBtn) {
        toggleFavoriteBtn.addEventListener("click", () => {
            const currentLang = targetLangSelect.value;
            const currentVoice = voiceSelector.value;
            if (!currentVoice || !currentLang) return;

            chrome.storage.sync.get(["favoriteVoices", "voicePrefs"], (data) => {
                let favs = data.favoriteVoices || {};
                if (!favs[currentLang]) favs[currentLang] = [];
                const index = favs[currentLang].indexOf(currentVoice);
                if (index > -1) favs[currentLang].splice(index, 1);
                else favs[currentLang].push(currentVoice);

                chrome.storage.sync.set({ favoriteVoices: favs }, () => {
                    let tempVoicePrefs = data.voicePrefs || {};
                    tempVoicePrefs[currentLang] = currentVoice;
                    loadVoicesForLanguage(currentLang, tempVoicePrefs, favs);
                });
            });
        });
    }

    if (demoVoiceBtn) {
        demoVoiceBtn.addEventListener("click", () => {
            if (demoVoiceBtn.classList.contains("playing")) {
                if (demoAudio) { demoAudio.pause(); demoAudio = null; }
                demoVoiceBtn.classList.remove("playing"); return;
            }
            
            // Lấy API key từ storage thay vì từ input (vì input có thể không còn ở popup)
            chrome.storage.sync.get(["gcpTtsApiKey"], (data) => {
                const apiKey = data.gcpTtsApiKey;
                if (!apiKey) { showStatus("❌ Cần Google API Key (Vào Options nhập nhé)", "error"); return; }

                demoVoiceBtn.classList.add("playing");
                const demoPhrases = ["Alo 1 2 3 giọng nghe được chứ?", "Test mic nè", "Giọng này ok chưa", "Đang nói to rõ ràng luôn phen ơi", "Má lựa gì nhiều thế???", "Ok chưa phen ơi?"];
                const phrase = demoPhrases[Math.floor(Math.random() * demoPhrases.length)];
                const currentVoice = voiceSelector.value;
                const currentLang = targetLangSelect.value;
                const currentRate = parseFloat(speakingRateSlider.value);
                const currentVolume = parseInt(volumeSlider.value);

                // Lưu tạm preference trước khi test
                chrome.storage.sync.set({
                    voicePrefs: { [currentLang]: currentVoice },
                    targetLang: currentLang, speakingRate: currentRate
                }, () => {
                    chrome.runtime.sendMessage({ action: "speak", text: phrase }, (response) => {
                        if (response && response.success && response.audioBase64) {
                            try {
                                const audioData = atob(response.audioBase64);
                                const audioBytes = new Uint8Array(audioData.length);
                                for (let i = 0; i < audioData.length; i++) audioBytes[i] = audioData.charCodeAt(i);
                                const audioBlob = new Blob([audioBytes], { type: "audio/mp3" });
                                const audioUrl = URL.createObjectURL(audioBlob);
                                if (demoAudio) demoAudio.pause();
                                demoAudio = new Audio(audioUrl);
                                demoAudio.volume = currentVolume / 100;
                                demoAudio.play();
                                demoAudio.onended = () => { demoVoiceBtn.classList.remove("playing"); demoAudio = null; };
                            } catch (e) { console.error(e); demoVoiceBtn.classList.remove("playing"); }
                        } else { showStatus("❌ Lỗi: " + (response.error || "Unknown"), "error"); demoVoiceBtn.classList.remove("playing"); }
                    });
                });
            });
        });
    }

    // Hàm lưu settings (Đã cập nhật để KHÔNG lưu API Key từ Popup)
    function saveData(statusId) {
        const targetLang = document.getElementById("targetLang")?.value;
        const translationService = document.getElementById("translationService")?.value;
        const translationToneValue = document.getElementById("translationTone")?.value;
        
        const selectedVoice = voiceSelector ? voiceSelector.value : null;
        const speakingRate = parseFloat(speakingRateSlider ? speakingRateSlider.value : 1.0);
        const audioVolume = parseInt(volumeSlider ? volumeSlider.value : 100);

        // Nếu đang ở trang Options (có ô nhập API), thì mới lưu API Key
        const gcpInput = document.getElementById("gcpTtsApiKey");
        const apiInput = document.getElementById("apiKeys");
        
        let newSettings = {
            targetLang,
            translationService,
            speakingRate, 
            audioVolume,
            translationTone: translationToneValue
        };

        if (gcpInput) newSettings.gcpTtsApiKey = gcpInput.value.trim();
        if (apiInput) {
            const apiKeysRaw = apiInput.value;
            newSettings.apiKeys = apiKeysRaw.split("\n").map((k) => k.trim()).filter((k) => k.length > 0);
        }

        chrome.storage.sync.get(["voicePrefs", "favoriteVoices"], (data) => {
            const currentVoicePrefs = data.voicePrefs || {};
            if (selectedVoice && targetLang) currentVoicePrefs[targetLang] = selectedVoice;
            
            newSettings.voicePrefs = currentVoicePrefs;

            chrome.storage.sync.set(newSettings, () => { 
                showStatus("✅ Đã lưu!", "success", statusId); 
                if (statusId === "status" && targetLang) {
                    loadVoicesForLanguage(targetLang, currentVoicePrefs, data.favoriteVoices || {}); 
                }
            });
        });
    }

    if(saveBtn) saveBtn.addEventListener("click", () => saveData("status"));
    if(saveApiBtn) saveApiBtn.addEventListener("click", () => saveData("api-status"));

    function loadVoicesForLanguage(langCode, voicePrefs, favoriteVoices) {
        if (!voiceSelector) return;
        chrome.runtime.sendMessage({ action: "get_voices", langCode: langCode }, (response) => {
            voiceSelector.innerHTML = ''; voiceSelector.disabled = false;
            if (response && response.success && response.voices && response.voices.length > 0) {
                let hasSelection = false;
                const savedVoice = voicePrefs[langCode];
                const myFavs = favoriteVoices[langCode] || [];
                let priority = [], main = [], bottom = [];

                response.voices.forEach(voice => {
                    const opt = document.createElement("option");
                    opt.value = voice.name; 
                    const parts = voice.name.split("-"); 
                    let shortName = parts.pop(); let type = parts.pop();      
                    if (!type || !shortName) { type = voice.name; shortName = ""; }
                    const gender = voice.ssmlGender === "MALE" ? "Nam" : "Nữ";
                    const isBottom = voice.name.includes("Neural2") || voice.name.includes("Wavenet");
                    const isFav = myFavs.includes(voice.name);
                    opt.textContent = isBottom ? `${type} ${shortName} (${gender})` : `${shortName} (${gender})`;
                    
                    if (isFav) { opt.textContent = `✨ ${opt.textContent}`; opt.style.fontWeight = "bold"; opt.style.color = "#d35400"; priority.push(opt); } 
                    else if (isBottom) bottom.push(opt);
                    else main.push(opt);

                    if (savedVoice && voice.name === savedVoice) { opt.selected = true; hasSelection = true; }
                });
                
                function addSep(text) { const s = document.createElement("option"); s.disabled = true; s.textContent = text; s.style.fontWeight = "bold"; s.style.backgroundColor = "#eee"; voiceSelector.appendChild(s); }
                
                if (priority.length > 0) { addSep("Giọng ưu tiên"); priority.forEach(o => voiceSelector.appendChild(o)); if (main.length || bottom.length) addSep("──────────────"); }
                main.forEach(o => voiceSelector.appendChild(o));
                if (bottom.length && main.length) addSep("─── Neural / Wavenet ───");
                bottom.forEach(o => voiceSelector.appendChild(o));
                
                if (!hasSelection && voiceSelector.options.length > 0) {
                     for(let i=0; i<voiceSelector.options.length; i++) { if(!voiceSelector.options[i].disabled) { voiceSelector.selectedIndex = i; break; } }
                }
                updateFavoriteBtnState();
            } else {
                const opt = document.createElement("option"); opt.textContent = response.error || "Lỗi tải giọng"; voiceSelector.appendChild(opt);
            }
            // Re-init custom select sau khi load xong giọng
            initCustomSelect("voiceSelector");
        });
    }

    function updateFavoriteBtnState() {
        if (!toggleFavoriteBtn || !voiceSelector || !targetLangSelect) return;
        const currentVoice = voiceSelector.value;
        const currentLang = targetLangSelect.value;
        chrome.storage.sync.get(["favoriteVoices"], (data) => {
            const favs = data.favoriteVoices || {};
            const list = favs[currentLang] || [];
            if (list.includes(currentVoice)) { toggleFavoriteBtn.textContent = "❤️"; toggleFavoriteBtn.style.color = "#f1c40f"; } 
            else { toggleFavoriteBtn.textContent = "🖤"; toggleFavoriteBtn.style.color = "var(--text-color)"; }
        });
    }
}