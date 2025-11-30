export class MagicEyeService {
    constructor() {
        this.setupHeaderSpoofing();
        this.setupListeners();
        // 🔥 TẠO SẴN LUÔN CHO NÓNG (Pre-load)
        this.createOffscreen();
    }

    // --- CẤU HÌNH BỘ LUẬT PHÁ GIÁP ---
    setupHeaderSpoofing() {
        const rules = [
            // LUẬT 1: Giả danh người nhà (Request Headers) - Chỉ áp dụng cho Google Lens
            {
                "id": 1001, 
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
                    "urlFilter": "lens.google.com", 
                    "resourceTypes": ["xmlhttprequest"] 
                }
            },
            // LUẬT 2: Hủy diệt lá chắn hiển thị (Response Headers) - Giữ nguyên cho iframe
            {
                "id": 1002,
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
                    "urlFilter": "google.com",
                    "resourceTypes": ["main_frame", "sub_frame"]
                }
            }
        ];

        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1001, 1002],
            addRules: rules
        }).then(() => console.log("✅ [Magic Eye] Đã kích hoạt chế độ: Giả danh (An toàn cho YouTube)!"));
    }

    setupListeners() {
        chrome.runtime.onMessage.addListener((message, sender) => {
            if (message.action === "CROP_IMAGE") {
                console.log("✂️ [Magic Eye] Nhận lệnh cắt ảnh");
                if (sender.tab && sender.tab.id) {
                    chrome.sidePanel.open({ tabId: sender.tab.id }).catch((e) => console.error("Lỗi mở panel:", e));
                }
                chrome.runtime.sendMessage({ action: "SIDE_PANEL_LOADING" }).catch(() => {});
                this.handleCropProcess(message.area, sender.tab.id);
            } else if (message.action === "CROP_COMPLETE") {
                console.log("✅ [Magic Eye] Cắt ảnh xong, bắt đầu Upload...");
                this.uploadToGoogleLens(message.croppedUrl);
            }
        });
    }

    // Xử lý Command từ Background chính gọi sang
    async handleCommand(command, tab) {
        if (command === "activate_magic_eye") {
            console.log("🎹 [Magic Eye] Phím tắt kích hoạt (Silent Mode)!");
            if (!tab) return;

            // Đảm bảo Offscreen còn sống
            await this.createOffscreen();

            // 🔥 THAY ĐỔI: Gửi PING thay vì SHOW_TOAST để kiểm tra kết nối mà không hiện thông báo
            chrome.tabs.sendMessage(tab.id, { action: "PING" })
                .then(() => {
                    // Content script đã sẵn sàng, chụp màn hình luôn
                    setTimeout(() => {
                        chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
                            if (dataUrl) {
                                // console.log("📸 [Magic Eye] Chụp màn hình thành công!");
                                chrome.tabs.sendMessage(tab.id, { action: "FREEZE_SCREEN", imageUrl: dataUrl }).catch(() => {});
                            } else {
                                console.error("❌ Không chụp được màn hình");
                            }
                        });
                    }, 100);
                })
                .catch((err) => {
                    // Nếu lỗi (do tab chưa reload sau khi update extension), thử inject lại (Fallback)
                    console.log("⚠️ Tab chưa sẵn sàng, đang thử Inject thủ công...");
                    this.fallbackInject(tab.id);
                });
        }
    }

    // Hàm dự phòng: Chỉ chạy khi user chưa F5 trang web cũ
    async fallbackInject(tabId) {
        try {
            await chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ["magic-eye/style.css"] });
            await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ["magic-eye/content.js"] });
            
            // Thử gọi lại sau khi inject
            setTimeout(() => {
                this.handleCommand("activate_magic_eye", { id: tabId });
            }, 200);
        } catch (e) {
            console.error("Fallback failed:", e);
        }
    }

    async createOffscreen() {
        if (await chrome.offscreen.hasDocument()) return;
        await chrome.offscreen.createDocument({
            url: "magic-eye/offscreen.html", 
            reasons: ["BLOBS"],
            justification: "Cắt ảnh Magic Eye"
        });
    }

    async handleCropProcess(area, tabId) {
        await this.createOffscreen();
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

    async uploadToGoogleLens(base64Image) {
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
}