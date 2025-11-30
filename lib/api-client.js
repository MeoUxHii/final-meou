const API_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=`;

// --- Hàm gọi API cấp thấp dùng cho cả 3 luồng ---
async function executeGeminiRequest(apiKey, contents) {
    const response = await fetch(
      `${API_BASE_URL}${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: contents }),
      }
    );
  
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Báo lỗi 400/403/429 để hàm gọi bên ngoài biết mà xử lý rotation/shifting
      if (response.status === 429) throw new Error("Hết quota (429)");
      else if (response.status === 403 || response.status === 400) throw new Error("Key lởm (400)");
      else throw new Error(`Lỗi ${response.status}: ${errorData.error?.message || "Unknown"}`);
    }
  
    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text.trim();
    } else {
      throw new Error("Gemini không trả lời (Empty response)");
    }
}


// --- 1. LUỒNG CHAT (Slow Path - Có Key Rotation) ---
export async function callGeminiChatWithRotation(contents, apiKeys, startIndex = 0) {
    let currentKeyIndex = startIndex;
    let lastError = null;
  
    for (let attempt = 0; attempt < apiKeys.length; attempt++) {
      const apiKey = apiKeys[currentKeyIndex];
      try {
        const reply = await executeGeminiRequest(apiKey, contents);
        return { success: true, reply: reply, newKeyIndex: currentKeyIndex };
      } catch (error) {
        lastError = error.message;
        console.log(`Gemini Key ${currentKeyIndex} tạch: ${error.message}`);
        // Chuyển Key nếu có lỗi
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
      }
    }
    return {
      success: false,
      error: `Tất cả keys đều hỏng: ${lastError}`,
      newKeyIndex: currentKeyIndex,
    };
}

// --- 2. LUỒNG DỊCH NHANH (Hot Path - KHÔNG Rotation, chỉ dùng Key đầu) ---
export async function callGeminiFastTranslate(prompt, apiKeys) {
    if (!apiKeys || apiKeys.length === 0) {
        return { success: false, error: "Thiếu Gemini API Key" };
    }
    
    // Chỉ dùng Key đầu tiên (Hot Path)
    const apiKey = apiKeys[0]; 
    const contents = [{ parts: [{ text: prompt }] }];
    
    try {
        const translation = await executeGeminiRequest(apiKey, contents);
        return { success: true, translation: translation };
    } catch (error) {
        // Báo lỗi để hàm gọi bên ngoài (translation-service) xử lý Key Shifting
        return { success: false, error: error.message };
    }
}

// 🔥 FIX LỖI: Đổi tên hàm này lại thành callGeminiWithRotation để Agents Page import được
export async function callGeminiWithRotation(prompt, apiKeys, startIndex = 0) {
    const contents = [{ parts: [{ text: prompt }] }];
    const result = await callGeminiChatWithRotation(contents, apiKeys, startIndex);
    
    // Định dạng lại output cho khớp với hàm cũ
    return {
        success: result.success,
        translation: result.reply,
        newKeyIndex: result.newKeyIndex
    };
}

// --- 3. LUỒNG SUMMARIZATION (Sử dụng luồng Rotation cũ nhưng đổi tên) ---
export async function callGeminiForSummarization(prompt, apiKeys, startIndex = 0) {
    const contents = [{ parts: [{ text: prompt }] }];
    const result = await callGeminiChatWithRotation(contents, apiKeys, startIndex);
    
    // Định dạng lại output cho khớp với hàm cũ
    return {
        success: result.success,
        translation: result.reply,
        newKeyIndex: result.newKeyIndex
    };
}

// ----------------------------------------------------
// Các hàm còn lại (GCP TTS, Vision API, Drive) giữ nguyên
// ----------------------------------------------------

export async function callGCPTranslateAPI(apiKey, text, targetLang) {
    const langCode = targetLang.split("-")[0];
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, target: langCode }),
      }
    );
    if (!response.ok) throw new Error("GCP Translate API lỗi");
    const data = await response.json();
    return data.data.translations[0].translatedText;
}

export async function callGoogleCloudTTS(text) {
    try {
      const data = await chrome.storage.sync.get([
        "gcpTtsApiKey", "targetLang", "voicePrefs", "speakingRate",
      ]);
      const apiKey = data.gcpTtsApiKey;
      const targetLang = data.targetLang || "vi-VN";
      const voicePrefs = data.voicePrefs || {};
      const speakingRate = Number(data.speakingRate) || 1.0;
  
      if (!apiKey) return { success: false, error: "Chưa nhập GCP API Key" };
  
      const langCode = targetLang;
      let voiceName = voicePrefs[langCode];
      if (!voiceName) {
        // Fallback voices
        const defaultVoices = {
          "vi-VN": "vi-VN-Wavenet-A", "en-US": "en-US-Wavenet-D",
          "ja-JP": "ja-JP-Wavenet-B", "ko-KR": "ko-KR-Wavenet-A",
          "zh-CN": "cmn-CN-Wavenet-A", "fr-FR": "fr-FR-Wavenet-A",
        };
        voiceName = defaultVoices[langCode] || "vi-VN-Wavenet-A";
      }
  
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text: text },
            voice: { languageCode: langCode, name: voiceName },
            audioConfig: { audioEncoding: "MP3", speakingRate: speakingRate },
          }),
        }
      );
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TTS Lỗi ${response.status}: ${errorData.error?.message}`);
      }
      const result = await response.json();
      if (result.audioContent) return { success: true, audioBase64: result.audioContent };
      throw new Error("Không có audioContent");
    } catch (error) {
      return { success: false, error: error.message };
    }
}

export async function getGoogleVoices(langCode) {
    try {
      const data = await chrome.storage.sync.get(["gcpTtsApiKey"]);
      const apiKey = data.gcpTtsApiKey;
      if (!apiKey) return { success: false, error: "Chưa có API Key" };
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/voices?key=${apiKey}&languageCode=${langCode}`,
        { method: "GET" }
      );
      if (!response.ok) throw new Error("Không tải được danh sách giọng");
      const result = await response.json();
      if (result.voices) return { success: true, voices: result.voices };
      return { success: false, error: "Không tìm thấy giọng nào" };
    } catch (error) {
      return { success: false, error: error.message };
    }
}

export async function callVisionAPI(imageUrl, apiKey) {
    if (imageUrl.startsWith("data:")) {
      try {
        const base64String = imageUrl.split(",")[1];
        if (!base64String) throw new Error("Data URI lỗi");
        
        const requestPayload = {
          image: { content: base64String },
          features: [{ type: "TEXT_DETECTION" }],
        };
        const response = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requests: [requestPayload] }),
          }
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || response.statusText);
        }
        const data = await response.json();
        const text = data.responses?.[0]?.fullTextAnnotation?.text;
        if (!text || text.trim().length === 0) throw new Error("Ảnh này trắng trơn à? Không thấy chữ.");
        return text;
      } catch (error) {
        throw new Error(`Lỗi Vision (Base64): ${error.message}`);
      }
    }
      
    try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) throw new Error("Không tải được ảnh từ URL");
        const buffer = await imageResponse.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const base64String = btoa(binary);
        
        const requestPayload = {
            image: { content: base64String },
            features: [{ type: "TEXT_DETECTION" }],
        };
        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requests: [requestPayload] }),
            }
        );
        if (!response.ok) throw new Error("Lỗi Vision API");
        const data = await response.json();
        const text = data.responses?.[0]?.fullTextAnnotation?.text;
        if (!text) throw new Error("Không thấy chữ nào cả.");
        return text;
    } catch (e) {
        throw new Error(`Thua! Không đọc được: ${e.message}`);
    }
}

export async function fetchDriveImages(apiKey, folderId) {
    try {
        const query = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${apiKey}&fields=files(id,name,webContentLink,thumbnailLink)`;
        
        const response = await fetch(url);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Lỗi tải ảnh Drive");
        }
        
        const data = await response.json();
        return { success: true, files: data.files || [] };
    } catch (error) {
        console.error("Fetch Drive Images Error:", error);
        return { success: false, error: error.message };
    }
}

export async function fetchDriveVideos(apiKey, folderId) {
    try {
        // Lọc mimeType chứa 'video/'
        const query = `'${folderId}' in parents and mimeType contains 'video/' and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${apiKey}&fields=files(id,name,webContentLink,thumbnailLink,mimeType)`;
        
        const response = await fetch(url);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Lỗi tải video Drive");
        }
        
        const data = await response.json();
        return { success: true, files: data.files || [] };
    } catch (error) {
        console.error("Fetch Drive Videos Error:", error);
        return { success: false, error: error.message };
    }
}

export async function getDriveFileMetadata(apiKey, fileId) {
    try {
        const url = `https://www.googleapis.com/drive/v3/files/${fileId}?key=${apiKey}&fields=id,name,mimeType,videoMediaMetadata,thumbnailLink`;
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Get Metadata Error:", error);
        return null;
    }
}