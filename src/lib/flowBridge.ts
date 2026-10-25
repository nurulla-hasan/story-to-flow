/**
 * Client-side bridge communicating with the Story-to-Flow Chrome extension.
 */

export interface FlowSendResult {
  success: boolean;
  message?: string;
  error?: string;
  extensionInstalled: boolean;
}

export function isFlowExtensionInstalled(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-story-to-flow-extension") === "true";
}

/**
 * Fetches an asset URL (e.g. /api/files/...) and converts it to a base64 Data URL.
 */
export async function resolveImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Sends prompt and optional start frame to Google Flow via the Chrome extension bridge.
 */
export async function sendToFlow(options: {
  prompt: string;
  imageUrl?: string | null;
  imageName?: string;
  autoRun?: boolean;
  mediaType?: "video" | "image";
  duration?: number;
}): Promise<FlowSendResult> {
  const { prompt, imageUrl, imageName, autoRun = true } = options;

  if (!isFlowExtensionInstalled()) {
    return {
      success: false,
      extensionInstalled: false,
      error: "Extension not detected. Please load the unpacked extension in Chrome from the 'extension' folder.",
    };
  }

  let imageDataUrl: string | null = null;
  if (imageUrl) {
    imageDataUrl = await resolveImageDataUrl(imageUrl);
  }

  const requestId = `flow_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve) => {
    // Timeout after 45 seconds to accommodate large image upload & generation trigger
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", listener);
      resolve({
        success: false,
        extensionInstalled: true,
        error: "Timed out waiting for response from Google Flow tab.",
      });
    }, 45000);

    const listener = (event: MessageEvent) => {
      if (
        event.source !== window ||
        !event.data ||
        event.data.source !== "STORY_TO_FLOW_EXTENSION" ||
        event.data.type !== "SEND_TO_FLOW_RESULT" ||
        event.data.requestId !== requestId
      ) {
        return;
      }

      window.removeEventListener("message", listener);
      clearTimeout(timer);

      const res = event.data.result;
      if (res && res.success) {
        resolve({
          success: true,
          extensionInstalled: true,
          message: res.message || "Sent to Google Flow successfully!",
        });
      } else {
        resolve({
          success: false,
          extensionInstalled: true,
          error: res?.error || "Failed to inject into Google Flow.",
        });
      }
    };

    window.addEventListener("message", listener);

    // Dispatch to content script
    window.postMessage(
      {
        source: "STORY_TO_FLOW_APP",
        type: "SEND_TO_FLOW",
        requestId,
        prompt,
        imageDataUrl,
        imageName: imageName || "start-frame.png",
        autoRun,
        mediaType: options.mediaType || "image",
        duration:
          options.mediaType === "video"
            ? options.duration || 4.0
            : undefined,
      },
      "*"
    );
  });
}
