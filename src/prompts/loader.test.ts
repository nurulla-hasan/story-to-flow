import { describe, it, expect } from "vitest";
import { loadMasterPrompt, MASTER_PROMPT_VERSION } from "./loader";
import { assembleSystemMessage } from "@/lib/prompt-assembly";
import { DEFAULT_SETTINGS } from "@/lib/settings";

describe("Master Prompt Loader & Version v1.5.8 Validation", () => {
  it("loads active master prompt v1.5.8 without errors", () => {
    expect(MASTER_PROMPT_VERSION).toBe("v1.5.8");
    const masterPrompt = loadMasterPrompt();

    expect(masterPrompt).toBeDefined();
    expect(masterPrompt.metadata.version).toBe("v1.5.8");
    expect(masterPrompt.content.length).toBeGreaterThan(1000);
    expect(masterPrompt.content).toContain("Version 1.5.8");
  });

  it("strictly enforces 4.0-second hero video rule in v1.5.8", () => {
    const { content } = loadMasterPrompt();

    // Check header label
    expect(content).toContain("[🎥 HERO VIDEO — 4.0s]");

    // Check mandatory start lock
    expect(content).toContain(
      "VIDEO GENERATION — NOT A STATIC IMAGE. Create one continuous 4.0-second animated video shot"
    );

    // Check mandatory end reinforcement
    expect(content).toContain(
      "This must remain a moving video for the full 4.0 seconds, ending with [specific visible final state]. Strictly 4.0 seconds duration."
    );

    // Check duration restriction
    expect(content).toContain(
      "Strictly 4.0 seconds: Under no circumstances request an 8-second, 6-second, or other duration. Never stretch the source asset beyond 4.0 seconds."
    );
  });

  it("includes story logic, causality, and source-fidelity constraint", () => {
    const { content } = loadMasterPrompt();

    expect(content).toContain("STORY LOGIC & CAUSALITY AUDIT FOR ALL STORIES:");
    expect(content).toContain("Understandable Cause and Effect");
    expect(content).toContain("Consistent Climax and Ending");
    expect(content).toContain("No Arbitrary Supernatural or Rule Changes");
    expect(content).toContain("Source-Fidelity Constraint");
  });

  it("includes exact text handling and editor overlay architecture", () => {
    const { content } = loadMasterPrompt();

    expect(content).toContain("EXACT TEXT & EDITOR OVERLAYS");
    expect(content).toContain("EDITOR TEXT OVERLAY:");
    expect(content).toContain("Exact Visible Text Rule");
  });

  it("includes enhanced silent quality check before responding", () => {
    const { content } = loadMasterPrompt();

    expect(content).toContain("PHASE 10 — SILENT QUALITY CHECK BEFORE RESPONDING");
    expect(content).toContain("STORY / VOICEOVER");
    expect(content).toContain("natural paragraph breaks");
    expect(content).toContain("reconstructs the master voiceover exactly");
    expect(content).toContain("single frozen instants with no camera or sequence language");
    expect(content).toContain("begin with the VIDEO GENERATION lock");
    expect(content).toContain("no BGM or SFX fields and no extra sections");
    expect(content).toContain("Brief timing reminder follows the scene blocks: conditional on audio status");
  });

  it("disambiguates Auto duration confirmation and conditional timing reminder", () => {
    const { content } = loadMasterPrompt();

    // Fix 1: Auto duration ambiguity resolution
    expect(content).toContain(
      "When presenting the initial settings menu, if Auto duration is offered or recommended, state the recommended natural duration and briefly explain the recommendation."
    );
    expect(content).toContain(
      "Once the user confirms the settings and selects or accepts Auto duration, proceed immediately using the stated recommendation without asking for another confirmation round solely for that duration."
    );

    // Fix 2: Conditional closing timing reminder
    expect(content).toContain(
      "If the actual Cartesia audio has NOT yet been generated or measured: state that scene timecodes are provisional estimates"
    );
    expect(content).toContain(
      "If actual Cartesia audio has been generated and its total duration measured: confirm that the total timeline duration reflects the measured audio"
    );
    expect(content).toContain(
      "If measured scene-level or sentence-level timestamps were supplied: confirm that the scene boundaries use those exact measurements directly"
    );
  });

  it("includes consistent phase 4 and phase 10 audio status alignment", () => {
    const { content } = loadMasterPrompt();

    expect(content).toContain("Audio status alignment:");
    expect(content).toContain(
      "When no measured Cartesia audio has been provided: scene timecodes are provisional estimates"
    );
    expect(content).toContain(
      "When measured total audio duration only is supplied: total timeline coverage should reflect the measured duration, but internal scene boundaries remain estimates"
    );
    expect(content).toContain(
      "When measured scene-level or sentence-level timestamps are supplied: use those boundaries directly; do not label those measured values as guesses"
    );

    // Phase 10 check: verify the blanket provisional statement is replaced with conditional rules
    expect(content).toContain(
      "When measured scene-level or sentence-level timestamps are supplied: use those measured boundaries directly and do not label them provisional"
    );
    expect(content).not.toContain(
      "Timecodes are described as provisional until actual Cartesia audio measurements exist."
    );
  });

  it("successfully integrates into system message assembly and establishes clarification precedence", () => {
    const systemMessage = assembleSystemMessage(DEFAULT_SETTINGS);

    expect(systemMessage).toContain("Version 1.5.8");
    expect(systemMessage).toContain("PRODUCTION CONTEXT — SETTINGS ALREADY CONFIRMED");
    expect(systemMessage).toContain("Auto duration does not require an extra confirmation round in app mode.");
    expect(systemMessage).toContain("CLARIFICATION EXCEPTION (STRICT PRECEDENCE OVER IMMEDIATE GENERATION):");
    expect(systemMessage).toContain("this requirement takes absolute precedence");
    expect(systemMessage).toContain("ask exactly ONE concise standalone clarification question");
    expect(systemMessage).toContain("Do NOT display or repeat the full Phase 1 settings menu when asking for clarification.");
  });
});
