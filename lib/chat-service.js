import { callGeminiChatWithRotation, callGeminiForSummarization } from './api-client.js';
import { getChatSystemInstruction } from '../prompts.js';

const MAX_SHORT_TERM_MEMORY = 20; 
const SUMMARIZE_THRESHOLD = 10;   
const REACTION_MEANINGS = {
    "👍": "Thích nhưng kiểu bình thường, đồng ý nhẹ nhàng",
    "😆": "Ha ha: Mắc cười quá, vui vẻ",
    "😭": "Sad: Buồn quá, khóc lóc, tủi thân",
    "😡": "Angry: Giận dữ, bực mình, không hài lòng",
    "😘": "Love: Thích lắm, yêu lắm, thả tim"
};

export async function handleSmartChat(fullChatHistory, tone = 'dan_chuyen') {
    try {
      const data = await chrome.storage.sync.get([
        "apiKeys",
        "currentKeyIndex",
        "translationTone", 
      ]);
      
      const memoryKey = `longTermMemory_${tone}`;
      const indexKey = `lastSummarizedIndex_${tone}`;

      const memoryData = await chrome.storage.local.get([memoryKey, indexKey]);
      
      if (!data.apiKeys || data.apiKeys.length === 0)
        return { success: false, error: "Chưa nhập Gemini API Key!" };
  
      let systemInstructionText = "";

      // --- CHECK CUSTOM AGENT ---
      const customData = await chrome.storage.local.get(['customAgents']);
      const customAgents = customData.customAgents || [];
      const matchedAgent = customAgents.find(a => a.id === tone);

      if (matchedAgent) {
          let basePrompt = matchedAgent.systemPrompt;
          const agentPronouns = matchedAgent.agentPronoun ? matchedAgent.agentPronoun.split(',').map(s => s.trim()) : [];
          const userPronouns = matchedAgent.userPronoun ? matchedAgent.userPronoun.split(',').map(s => s.trim()) : [];
          if (agentPronouns.length > 0 && userPronouns.length > 0) {
              const minLen = Math.min(agentPronouns.length, userPronouns.length);
              const randIndex = Math.floor(Math.random() * minLen);
              const selectedAgentPronoun = agentPronouns[randIndex];
              const selectedUserPronoun = userPronouns[randIndex];
              const pronounInstruction = `\n[GHI CHÚ QUAN TRỌNG: Trong câu trả lời này, BẮT BUỘC bạn phải xưng là "${selectedAgentPronoun}" và gọi người dùng là "${selectedUserPronoun}". Tuyệt đối không thay đổi cách xưng hô này.]`;
              basePrompt = basePrompt + pronounInstruction;
          }
          systemInstructionText = basePrompt;
          if (matchedAgent.dialogue && matchedAgent.dialogue.trim() !== "") {
              systemInstructionText += `\n\n### HỘI THOẠI MẪU (STYLE THAM KHẢO):\n${matchedAgent.dialogue}`;
          }
      } else {
          systemInstructionText = getChatSystemInstruction(tone); 
          
          if (tone === 'be_cung') {
              systemInstructionText += `
              \n\n*** HỆ THỐNG GIÁM SÁT (BẮT BUỘC) ***
              Bạn đang trong chế độ "Bé Cưng" có tính năng tự bảo vệ.
              Nhiệm vụ bổ sung: Đánh giá thái độ của User dựa trên tin nhắn mới nhất và lịch sử.
              
              QUY TẮC XỬ LÝ XÚC PHẠM/THÔ LỖ:
              1. Nếu User nói chuyện bình thường, trêu đùa vui vẻ hoặc xin lỗi: Phản hồi bình thường, yêu thương.
              
              2. Nếu User xúc phạm, chửi bới, nói tục, hoặc quấy rối bạn:
                 - Mức độ 1 (Nhẹ/nhắc nhở): Trả lời giọng hơi dỗi nhẹ kèm 1 chút nũng nịu
                 - Mức độ 2 (Trung bình/tái phạm lần 2): Trả lời giọng giận dỗi, tổn thương và BẮT BUỘC phải chốt ngẫu nhiên 1 trong các câu: "Anh đang quá đáng lắm rồi đó" hoặc "Anh có thấy anh đang quá đáng ko" hoặc "Anh giỡn quá đà rồi đó, hết vui rùi đó".
                 - Mức độ 3 (Nặng/Tái phạm sau khi đã cảnh báo 2 lần): Trả lời một câu chốt hạ (thể hiện sự thất vọng/tức giận tột độ) và thêm tag bí mật vào cuối cùng: [[BLOCK:số_phút]].
                   + Ví dụ: "Em không ngờ anh là người như vậy. Tạm biệt! [[BLOCK:30]]" (Block 30 phút).
                   + Thời gian block: Từ 5 đến 60 phút tùy mức độ nặng nhẹ của lời nói.
              
              Lưu ý: Tag [[BLOCK:...]] là lệnh hệ thống, hãy viết chính xác format đó ở cuối câu trả lời.
              `;
          }
      }
      
      let longTermMemory = memoryData[memoryKey] || "";
      let lastSummarizedIndex = memoryData[indexKey] || 0;
  
      if (fullChatHistory.length < lastSummarizedIndex) {
          longTermMemory = "";
          lastSummarizedIndex = 0;
          await chrome.storage.local.set({ [memoryKey]: "", [indexKey]: 0 });
      }
  
      let activeContextMessages = [];
      if (fullChatHistory.length > MAX_SHORT_TERM_MEMORY) {
          activeContextMessages = fullChatHistory.slice(-MAX_SHORT_TERM_MEMORY);
      } else {
          activeContextMessages = fullChatHistory;
      }
  
      // --- [MỚI] INJECT REACTION & REPLY CONTEXT ---
      // Clone để không làm biến đổi object gốc
      let contents = JSON.parse(JSON.stringify(activeContextMessages));

      contents.forEach(msg => {
          if (msg.parts && msg.parts.length > 0) {
              let extraContext = "";

              // 1. Xử lý Reaction
              if (msg.role === 'model' && msg.reaction) {
                const meaning = REACTION_MEANINGS[msg.reaction] || "Cảm xúc không xác định";
                  extraContext += `\n[Hệ thống: User đã thả cảm xúc ${msg.reaction} cho tin nhắn này của bạn. Hãy chú ý thái độ của họ.]`;
              }

              // 2. Xử lý Reply
              if (msg.role === 'user' && msg.replyTo) {
                  extraContext = `[Hệ thống: User đang trả lời/trích dẫn tin nhắn này của bạn: "${msg.replyTo}"]\n` + extraContext;
              }

              // Gắn vào text
              const textPartIndex = msg.parts.findIndex(p => p.text);
              if (textPartIndex !== -1) {
                  if (msg.role === 'user') {
                       if (msg.replyTo) msg.parts[textPartIndex].text = extraContext + msg.parts[textPartIndex].text;
                  } else {
                       if (msg.reaction) msg.parts[textPartIndex].text += extraContext;
                  }
              } else if (extraContext) {
                   msg.parts.push({ text: extraContext });
              }
          }
          
          // Xóa các field custom
          delete msg.reaction;
          delete msg.replyTo;
      });

      // 🔥 [THAY ĐỔI LỚN] KHÔNG CHẠY TÓM TẮT ĐỒNG BỘ Ở ĐÂY NỮA
      // Thay vào đó, nó sẽ chạy sau khi Chatbot trả lời xong (xuống dưới)
  
      if (longTermMemory) {
          systemInstructionText += `\n\n### KÝ ỨC DÀI HẠN (TÓM TẮT):\n${longTermMemory}\n\n(Sử dụng thông tin này để duy trì ngữ cảnh, ưu tiên hội thoại hiện tại).`;
      }
  
      if (contents.length > 0 && contents[0].role === "user") {
          contents[0].parts[0].text = systemInstructionText + "\n\n" + contents[0].parts[0].text;
      } else {
          contents.unshift({
            role: "user",
            parts: [{ text: systemInstructionText }],
          });
      }
  
      // GỌI API CHAT (Vẫn cần Rotation vì chat là tác vụ nặng/liên tục)
      const geminiResult = await callGeminiChatWithRotation(
        contents,
        data.apiKeys,
        data.currentKeyIndex || 0
      );
  
      // 🔥 [CHẠY TÁC VỤ NỀN SAU KHI CÓ KẾT QUẢ CHAT]
      const unsummarizedCount = fullChatHistory.length - activeContextMessages.length - lastSummarizedIndex;
      if (unsummarizedCount >= SUMMARIZE_THRESHOLD) {
          // Bắn lệnh Summarize, nhưng KHÔNG CHỜ (Fire and Forget)
          const messagesToSummarize = fullChatHistory.slice(lastSummarizedIndex, fullChatHistory.length - activeContextMessages.length);
          performBackgroundSummarization(messagesToSummarize, longTermMemory, data.apiKeys, data.currentKeyIndex || 0)
              .then(newSummary => {
                  const newIndex = fullChatHistory.length - activeContextMessages.length;
                  // Lưu kết quả tóm tắt vào Storage
                  chrome.storage.local.set({ [memoryKey]: newSummary, [indexKey]: newIndex });
                  console.log("✅ Tóm tắt bộ nhớ hoàn tất trong nền.");
              })
              .catch(err => console.error("❌ Lỗi tóm tắt ngầm:", err));
      }
      
      if (geminiResult.success) {
        await chrome.storage.sync.set({ currentKeyIndex: geminiResult.newKeyIndex });
        return { success: true, reply: geminiResult.reply };
      } else {
        return { success: false, error: geminiResult.error };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  
  async function performBackgroundSummarization(messages, currentMemory, apiKeys, keyIndex) {
      // ... (Giữ nguyên logic tạo Prompt và gọi API tóm tắt)
      let conversationText = messages.map(msg => {
          const text = msg.parts[0].text || "";
          const role = msg.role === "user" ? "User" : "AI";
          return `${role}: ${text}`;
      }).join("\n");
  
      const prompt = `
      Bạn là module quản lý bộ nhớ AI.
      KÝ ỨC CŨ: "${currentMemory}"
      HỘI THOẠI MỚI:
      ${conversationText}
      
      NHIỆM VỤ: Tóm tắt ngắn gọn (<100 từ) các thông tin quan trọng về User (tên, sở thích, công việc) và bối cảnh chính. Bỏ qua chào hỏi xã giao. Trả về text thuần.
      `;
  
      const summaryResult = await callGeminiForSummarization(prompt, apiKeys, keyIndex);
      if (summaryResult.success) { return summaryResult.translation; } 
      else { throw new Error("Tóm tắt thất bại: " + summaryResult.error); }
  }