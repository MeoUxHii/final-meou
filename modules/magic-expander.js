export class MagicExpander {
    constructor() {
        this.shortcuts = [];
        this.enabled = true;
        this.loadSettings();
        this.initListener();
    }

    loadSettings() {
        chrome.storage.sync.get(['magicTemplates', 'magicEnabled'], (data) => {
            if (data.magicTemplates) this.shortcuts = data.magicTemplates;
            if (data.magicEnabled !== undefined) this.enabled = data.magicEnabled;
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                if (changes.magicTemplates) this.shortcuts = changes.magicTemplates.newValue || [];
                if (changes.magicEnabled) this.enabled = changes.magicEnabled.newValue;
            }
        });
    }

    initListener() {
        document.addEventListener('input', (e) => this.handleInput(e));
    }

    handleInput(e) {
        if (!this.enabled || !e.target) return;
        
        if (e.inputType && (e.inputType.startsWith('delete') || e.inputType.startsWith('history'))) return;

        const target = e.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        const isEditable = target.isContentEditable;

        if (!isInput && !isEditable) return;
        if (target !== document.activeElement && !isEditable) return;

        if (isInput) {
            this.processInput(target);
        } else {
            this.processContentEditable(target);
        }
    }

    // --- XỬ LÝ INPUT / TEXTAREA (Modern Way) ---
    processInput(target) {
        const text = target.value;
        const cursorPosition = target.selectionStart;
        
        // Lấy tối đa 50 ký tự trước con trỏ để check
        const textBeforeCursor = text.slice(Math.max(0, cursorPosition - 50), cursorPosition);
        
        for (const template of this.shortcuts) {
            if (this.checkTrigger(textBeforeCursor, template.shortcut)) {
                const shortcutLen = template.shortcut.length + 1; // +1 cho dấu cách trigger
                const start = cursorPosition - shortcutLen;
                const end = cursorPosition;

                // 1. Thay thế text bằng setRangeText (Chuẩn HTML5)
                // 'end' nghĩa là đặt con trỏ ngay sau đoạn text vừa chèn
                try {
                    target.setRangeText(template.content, start, end, 'end');
                } catch (err) {
                    // Fallback cho một số input type đặc biệt không hỗ trợ setRangeText (vd: email, number)
                    this.replaceInputReactFallback(target, start, end, template.content);
                    return;
                }

                // 2. Kích hoạt sự kiện input để các Framework (React/Vue) nhận biết thay đổi
                // Đây là bước quan trọng để state của framework đồng bộ với DOM
                const inputEvent = new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    inputType: 'insertText',
                    data: template.content,
                    isComposing: false
                });
                target.dispatchEvent(inputEvent);
                
                // Bonus: Thêm sự kiện change cho chắc cốp
                target.dispatchEvent(new Event('change', { bubbles: true }));
                return;
            }
        }
    }

    // --- XỬ LÝ CONTENTEDITABLE (DOM Range + Selection API) ---
    processContentEditable(target) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        // Chỉ xử lý trên Text Node
        if (node.nodeType !== Node.TEXT_NODE) return;

        const text = node.textContent;
        const cursorOffset = range.startOffset;
        const textBeforeCursor = text.slice(Math.max(0, cursorOffset - 50), cursorOffset);

        for (const template of this.shortcuts) {
            if (this.checkTrigger(textBeforeCursor, template.shortcut)) {
                const shortcutLen = template.shortcut.length + 1;
                
                // 1. Xác định vùng cần thay thế
                const rangeToReplace = document.createRange();
                try {
                    rangeToReplace.setStart(node, cursorOffset - shortcutLen);
                    rangeToReplace.setEnd(node, cursorOffset);
                } catch (err) { return; }

                // 2. Xóa nội dung cũ (shortcut + space)
                rangeToReplace.deleteContents();

                // 3. Chèn nội dung mới (template content)
                // Tạo text node mới hoặc fragment
                const textNode = document.createTextNode(template.content);
                rangeToReplace.insertNode(textNode);

                // 4. Di chuyển con trỏ ra sau text vừa chèn
                rangeToReplace.setStartAfter(textNode);
                rangeToReplace.setEndAfter(textNode);
                
                selection.removeAllRanges();
                selection.addRange(rangeToReplace);

                // 5. Dispatch InputEvent để báo cho site (Facebook/Gmail/Discord...)
                const inputEvent = new InputEvent('input', {
                    inputType: 'insertText',
                    data: template.content,
                    bubbles: true,
                    cancelable: true
                });
                target.dispatchEvent(inputEvent);
                return;
            }
        }
    }

    // Helper: Kiểm tra trigger (Space hoặc Non-breaking space)
    checkTrigger(text, shortcut) {
        const triggerSpace = " ";
        const triggerNbsp = "\u00A0"; 
        return text.endsWith(shortcut + triggerSpace) || text.endsWith(shortcut + triggerNbsp);
    }

    // Helper: Fallback siêu cấp cho React (khi setRangeText bị chặn)
    // Dùng prototype setter để bypass React state lock
    replaceInputReactFallback(target, start, end, content) {
        const currentValue = target.value;
        const newValue = currentValue.substring(0, start) + content + currentValue.substring(end);
        
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;

        if (target.tagName === 'INPUT' && nativeInputValueSetter) {
            nativeInputValueSetter.call(target, newValue);
        } else if (target.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
            nativeTextAreaValueSetter.call(target, newValue);
        } else {
            target.value = newValue;
        }
        
        const newCursorPos = start + content.length;
        target.setSelectionRange(newCursorPos, newCursorPos);

        target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    }
}