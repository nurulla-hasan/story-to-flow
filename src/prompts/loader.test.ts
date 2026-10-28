import { describe, it, expect } from "vitest";
import { loadMasterPrompt, MASTER_PROMPT_VERSION } from "./loader";
import {
  assembleSystemMessage,
  assembleVoiceoverSystemMessage,
  assembleSceneSystemMessage,
} from "@/lib/prompt-assembly";
import { DEFAULT_SETTINGS } from "@/lib/settings";

describe("Master Prompt Loader & Version v1.6.1 Validation", () => {
  it("loads active master prompt v1.6.1 without errors and preserves historical versions", () => {
    expect(MASTER_PROMPT_VERSION).toBe("v1.6.1");
    const masterPrompt = loadMasterPrompt();

    expect(masterPrompt).toBeDefined();
    expect(masterPrompt.metadata.version).toBe("v1.6.1");
    expect(masterPrompt.content.length).toBeGreaterThan(1000);
    expect(masterPrompt.content).toContain("Version 1.6.1");

    // Historical v1.6.0 preservation verification
    const v160Prompt = loadMasterPrompt("v1.6.0");
    expect(v160Prompt).toBeDefined();
    expect(v160Prompt.metadata.version).toBe("v1.6.0");
    expect(v160Prompt.content).toContain("Version 1.6.0");

    // Historical v1.5.9 preservation verification
    const v159Prompt = loadMasterPrompt("v1.5.9");
    expect(v159Prompt).toBeDefined();
    expect(v159Prompt.metadata.version).toBe("v1.5.9");
    expect(v159Prompt.content).toContain("Version 1.5.9");

    // Historical v1.5.8 preservation verification
    const v158Prompt = loadMasterPrompt("v1.5.8");
    expect(v158Prompt).toBeDefined();
    expect(v158Prompt.metadata.version).toBe("v1.5.8");
    expect(v158Prompt.content).toContain("Version 1.5.8");
  });

  it("strictly enforces hero video source asset duration rule in v1.6.1", () => {
    const { content } = loadMasterPrompt();

    // Check header label pattern
    expect(content).toContain("[🎥 HERO VIDEO — 4.0s]");
    expect(content).toContain("[🎥 HERO VIDEO — 6.0s]");

    // Check mandatory start lock
    expect(content).toContain(
      "VIDEO GENERATION — NOT A STATIC IMAGE. Create one continuous"
    );

    // Check mandatory end reinforcement
    expect(content).toContain(
      "This must remain a moving video for the full"
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
    expect(content).toContain("Do not ask the image generator to render exact Bengali text.");
  });

  it("includes enhanced silent quality check before responding", () => {
    const { content } = loadMasterPrompt();

    expect(content).toContain("PHASE 10 — SILENT QUALITY CHECK BEFORE RESPONDING");
    expect(content).toContain("STORY / VOICEOVER");
    expect(content).toContain("paragraph breaks");
    expect(content).toContain("reconstruct the final master voiceover exactly");
    expect(content).toContain("Do video prompts begin with the exact VIDEO GENERATION lock");
    expect(content).toContain("no separate SFX/BGM fields or extra sections");
    expect(content).toContain("Is the closing timing reminder conditional on actual audio status");
  });

  it("confirms removal of Target Video Duration and presence of conditional timing reminders in v1.6.1", () => {
    const { content } = loadMasterPrompt();

    // Verification of Target Video Duration removal
    expect(content).toContain("There is NO Target Video Duration setting.");
    expect(content).toContain(
      "Do not ask the user to choose 20/30/45/60/90/120 seconds or a custom target story duration."
    );

    // Conditional closing timing reminder
    expect(content).toContain(
      "If actual Cartesia audio has NOT been generated or measured: state that scene/shot timecodes are provisional estimates"
    );
    expect(content).toContain(
      "If actual Cartesia audio has been generated and its total duration measured: confirm total timeline coverage reflects the supplied duration"
    );
    expect(content).toContain(
      "If measured scene-level or sentence-level timestamps were supplied: state that those boundaries use the supplied measurements."
    );
  });

  it("includes consistent phase 4 and phase 10 audio status alignment", () => {
    const { content } = loadMasterPrompt();

    expect(content).toContain(
      "When no measured Cartesia audio is provided, all timecodes are provisional estimates"
    );
    expect(content).toContain(
      "When measured scene-level or sentence-level timestamps are supplied, use them directly and do not label them as estimates."
    );
    expect(content).toContain(
      "When actual audio duration was supplied, does total shot timeline coverage match it?"
    );
    expect(content).toContain(
      "Are internal boundaries labeled estimated unless actual internal timestamps were provided?"
    );
  });

  it("successfully integrates into system message assembly and establishes clarification precedence", () => {
    const systemMessage = assembleSystemMessage(DEFAULT_SETTINGS);

    expect(systemMessage).toContain("Version 1.6.1");
    expect(systemMessage).toContain("PRODUCTION CONTEXT — SETTINGS ALREADY CONFIRMED");
    expect(systemMessage).toContain("There is NO Target Video Duration setting.");
    expect(systemMessage).toContain("CLARIFICATION EXCEPTION (STRICT PRECEDENCE OVER IMMEDIATE GENERATION):");
    expect(systemMessage).toContain("this requirement takes absolute precedence");
    expect(systemMessage).toContain("ask exactly ONE concise standalone clarification question");
    expect(systemMessage).toContain("Do NOT display or repeat the full Phase 1 settings menu when asking for clarification.");
  });

  it("app-mode prompt assembly: enforces immediate generation without target duration", () => {
    const customSettings = {
      model: "antigravity/gemini-3.8-flash-high",
      visualStyle: "3D Animated Cartoon",
      aspectRatio: "16:9" as const,
      staticFramePacing: "Auto" as const,
      videoAssetDuration: 4 as const,
      visualAssetMode: "Hybrid" as const,
      videoSoundMode: "Silent Video" as const,
    };

    const systemMessage = assembleSystemMessage(customSettings);

    expect(systemMessage).toContain("VISUAL STYLE: 3D Animated Cartoon");
    expect(systemMessage).toContain("ASPECT RATIO: 16:9");
    expect(systemMessage).toContain("STATIC FRAME PACING: Auto (AI recommends appropriate natural storytelling pacing, defaulting to approximately 4.0 seconds per static shot)");
    expect(systemMessage).toContain("VIDEO SOURCE ASSET DURATION: 4.0 seconds");
    expect(systemMessage).not.toContain("TARGET DURATION:");
    expect(systemMessage).toContain("The visual style \"3D Animated Cartoon\" should use polished animation");
    expect(systemMessage).toContain("Do NOT display or repeat the Phase 1 settings menu.");
    expect(systemMessage).toContain("APPLICATION / PRECONFIGURED SETTINGS MODE");
    expect(systemMessage).toContain("Phase 1 is ALREADY COMPLETE.");
    expect(systemMessage).toContain("AI সব ঠিক করো");
  });

  it("assembleVoiceoverSystemMessage: enforces Stage 1 master voiceover script generation exclusively without target duration", () => {
    const systemMessage = assembleVoiceoverSystemMessage(DEFAULT_SETTINGS);

    expect(systemMessage).toContain("STAGE 1: MASTER VOICEOVER SCRIPT");
    expect(systemMessage).toContain("There is NO Target Video Duration setting.");
    expect(systemMessage).toContain("EXCLUSIVELY to write the complete, continuous Bangladeshi Bengali master voiceover script");
    expect(systemMessage).toContain("Do NOT generate any scene blocks, shots, or image/video prompts in this stage.");
    expect(systemMessage).toContain("Natural Bangladeshi Bengali narrator persona");
    expect(systemMessage).toContain("Audience-retention hook within the first 5 seconds");
    expect(systemMessage).not.toContain("TARGET DURATION:");
  });

  it("assembleSceneSystemMessage: incorporates measured duration, scene vs shot distinction, and asset/sound modes", () => {
    const sceneSettings = {
      model: "antigravity/gemini-3.8-flash-high",
      visualStyle: "Cinematic Realism",
      aspectRatio: "16:9" as const,
      staticFramePacing: 4.0,
      videoAssetDuration: 4 as const,
      visualAssetMode: "Hybrid" as const,
      videoSoundMode: "Silent Video" as const,
    };

    const systemMessage = assembleSceneSystemMessage(sceneSettings, 242.96);

    expect(systemMessage).toContain("STAGE 4: SCENE & SHOT PROMPT GENERATION");
    expect(systemMessage).toContain("242.96 SECONDS");
    expect(systemMessage).toContain("CRITICAL SCENE VS. SHOT ARCHITECTURE:");
    expect(systemMessage).toContain("A Story Scene represents a coherent story event or narrative beat.");
    expect(systemMessage).toContain("A Shot is one visual composition used to depict part of that scene.");
    expect(systemMessage).toContain("One scene can contain multiple shots!");
    expect(systemMessage).toContain("Hybrid Mode selected (Default)");
    expect(systemMessage).toContain("Silent Video selected (Default)");
    expect(systemMessage).toContain("Hero-video source assets must strictly match the selected duration (4.0 SECONDS).");
    expect(systemMessage).toContain("SCENE & SHOT OUTPUT FORMAT (ONE CODE BLOCK PER STORY SCENE):");
    expect(systemMessage).toContain("Use the same duration in your external video generator.");
  });

  it("assembleSceneSystemMessage: applies dynamic hero-video duration lock for 6s and 8s durations", () => {
    // Test 6s duration
    const settings6s = {
      model: "antigravity/gemini-3.8-flash-high",
      visualStyle: "Anime & Manga Style",
      aspectRatio: "16:9" as const,
      staticFramePacing: 4.0,
      videoAssetDuration: 6 as const,
      visualAssetMode: "All Videos" as const,
      videoSoundMode: "Ambient Sound & SFX" as const,
    };
    const msg6s = assembleSceneSystemMessage(settings6s, 120.0);
    expect(msg6s).toContain("VIDEO SOURCE ASSET DURATION: 6.0 seconds");
    expect(msg6s).toContain("[🎥 HERO VIDEO — 6.0s]");
    expect(msg6s).toContain("Create one continuous 6.0-second animated video shot");
    expect(msg6s).toContain("Strictly 6.0 seconds duration.");

    // Test 8s duration
    const settings8s = {
      model: "antigravity/gemini-3.8-flash-high",
      visualStyle: "Cinematic Realism",
      aspectRatio: "16:9" as const,
      staticFramePacing: 4.0,
      videoAssetDuration: 8 as const,
      visualAssetMode: "Hybrid" as const,
      videoSoundMode: "Silent Video" as const,
    };
    const msg8s = assembleSceneSystemMessage(settings8s, 180.0);
    expect(msg8s).toContain("VIDEO SOURCE ASSET DURATION: 8.0 seconds");
    expect(msg8s).toContain("[🎥 HERO VIDEO — 8.0s]");
    expect(msg8s).toContain("Create one continuous 8.0-second animated video shot");
    expect(msg8s).toContain("Strictly 8.0 seconds duration.");
  });
});
