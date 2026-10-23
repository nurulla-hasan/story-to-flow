// Content script injected into flow.google.com to automate prompt injection, frame attachment, and generation

(function () {
  console.log("[Story-to-Flow Bridge] Content script initialized on Google Flow.");

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "INJECT_AND_RUN") {
      executeFlowTask(request)
        .then((result) => sendResponse(result))
        .catch((err) => {
          console.error("[Story-to-Flow Bridge] Error executing task:", err);
          sendResponse({ success: false, error: err.message || String(err) });
        });
      return true; // Keep channel open for async response
    }
  });

  const SELECTORS = {
    editor: [
      'div.ProseMirror[aria-label="What do you want to create?"]',
      'flow-rich-text-editor div.ProseMirror',
      '.agent-panel-prompt-box div.ProseMirror',
      'div.ProseMirror[contenteditable="true"]',
    ].join(", "),
    generateButton: [
      'button[aria-label="Start generation"]',
      'button.generate-icon-button',
      'flow-generate-icon-button button',
      'span.submit-button-slot button',
    ].join(", "),
  };

  async function executeFlowTask({ prompt, imageDataUrl, imageName, autoRun }) {
    console.log("[Story-to-Flow Bridge] Starting injection task...", {
      promptLength: prompt?.length,
      hasImage: Boolean(imageDataUrl),
    });

    // Step 1: Locate the exact ProseMirror prompt editor ("What do you want to create?")
    const editor = await waitForElement(SELECTORS.editor, 12000);
    if (!editor) {
      throw new Error(
        "Could not find the prompt editor on Google Flow. Please ensure the prompt box is open."
      );
    }

    // Step 2: Inject prompt text into ProseMirror
    console.log("[Story-to-Flow Bridge] 1/3: Injecting prompt text...");
    injectTextIntoEditor(editor, prompt);
    await sleep(400);

    // Step 3: If image is provided, attach via paste onto the editor
    let imageAttached = false;
    if (imageDataUrl) {
      try {
        console.log("[Story-to-Flow Bridge] 2/3: Attaching image to prompt box...");
        imageAttached = await attachImageToFlow(editor, imageDataUrl, imageName || "start-frame.png");
        // Allow Flow to register thumbnail preview
        await sleep(1200);
      } catch (imgErr) {
        console.warn("[Story-to-Flow Bridge] Image attach failed:", imgErr);
      }
    }

    // Brief pause for state stabilization
    await sleep(400);

    // Step 4: Click the "Start generation" button
    let clicked = false;
    if (autoRun !== false) {
      console.log("[Story-to-Flow Bridge] 3/3: Auto-triggering generation...");
      clicked = await triggerFlowSend(editor);
    }

    return {
      success: true,
      imageAttached,
      generated: clicked,
      message: clicked
        ? "Prompt and image sent! Generation started in Google Flow."
        : "Prompt and image ready in Google Flow.",
    };
  }

  function injectTextIntoEditor(editor, text) {
    if (!editor) return;
    editor.focus();

    if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
      const nativeSetter =
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set ||
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (nativeSetter) {
        nativeSetter.call(editor, text);
      } else {
        editor.value = text;
      }
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // ContentEditable / ProseMirror
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand("delete", false, null);
        document.execCommand("insertText", false, text);
      } catch (e) {
        console.warn("execCommand insert failed, fallback to direct paragraph text:", e);
      }

      // If text is still not set, assign paragraph content directly
      if (!editor.textContent || !editor.textContent.trim()) {
        let p = editor.querySelector("p");
        if (!p) {
          p = document.createElement("p");
          editor.appendChild(p);
        }
        p.textContent = text;
      }

      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  async function attachImageToFlow(editor, dataUrl, fileName) {
    const file = dataUrlToFile(dataUrl, fileName);

    editor.focus();
    await sleep(200);

    // Dispatch synthetic Paste event with image file ONLY to the focused prompt editor
    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const pasteEvent = new ClipboardEvent("paste", {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer,
      });
      editor.dispatchEvent(pasteEvent);
      console.log("[Story-to-Flow Bridge] Dispatched paste event with image file to editor.");
      return true;
    } catch (e) {
      console.warn("[Story-to-Flow Bridge] Paste event dispatch failed:", e);
      return false;
    }
  }

  async function triggerFlowSend(editor) {
    // Wait for the exact "Start generation" button to become enabled
    const btnClicked = await pollAndClickSendButton(10000);
    if (btnClicked) return true;

    // Fallback: Dispatch Enter key on the editor
    console.log("[Story-to-Flow Bridge] Send button not clicked in time, trying Enter key fallback...");
    try {
      editor.focus();
      const enterDown = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(enterDown);

      const enterUp = new KeyboardEvent("keyup", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(enterUp);
      return true;
    } catch (e) {
      console.warn("[Story-to-Flow Bridge] Enter key fallback failed:", e);
    }

    return false;
  }

  async function pollAndClickSendButton(maxWaitMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const btn = document.querySelector(SELECTORS.generateButton);
      const isAriaDisabled = btn?.getAttribute("aria-disabled") === "true";
      const isDisabled = btn?.disabled || isAriaDisabled;

      if (btn && !isDisabled) {
        btn.click();
        console.log("[Story-to-Flow Bridge] Successfully clicked 'Start generation' button!");
        return true;
      }
      await sleep(350);
    }
    return false;
  }

  function waitForElement(selector, timeoutMs = 12000) {
    return new Promise((resolve) => {
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }, timeoutMs);
    });
  }

  function dataUrlToFile(dataUrl, fileName) {
    const arr = dataUrl.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], fileName, { type: mime });
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
})();

