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
      autoRun,
    });

    // Step 1: Locate the exact ProseMirror prompt editor ("What do you want to create?")
    let editor = await waitForElement(SELECTORS.editor, 12000);
    if (!editor) {
      throw new Error(
        "Could not find the prompt editor on Google Flow. Please ensure the prompt box is open."
      );
    }

    // Step 2: Inject prompt text first
    console.log("[Story-to-Flow Bridge] 1/2: Injecting prompt text...");
    injectTextIntoEditor(editor, prompt);
    await sleep(400);

    // Step 3: If image is provided, attach via paste into the editor
    let imageAttached = false;
    if (imageDataUrl) {
      console.log("[Story-to-Flow Bridge] 2/2: Attaching starting image...");
      try {
        imageAttached = await attachImageToFlow(editor, imageDataUrl, imageName || "start-frame.png");
        await sleep(500);

        // Re-verify prompt text is still present in editor alongside uploaded image
        editor = document.querySelector(SELECTORS.editor) || editor;
        const currentText = (editor.textContent || "").trim();
        if (!currentText.includes(prompt.slice(0, 20))) {
          console.log("[Story-to-Flow Bridge] Re-injecting prompt text alongside image...");
          injectTextIntoEditor(editor, prompt);
          await sleep(400);
        }
      } catch (imgErr) {
        console.warn("[Story-to-Flow Bridge] Image attach failed:", imgErr);
      }
    }

    // Step 4: Final prompt text verification
    editor = document.querySelector(SELECTORS.editor) || editor;
    const finalText = (editor.textContent || "").trim();
    if (!finalText.includes(prompt.slice(0, 20))) {
      injectTextIntoEditor(editor, prompt);
      await sleep(300);
    }

    // Ensure editor has focus so the user can easily press Enter or inspect
    editor.focus();

    // Step 5: If autoRun is requested (e.g. text-only scenes), click "Start generation"
    let clicked = false;
    if (autoRun) {
      console.log("[Story-to-Flow Bridge] Auto-triggering generation...");
      await sleep(400);
      clicked = await triggerFlowSend();
    }

    return {
      success: true,
      imageAttached,
      generated: clicked,
      message: clicked
        ? "Prompt sent! Generation started in Google Flow."
        : imageDataUrl
          ? "Prompt and starting image placed in Google Flow! Hit Enter or click -> once image finishes uploading."
          : "Prompt placed in Google Flow.",
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
      let targetElement = editor.querySelector("p");
      if (!targetElement) {
        targetElement = document.createElement("p");
        editor.appendChild(targetElement);
      }

      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(targetElement);
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand("delete", false, null);
        document.execCommand("insertText", false, text);
      } catch (e) {
        console.warn("execCommand insert failed, fallback to direct textContent:", e);
      }

      // If text is still not set or was not inserted, assign targetElement content directly
      if (!targetElement.textContent || !targetElement.textContent.includes(text.slice(0, 20))) {
        targetElement.textContent = text;
      }

      targetElement.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: text })
      );
      targetElement.dispatchEvent(new Event("input", { bubbles: true }));
      targetElement.dispatchEvent(new Event("change", { bubbles: true }));

      editor.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: "insertText", data: text })
      );
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

  async function triggerFlowSend() {
    // Wait for the exact "Start generation" button to become enabled
    const btnClicked = await pollAndClickSendButton(15000);
    if (btnClicked) return true;

    console.warn("[Story-to-Flow Bridge] Start generation button was not ready in time. Ready for manual send.");
    return false;
  }

  async function pollAndClickSendButton(maxWaitMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const btn = document.querySelector(SELECTORS.generateButton);
      const isAriaDisabled = btn?.getAttribute("aria-disabled") === "true";
      const isDisabled = btn?.disabled || isAriaDisabled;

      if (btn && !isDisabled) {
        await sleep(500);
        btn.click();
        console.log("[Story-to-Flow Bridge] Successfully clicked 'Start generation' button!");
        return true;
      }
      await sleep(400);
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

