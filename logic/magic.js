(function() {
    // --- MAGIC TEXT EXPANDER LOGIC ---
    let magicShortcuts = [];
    let isMagicEnabled = true;

    // Load settings
    chrome.storage.sync.get(['magicTemplates', 'magicEnabled'], (data) => {
        if (data.magicTemplates) magicShortcuts = data.magicTemplates;
        if (data.magicEnabled !== undefined) isMagicEnabled = data.magicEnabled;
    });

    // Listen for changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'sync') {
            if (changes.magicTemplates) magicShortcuts = changes.magicTemplates.newValue || [];
            if (changes.magicEnabled) isMagicEnabled = changes.magicEnabled.newValue;
        }
    });

    function handleInput(e) {
        if (!isMagicEnabled || !e.target) return;
        if (e.inputType && (e.inputType.startsWith('delete') || e.inputType === 'historyUndo')) return;

        const target = e.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        const isContentEditable = target.isContentEditable;

        if (!isInput && !isContentEditable) return;
        
        setTimeout(() => {
            checkAndExpand(target, isInput);
        }, 0);
    }

    // Lắng nghe sự kiện input
    document.addEventListener('input', handleInput);

    async function checkAndExpand(target, isInput) {
        if (magicShortcuts.length === 0) return;

        let textBeforeCursor = "";
        let cursorEnd = 0;
        let range = null;
        let selection = null;

        if (isInput) {
            cursorEnd = target.selectionStart;
            textBeforeCursor = target.value.slice(Math.max(0, cursorEnd - 50), cursorEnd);
        } else {
            selection = window.getSelection();
            if (!selection.rangeCount) return;
            range = selection.getRangeAt(0);
            
            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                cursorEnd = range.startOffset;
                textBeforeCursor = range.startContainer.textContent.slice(Math.max(0, cursorEnd - 50), cursorEnd);
            } else {
                return; 
            }
        }

        for (const template of magicShortcuts) {
            const triggerSpace = " ";
            const triggerNbsp = "\u00A0";
            
            let matchedTrigger = null;
            if (textBeforeCursor.endsWith(template.shortcut + triggerSpace)) {
                matchedTrigger = triggerSpace;
            } else if (textBeforeCursor.endsWith(template.shortcut + triggerNbsp)) {
                matchedTrigger = triggerNbsp;
            }

            if (matchedTrigger) {
                const shortcutLen = template.shortcut.length + 1;
                let content = template.content; 
                if (!content.endsWith(" ") && !content.endsWith("\u00A0")) {
                    content += " ";
                }

                if (isInput) {
                    const start = cursorEnd - shortcutLen;
                    const end = cursorEnd;
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;

                    const currentValue = target.value;
                    const newValue = currentValue.substring(0, start) + content + currentValue.substring(end);

                    if (target.tagName === 'INPUT' && nativeInputValueSetter) {
                        nativeInputValueSetter.call(target, newValue);
                    } else if (target.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
                        nativeTextAreaValueSetter.call(target, newValue);
                    } else {
                        target.value = newValue;
                    }
                    
                    const newCursorPos = start + content.length;
                    target.setSelectionRange(newCursorPos, newCursorPos);
                    const event = new Event('input', { bubbles: true });
                    target.dispatchEvent(event);
                } else {
                    const rangeToDelete = document.createRange();
                    rangeToDelete.setStart(range.startContainer, cursorEnd - shortcutLen);
                    rangeToDelete.setEnd(range.startContainer, cursorEnd);
                    selection.removeAllRanges();
                    selection.addRange(rangeToDelete);
                    document.execCommand('delete'); 
                    insertTextSimulated(content, target);
                }
                return; 
            }
        }
    }

    function insertTextSimulated(text, target) {
        const success = document.execCommand('insertText', false, text);
        if (!success) {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            const textNode = document.createTextNode(text);
            
            range.deleteContents();
            range.insertNode(textNode);
            
            range.setStartAfter(textNode);
            range.setEndAfter(textNode);
            selection.removeAllRanges();
            selection.addRange(range);
            
            const inputEvent = new InputEvent('input', {
                inputType: 'insertText',
                data: text,
                bubbles: true,
                cancelable: true
            });
            target.dispatchEvent(inputEvent);
        }
    }
})();