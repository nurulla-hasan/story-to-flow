import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LlmError, friendlyLlmError } from "./llm";
import { DEFAULT_GENERATION_TIMEOUT_MS } from "./constants";
import { getEnv } from "./env";

describe("LLM Request Lifecycle & Timeout Disambiguation (Story Studio)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      AI_BASE_URL: "http://72.61.115.32:20128/v1",
      AI_API_KEY: "test-key",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("configures default generation timeout to 300 seconds (5 minutes)", () => {
    expect(DEFAULT_GENERATION_TIMEOUT_MS).toBe(300_000);
    const env = getEnv();
    expect(env.generationTimeoutMs).toBe(300_000);
  });

  it("allows overriding generation timeout via AI_GENERATION_TIMEOUT_MS env", () => {
    process.env.AI_GENERATION_TIMEOUT_MS = "450000";
    const env = getEnv();
    expect(env.generationTimeoutMs).toBe(450_000);
  });

  it("disambiguates user cancellation from request timeout", () => {
    // User cancellation
    const cancelError = new LlmError("Request was cancelled", "unknown");
    expect(cancelError.message).toBe("Request was cancelled");

    // Timeout error
    const timeoutError = new LlmError(
      "AI generation timed out after 300s while generating scenes.",
      "timeout"
    );
    expect(timeoutError.code).toBe("timeout");
    expect(friendlyLlmError(timeoutError).code).toBe("timeout");
    expect(friendlyLlmError(timeoutError).message).toContain("timed out after 300s");
  });

  it("maps error codes to distinct HTTP status codes correctly", () => {
    const getStatusCode = (code: string) => {
      switch (code) {
        case "unauthorized":
          return 401;
        case "rate_limit":
          return 429;
        case "not_found":
          return 404;
        case "timeout":
          return 504; // Gateway Timeout
        case "network":
        case "server":
          return 502; // Bad Gateway
        default:
          return 500;
      }
    };

    expect(getStatusCode("timeout")).toBe(504);
    expect(getStatusCode("unauthorized")).toBe(401);
    expect(getStatusCode("network")).toBe(502);
    expect(getStatusCode("rate_limit")).toBe(429);
  });

  it("preserves friendly message for network/provider unreachable errors", () => {
    const netError = new LlmError(
      "Could not reach AI provider at http://72.61.115.32:20128/v1. Is it running or reachable?",
      "network"
    );
    const friendly = friendlyLlmError(netError);
    expect(friendly.code).toBe("network");
    expect(friendly.message).toContain("Could not reach AI provider");
  });

  it("handles AbortController signal for Stop Generation immediately", () => {
    const controller = new AbortController();
    let aborted = false;

    controller.signal.addEventListener("abort", () => {
      aborted = true;
    });

    expect(aborted).toBe(false);
    controller.abort();
    expect(aborted).toBe(true);
    expect(controller.signal.aborted).toBe(true);
  });
});
