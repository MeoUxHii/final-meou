import { callGeminiFastTranslate, callGeminiForSummarization, callGCPTranslateAPI, callVisionAPI } from './api-client.js';
import { buildImageAnalysisPrompt, buildTextTranslationPrompt } from '../prompts.js';
import { RETRANSLATE_PROMPTS } from '../retranslate-prompts.js';

// 🔥 Hàm gửi thông báo lỗi Key và tự động đổi Key (ĐÃ SỬA LỖI CANNOT READ PROPERTIES OF UNDEFINED 'CREATE')
function handleKeyErrorAndShift(error, apiKeys) {
    let errorMsg = error.toLowerCase();
    
    if (errorMsg.includes('400') || errorMsg.includes('key lởm') || errorMsg.includes('403') || errorMsg.includes('429')) {
        // Lấy Key đầu tiên (Key lỗi)
        const badKey = apiKeys.shift();
        
        // Đưa Key lỗi ra cuối danh sách
        if (badKey) {
            apiKeys.push(badKey);
            
            // Lưu lại danh sách Key mới vào chrome.storage
            chrome.storage.sync.set({ apiKeys: apiKeys })
                .then(() => {
                    console.warn(`[Key Shifting] Đã phát hiện Key lỗi, đẩy Key ra sau cùng và cập nhật danh sách Key.`);
                    
                    // 🔥 FIX LỖI: Chỉ gọi chrome.notifications.create nếu API này tồn tại
                    if (chrome.notifications && typeof chrome.notifications.create === 'function') {
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: 'icon48.png',
                            title: 'MeoU: Lỗi API Key',
                            message: 'Key Gemini đầu tiên đã hỏng hoặc hết quota. MeoU đã tự động chuyển sang Key kế tiếp.'
                        });
                    }
                })
                .catch(e => console.error("Lỗi lưu Key Shifting:", e));
        }
        
        return { 
            success: false, 
            error: `Key Gemini đầu tiên bị lỗi (Lỗi 400/403/429). Đang tự động chuyển Key. Vui lòng thử lại.` 
        };
    }
    
    return { success: false, error: error };
}

export async function translateText(text, targetLangOverride = null, isImageAnalysis = false, isWibuMode = false) {
    try {
      const data = await chrome.storage.sync.get([
        "translationService", "apiKeys", "gcpTtsApiKey", "targetLang",
        "translationTone", "currentKeyIndex",
      ]);
  
      const service = data.translationService || "gemini";
      const targetLang = targetLangOverride || data.targetLang || "vi-VN";
  
      let tone = data.translationTone || "default";
      if (tone === "vietnamese_native" && targetLang !== "vi-VN") tone = "default";
  
      if (!isImageAnalysis && targetLangOverride === null) {
        let sourceLangGuessed = null;
        const isKorean = /[가-힣]/.test(text);
        const isJapanese = /[ぁ-んァ-ヶ]/.test(text);
        const isVietnamese = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i.test(text);
        
        if (isKorean) sourceLangGuessed = "ko-KR";
        else if (isJapanese) sourceLangGuessed = "ja-JP";
        else if (isVietnamese) sourceLangGuessed = "vi-VN";
        
        if (sourceLangGuessed && sourceLangGuessed === targetLang) {
          return { success: true, translation: text };
        }
      }
  
      if (service === "gemini") {
        let apiKeys = data.apiKeys || [];
        if (apiKeys.length === 0)
          return { success: false, error: "Chưa nhập Gemini API Key!" };
  
        let translationPrompt;

        if (targetLangOverride && typeof RETRANSLATE_PROMPTS !== 'undefined' && RETRANSLATE_PROMPTS[targetLangOverride]) {
             const roleSettings = RETRANSLATE_PROMPTS[targetLangOverride];
             translationPrompt = `${roleSettings}\n\nInput text to translate:\n"${text}"\n\n(Output ONLY the translation content)`;
        } 
        else {
             translationPrompt = isImageAnalysis
              ? buildImageAnalysisPrompt(text, targetLang, tone, isWibuMode)
              : buildTextTranslationPrompt(text, targetLang, tone);
        }
  
        // GỌI HÀM DỊCH NHANH (HOT PATH) - KHÔNG DÙNG KEY ROTATION
        const geminiResult = await callGeminiFastTranslate(
          translationPrompt,
          apiKeys
        );
        
        if (geminiResult.success) {
          if (targetLangOverride === null) {
            if (!isImageAnalysis) await saveToHistory(text, geminiResult.translation);
          }
          return { success: true, translation: geminiResult.translation };
        } else {
            // Xử lý lỗi Key (Chỉ khi lỗi Key lởm 400/403/429)
            if (apiKeys.length > 1) {
                return handleKeyErrorAndShift(geminiResult.error, apiKeys);
            }
            return { success: false, error: geminiResult.error };
        }
      } 
      else {
        if (!data.gcpTtsApiKey) return { success: false, error: "Chưa có GCP API Key" };
        try {
          const translation = await callGCPTranslateAPI(data.gcpTtsApiKey, text, targetLang);
          if (targetLangOverride === null && !isImageAnalysis) await saveToHistory(text, translation);
          return { success: true, translation: translation };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  export async function handleImageTranslation(imageUrl, tabId) {
    try {
      const data = await chrome.storage.sync.get(["gcpTtsApiKey", "apiKeys"]);
      if (!data.gcpTtsApiKey) throw new Error("Thiếu Google Cloud Key (để OCR)");
      if (!data.apiKeys || data.apiKeys.length === 0) throw new Error("Thiếu Gemini Key (để dịch)");
      
      chrome.tabs.sendMessage(tabId, { action: "show_loading_popup", title: "Đang soi..." });
      const extractedText = await callVisionAPI(imageUrl, data.gcpTtsApiKey);
      chrome.tabs.sendMessage(tabId, { action: "update_loading_popup", title: "Đang dịch..." });
      const translationResult = await translateText(extractedText, null, true, false);
      
      if (translationResult.success) {
        chrome.tabs.sendMessage(tabId, { action: "show_translation_result", success: true, translation: translationResult.translation });
      } else { throw new Error(translationResult.error); }
    } catch (error) {
      chrome.tabs.sendMessage(tabId, { action: "show_translation_result", success: false, error: error.message });
    }
  }
  
  export async function handleCroppedImageTranslation(base64Data) {
    try {
      const data = await chrome.storage.sync.get(["gcpTtsApiKey", "apiKeys"]);
      if (!data.gcpTtsApiKey) throw new Error("Thiếu GCP Key");
      if (!data.apiKeys) throw new Error("Thiếu Gemini Key");
      const extractedText = await callVisionAPI(base64Data, data.gcpTtsApiKey);
      const translationResult = await translateText(extractedText, null, true, true);
      return translationResult;
    } catch (error) { return { success: false, error: error.message }; }
  }
  
  async function saveToHistory(original, translation) {
    try {
      const data = await chrome.storage.local.get(["translationHistory"]);
      let history = data.translationHistory || [];
      history.unshift({ original, translation, timestamp: new Date().toISOString() });
      if (history.length > 50) history = history.slice(0, 50);
      await chrome.storage.local.set({ translationHistory: history });
    } catch (error) { console.error("Lỗi lưu history:", error); }
  }