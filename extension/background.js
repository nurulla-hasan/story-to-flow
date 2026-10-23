// Background service worker for Story-to-Flow Extension Bridge

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SEND_TO_FLOW") {
    handleSendToFlow(message)
      .then((res) => sendResponse(res))
      .catch((err) => {
        console.error("[Story-to-Flow Background] Error:", err);
        sendResponse({ success: false, error: err.message || String(err) });
      });
    return true; // Keep message channel open for async response
  }
});

async function handleSendToFlow(payload) {
  // Find open Flow tabs
  const queryPatterns = [
    "*://flow.google.com/*",
    "*://labs.google/*",
  ];

  let tabs = await chrome.tabs.query({ url: queryPatterns });
  if (tabs.length === 0) {
    // Comprehensive fallback search
    const allTabs = await chrome.tabs.query({});
    tabs = allTabs.filter(
      (t) => t.url && (t.url.includes("flow.google.com") || t.url.includes("labs.google"))
    );
  }

  let flowTab;

  if (tabs.length > 0) {
    flowTab = tabs[0];
    await chrome.tabs.update(flowTab.id, { active: true });
    if (flowTab.windowId) {
      try {
        await chrome.windows.update(flowTab.windowId, { focused: true });
      } catch {
        // window focus error ignored
      }
    }
  } else {
    // No Flow tab open, open a new one
    flowTab = await chrome.tabs.create({
      url: "https://flow.google.com",
      active: true,
    });

    // Wait until loading is complete
    await new Promise((resolve) => {
      const listener = (tabId, info) => {
        if (tabId === flowTab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      // Timeout after 15 seconds if complete doesn't fire
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 15000);
    });

    // Extra wait for Angular / client SPA initialization
    await new Promise((r) => setTimeout(r, 2500));
  }

  // Ensure content script is ready or inject it if needed
  try {
    const response = await chrome.tabs.sendMessage(flowTab.id, {
      action: "INJECT_AND_RUN",
      prompt: payload.prompt,
      imageDataUrl: payload.imageDataUrl,
      imageName: payload.imageName,
      autoRun: payload.autoRun ?? true,
    });
    return response;
  } catch {
    // If content script was not already running (e.g. fresh tab), inject it programmatically
    console.log("[Story-to-Flow Background] Injecting flow-bridge script dynamically...");
    await chrome.scripting.executeScript({
      target: { tabId: flowTab.id },
      files: ["flow-bridge.js"],
    });

    await new Promise((r) => setTimeout(r, 600));

    const retryResponse = await chrome.tabs.sendMessage(flowTab.id, {
      action: "INJECT_AND_RUN",
      prompt: payload.prompt,
      imageDataUrl: payload.imageDataUrl,
      imageName: payload.imageName,
      autoRun: payload.autoRun ?? true,
    });
    return retryResponse;
  }
}
