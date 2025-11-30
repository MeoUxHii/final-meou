// background.js - Fix lỗi "Receiving end does not exist" & Inject CSS File

// --- CẤU HÌNH BỘ LUẬT PHÁ GIÁP (HEADER STRIPPING & SPOOFING) ---
function setupHeaderSpoofing() {
  const rules = [
    // LUẬT 1: Giả danh người nhà (Request Headers)
    {
      "id": 1,
      "priority": 1,
      "action": {
        "type": "modifyHeaders",
        "requestHeaders": [
          { "header": "Origin", "operation": "set", "value": "https://www.google.com" },
          { "header": "Referer", "operation": "set", "value": "https://www.google.com/" },
          { "header": "Sec-Fetch-Site", "operation": "set", "value": "same-origin" }
        ]
      },
      "condition": {
        "urlFilter": "google", 
        "resourceTypes": ["xmlhttprequest", "main_frame", "sub_frame"] 
      }
    },
    // LUẬT 2: Hủy diệt lá chắn hiển thị (Response Headers)
    {
      "id": 2,
      "priority": 1,
      "action": {
        "type": "modifyHeaders",
        "responseHeaders": [
           { "header": "x-frame-options", "operation": "remove" },
           { "header": "content-security-policy", "operation": "remove" },
           { "header": "content-security-policy-report-only", "operation": "remove" },
           { "header": "cross-origin-opener-policy", "operation": "remove" },
           { "header": "cross-origin-embedder-policy", "operation": "remove" },
           { "header": "cross-origin-resource-policy", "operation": "remove" }
        ]
      },
      "condition": {
        "urlFilter": "google",
        "resourceTypes": ["main_frame", "sub_frame"]
      }
    }
  ];

  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1, 2, 3, 4, 5], 
    addRules: rules
  }).then(() => console.log("✅ Đã kích hoạt chế độ: Giả danh toàn diện!"));
}

setupHeaderSpoofing();

// --- LOGIC CHÍNH ---

// 1. Bắt phím tắt
chrome.commands.onCommand.addListener((command) => {
  if (command === "activate_magic_eye") {
    console.log("🎹 Phím tắt kích hoạt!");
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        if (!tab) return;

        // Inject Content Script & CSS File
        try {
            // 🔥 THAY ĐỔI: Inject file style.css thay vì viết CSS inline
            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ["style.css"] 
            });

            const check = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => typeof window.ngocMaiLoaded !== 'undefined'
            });
            if (!check[0]?.result) {
                console.log("💉 Injecting content script...");
                await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
                await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => { window.ngocMaiLoaded = true; } });
            }
        } catch (err) { console.error("Inject failed:", err); return; }

        // Gửi lệnh chụp
        chrome.tabs.sendMessage(tab.id, { action: "SHOW_TOAST", text: "Meou Magic Eye: ON" }).catch(() => {});
        
        setTimeout(() => {
            chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
                if (dataUrl) {
                    console.log("📸 Chụp màn hình thành công!");
                    chrome.tabs.sendMessage(tab.id, { action: "FREEZE_SCREEN", imageUrl: dataUrl }).catch(() => {});
                } else {
                    console.error("❌ Không chụp được màn hình (dataUrl null)");
                }
            });
        }, 300);
    });
  }
});

// Setup Offscreen
async function createOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["BLOBS"],
    justification: "Cắt ảnh"
  });
}

// Xử lý tin nhắn
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "CROP_IMAGE") {
    console.log("✂️ Nhận lệnh cắt ảnh từ Content Script");
    
    if (sender.tab && sender.tab.id) {
        chrome.sidePanel.open({ tabId: sender.tab.id }).catch((e) => console.error("Lỗi mở panel:", e));
    }

    chrome.runtime.sendMessage({ action: "SIDE_PANEL_LOADING" }).catch(() => {
        console.log("⚠️ Side Panel chưa sẵn sàng (sẽ tự load sau)");
    });

    handleCropProcess(message.area, sender.tab.id);
  } 
  else if (message.action === "CROP_COMPLETE") {
    console.log("✅ Cắt ảnh xong, bắt đầu Upload...");
    uploadToGoogleLens(message.croppedUrl);
  }
});

async function handleCropProcess(area, tabId) {
  await createOffscreen();
  chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      chrome.runtime.sendMessage({
        target: "offscreen",
        action: "PROCESS_CROP",
        imageUrl: dataUrl,
        area: area,
        originalTabId: tabId
      }).catch((err) => console.log("⚠️ Lỗi gửi sang Offscreen:", err));
  });
}

// Hàm Upload
async function uploadToGoogleLens(base64Image) {
  try {
    const res = await fetch(base64Image);
    const blob = await res.blob();
    const formData = new FormData();
    formData.append("encoded_image", blob, "screenshot.png");

    const response = await fetch("https://lens.google.com/upload?ep=ccm&s=&st=" + Date.now(), {
      method: "POST",
      body: formData
    });

    if (response.ok) {
        console.log("🔗 Link Google Lens:", response.url);
        chrome.runtime.sendMessage({ action: "SHOW_RESULT", url: response.url })
            .catch(err => console.error("⚠️ Không gửi được cho Side Panel:", err));
    } else {
        throw new Error("Lỗi Google: " + response.status);
    }
  } catch (error) {
    console.error("❌ Upload thất bại:", error);
    chrome.runtime.sendMessage({ 
        action: "SHOW_ERROR", 
        message: "Lỗi kết nối: " + error.message 
    }).catch(() => {});
  }
}