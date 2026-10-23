// Content script bridging Story-to-Flow web app on localhost with the Chrome extension

(function () {
  // Mark extension presence in DOM attribute for reliable client detection
  document.documentElement.setAttribute("data-story-to-flow-extension", "true");

  // Send an announcement event
  window.postMessage(
    {
      source: "STORY_TO_FLOW_EXTENSION",
      type: "EXTENSION_READY",
      version: "1.0.0",
    },
    "*"
  );

  // Listen for messages from the website
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "STORY_TO_FLOW_APP") {
      return;
    }

    if (event.data.type === "PING_EXTENSION") {
      window.postMessage(
        {
          source: "STORY_TO_FLOW_EXTENSION",
          type: "PONG_EXTENSION",
          version: "1.0.0",
        },
        "*"
      );
      return;
    }

    if (event.data.type === "SEND_TO_FLOW") {
      const requestId = event.data.requestId;

      // Check if extension context is still valid (not invalidated by a reload)
      if (!chrome.runtime || !chrome.runtime.id) {
        window.postMessage(
          {
            source: "STORY_TO_FLOW_EXTENSION",
            type: "SEND_TO_FLOW_RESULT",
            requestId,
            result: {
              success: false,
              error: "Extension was reloaded. Please refresh this page (F5) and try again.",
            },
          },
          "*"
        );
        return;
      }

      try {
        chrome.runtime.sendMessage(event.data, (response) => {
          const lastErr = chrome.runtime.lastError;
          window.postMessage(
            {
              source: "STORY_TO_FLOW_EXTENSION",
              type: "SEND_TO_FLOW_RESULT",
              requestId,
              result: response || {
                success: false,
                error: lastErr ? lastErr.message : "No response from extension background worker.",
              },
            },
            "*"
          );
        });
      } catch {
        window.postMessage(
          {
            source: "STORY_TO_FLOW_EXTENSION",
            type: "SEND_TO_FLOW_RESULT",
            requestId,
            result: {
              success: false,
              error: "Extension was reloaded. Please refresh this page (F5) to reconnect.",
            },
          },
          "*"
        );
      }
    }
  });
})();
