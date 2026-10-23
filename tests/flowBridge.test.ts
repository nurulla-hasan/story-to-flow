import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isFlowExtensionInstalled, sendToFlow } from "../src/lib/flowBridge";

type MockMessageEvent = {
  source: unknown;
  data: {
    source?: string;
    type?: string;
    requestId?: string;
    prompt?: string;
    autoRun?: boolean;
    result?: {
      success: boolean;
      message?: string;
      error?: string;
    };
  };
};

interface MockDom {
  document?: {
    documentElement: {
      getAttribute: (attr: string) => string | null;
      setAttribute: (attr: string, val: string) => void;
      removeAttribute: (attr: string) => void;
    };
  };
  window?: {
    addEventListener: (type: string, fn: (event: MockMessageEvent) => void) => void;
    removeEventListener: (type: string, fn: (event: MockMessageEvent) => void) => void;
    postMessage: (data: unknown) => void;
    setTimeout: typeof setTimeout;
    clearTimeout: typeof clearTimeout;
  };
}

const g = globalThis as unknown as MockDom;

describe("flowBridge", () => {
  let attributes: Record<string, string> = {};
  let messageListeners: Array<(event: MockMessageEvent) => void> = [];

  beforeEach(() => {
    attributes = {};
    messageListeners = [];

    // Mock document
    g.document = {
      documentElement: {
        getAttribute: (attr: string) => attributes[attr] ?? null,
        setAttribute: (attr: string, val: string) => {
          attributes[attr] = val;
        },
        removeAttribute: (attr: string) => {
          delete attributes[attr];
        },
      },
    };

    // Mock window
    g.window = {
      addEventListener: (type: string, fn: (event: MockMessageEvent) => void) => {
        if (type === "message") messageListeners.push(fn);
      },
      removeEventListener: (type: string, fn: (event: MockMessageEvent) => void) => {
        if (type === "message") {
          messageListeners = messageListeners.filter((l) => l !== fn);
        }
      },
      postMessage: (data: unknown) => {
        const event: MockMessageEvent = {
          source: g.window,
          data: data as MockMessageEvent["data"],
        };
        setTimeout(() => {
          messageListeners.forEach((l) => l(event));
        }, 5);
      },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    };
  });

  afterEach(() => {
    g.document = undefined;
    g.window = undefined;
  });

  it("detects when extension data attribute is present", () => {
    g.document?.documentElement.removeAttribute("data-story-to-flow-extension");
    expect(isFlowExtensionInstalled()).toBe(false);

    g.document?.documentElement.setAttribute("data-story-to-flow-extension", "true");
    expect(isFlowExtensionInstalled()).toBe(true);
  });

  it("returns error result if extension is not installed", async () => {
    g.document?.documentElement.removeAttribute("data-story-to-flow-extension");
    const result = await sendToFlow({ prompt: "Test prompt" });
    expect(result.success).toBe(false);
    expect(result.extensionInstalled).toBe(false);
    expect(result.error).toContain("Extension not detected");
  });

  it("sends message and resolves on successful response from content script", async () => {
    g.document?.documentElement.setAttribute("data-story-to-flow-extension", "true");

    // Mock extension responding to app message
    g.window?.addEventListener("message", (event: MockMessageEvent) => {
      if (
        event.data &&
        event.data.source === "STORY_TO_FLOW_APP" &&
        event.data.type === "SEND_TO_FLOW"
      ) {
        g.window?.postMessage({
          source: "STORY_TO_FLOW_EXTENSION",
          type: "SEND_TO_FLOW_RESULT",
          requestId: event.data.requestId,
          result: {
            success: true,
            message: "Prompt injected and generation started in Google Flow!",
          },
        });
      }
    });

    const result = await sendToFlow({
      prompt: "Cinematic shot of bridge",
      autoRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.extensionInstalled).toBe(true);
    expect(result.message).toContain("Prompt injected");
  });
});
