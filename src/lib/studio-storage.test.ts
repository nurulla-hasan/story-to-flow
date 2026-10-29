import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getStoredStudioState,
  saveStoredStudioData,
  clearStoredStudioState,
} from "./studio-storage";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const globalWithWindow = globalThis as unknown as { window?: unknown };
const originalWindow = globalWithWindow.window;
let storage: MemoryStorage;

function installWindow() {
  storage = new MemoryStorage();
  globalWithWindow.window = {
    localStorage: storage,
    dispatchEvent: () => true,
    CustomEvent: class CustomEvent {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
  };
}

describe("P1 — Studio State Invalidation & Storage Persistence", () => {
  beforeEach(() => {
    installWindow();
    clearStoredStudioState();
  });

  afterEach(() => {
    globalWithWindow.window = originalWindow;
  });

  it("persists story edit and invalidates downstream voiceover, duration, and results", () => {
    // Seed initial completed studio state
    saveStoredStudioData({
      story: "Story A",
      voiceoverScript: "Voiceover script for A",
      voiceoverDurationMinutes: "2",
      voiceoverDurationSeconds: "30.00",
      actualVoiceoverDuration: 150.0,
      currentStage: 4,
      lastResult: {
        response: "Scene breakdown",
        metadata: {
          modelUsed: "gemini",
          promptVersion: "v1.6.1",
          processingTimeMs: 1200,
        },
      },
    });

    const before = getStoredStudioState();
    expect(before.currentStage).toBe(4);
    expect(before.actualVoiceoverDuration).toBe(150.0);
    expect(before.voiceoverScript).toBe("Voiceover script for A");

    // Invalidation on Story Change: downstream fields are cleared
    saveStoredStudioData({
      story: "Story B (Edited)",
      voiceoverScript: "",
      voiceoverDurationMinutes: "",
      voiceoverDurationSeconds: "",
      actualVoiceoverDuration: null,
      lastResult: null,
      currentStage: 1,
    });

    const after = getStoredStudioState();
    expect(after.story).toBe("Story B (Edited)");
    expect(after.voiceoverScript).toBe("");
    expect(after.voiceoverDurationMinutes).toBe("");
    expect(after.voiceoverDurationSeconds).toBe("");
    expect(after.actualVoiceoverDuration).toBeNull();
    expect(after.lastResult).toBeNull();
    expect(after.currentStage).toBe(1);
  });

  it("persists voiceover edit and invalidates measured duration and previous scene results", () => {
    // Seed initial state at Stage 4
    saveStoredStudioData({
      story: "Original story",
      voiceoverScript: "Script v1",
      voiceoverDurationMinutes: "3",
      voiceoverDurationSeconds: "10.00",
      actualVoiceoverDuration: 190.0,
      currentStage: 4,
      lastResult: {
        response: "Old scenes",
        metadata: {
          modelUsed: "gemini",
          promptVersion: "v1.6.1",
          processingTimeMs: 1500,
        },
      },
    });

    // Invalidation on Voiceover Edit: duration and scenes cleared, stage drops to 2
    saveStoredStudioData({
      voiceoverScript: "Script v2 (Edited by user)",
      voiceoverDurationMinutes: "",
      voiceoverDurationSeconds: "",
      actualVoiceoverDuration: null,
      lastResult: null,
      currentStage: 2,
    });

    const state = getStoredStudioState();
    expect(state.story).toBe("Original story"); // Story preserved
    expect(state.voiceoverScript).toBe("Script v2 (Edited by user)");
    expect(state.voiceoverDurationMinutes).toBe("");
    expect(state.voiceoverDurationSeconds).toBe("");
    expect(state.actualVoiceoverDuration).toBeNull();
    expect(state.lastResult).toBeNull();
    expect(state.currentStage).toBe(2);
  });

  it("persists measured duration change and invalidates previous scene results", () => {
    saveStoredStudioData({
      story: "Original story",
      voiceoverScript: "Script v1",
      voiceoverDurationMinutes: "2",
      voiceoverDurationSeconds: "0.00",
      actualVoiceoverDuration: 120.0,
      currentStage: 4,
      lastResult: {
        response: "Old 120s scenes",
        metadata: {
          modelUsed: "gemini",
          promptVersion: "v1.6.1",
          processingTimeMs: 1000,
        },
      },
    });

    // Invalidation on Duration Change: scenes cleared, stage set to 3
    saveStoredStudioData({
      voiceoverDurationMinutes: "2",
      voiceoverDurationSeconds: "42.96",
      actualVoiceoverDuration: 162.96,
      lastResult: null,
      currentStage: 3,
    });

    const state = getStoredStudioState();
    expect(state.story).toBe("Original story");
    expect(state.voiceoverScript).toBe("Script v1"); // Script preserved
    expect(state.actualVoiceoverDuration).toBe(162.96);
    expect(state.lastResult).toBeNull(); // Old scenes cleared
    expect(state.currentStage).toBe(3);
  });

  it("clearStoredStudioState: completely clears studio state on reset", () => {
    saveStoredStudioData({
      story: "Story",
      voiceoverScript: "VO",
      actualVoiceoverDuration: 100,
      currentStage: 4,
    });

    clearStoredStudioState();

    const state = getStoredStudioState();
    expect(state.story).toBe("");
    expect(state.voiceoverScript).toBe("");
    expect(state.actualVoiceoverDuration).toBeNull();
    expect(state.currentStage).toBe(1);
    expect(state.lastResult).toBeNull();
    expect(state.inputMode).toBe("story");
  });

  it("persists direct-voiceover inputMode correctly", () => {
    saveStoredStudioData({
      inputMode: "direct-voiceover",
      voiceoverScript: "Direct narration text",
      currentStage: 2,
    });

    const state = getStoredStudioState();
    expect(state.inputMode).toBe("direct-voiceover");
    expect(state.voiceoverScript).toBe("Direct narration text");
  });
});
