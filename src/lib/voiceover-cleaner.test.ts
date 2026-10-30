import { describe, it, expect } from "vitest";
import {
  stripMarkdownCodeFence,
  countVoiceoverWords,
  estimateVoiceoverDurationSeconds,
} from "./voiceover-cleaner";

describe("voiceover-cleaner (stripMarkdownCodeFence & word count)", () => {
  const plainNarration = `মাটির সোঁদা গন্ধ আর মেঘলা আকাশ... এমন দিনে নদীর ওপারে পুরনো বটগাছের নিচে যে অদ্ভুত আলোটা জ্বলে ওঠে, সেটা আসলে কীসের?

নদীর ঘাটে বাঁধা ছিল একমাত্র ভাঙা নাওটা। মাঝি কালাম মিয়া যখন বৈঠা হাতে তুলে নিল, তখন নদীর বুকে শুধু জলের ছলাৎ ছলাৎ শব্দ।`;

  it("leaves plain Bengali text completely unchanged, including paragraph breaks", () => {
    const cleaned = stripMarkdownCodeFence(plainNarration);
    expect(cleaned).toBe(plainNarration);
    expect(cleaned).toContain("\n\n");
    expect(cleaned).toContain("মাটির সোঁদা গন্ধ");
    expect(cleaned).toContain("নদীর ঘাটে বাঁধা ছিল");
  });

  it("strips ```text code fence and preserves internal paragraph breaks", () => {
    const fencedText = "```text\n" + plainNarration + "\n```";
    const cleaned = stripMarkdownCodeFence(fencedText);
    expect(cleaned).toBe(plainNarration);
    expect(cleaned).not.toContain("```");
    expect(cleaned).not.toContain("text");
    expect(cleaned).toContain("\n\n");
  });

  it("strips bare ``` code fence (no language identifier)", () => {
    const fencedBare = "```\n" + plainNarration + "\n```";
    const cleaned = stripMarkdownCodeFence(fencedBare);
    expect(cleaned).toBe(plainNarration);
    expect(cleaned).not.toContain("```");
    expect(cleaned).toContain("\n\n");
  });

  it("strips ```markdown code fence", () => {
    const fencedMarkdown = "```markdown\n" + plainNarration + "\n```";
    const cleaned = stripMarkdownCodeFence(fencedMarkdown);
    expect(cleaned).toBe(plainNarration);
    expect(cleaned).not.toContain("```");
    expect(cleaned).not.toContain("markdown");
    expect(cleaned).toContain("\n\n");
  });

  it("strips fences with leading, trailing, and internal carriage return (CRLF) whitespaces", () => {
    const crlfFenced = "   \r\n```text\r\n" + plainNarration.replace(/\n/g, "\r\n") + "\r\n```\r\n   ";
    const cleaned = stripMarkdownCodeFence(crlfFenced);
    expect(cleaned).not.toContain("```");
    expect(cleaned).toContain("মাটির সোঁদা গন্ধ");
    expect(cleaned).toContain("নদীর ঘাটে বাঁধা ছিল");
  });

  it("extracts clean narration when model outputs introductory label before the fence", () => {
    const labeledOutput = `Master Voiceover Script:
\`\`\`text
${plainNarration}
\`\`\``;
    const cleaned = stripMarkdownCodeFence(labeledOutput);
    expect(cleaned).toBe(plainNarration);
    expect(cleaned).not.toContain("Master Voiceover Script");
    expect(cleaned).not.toContain("```");
  });

  it("handles null, undefined, and empty string safely", () => {
    expect(stripMarkdownCodeFence("")).toBe("");
    expect(stripMarkdownCodeFence(null)).toBe("");
    expect(stripMarkdownCodeFence(undefined)).toBe("");
    expect(stripMarkdownCodeFence("   \n\n  ")).toBe("");
  });

  it("countVoiceoverWords does NOT count markdown fences as words", () => {
    const fencedText = "```text\nএক দুই তিন চার পাঁচ।\n```";
    const plainText = "এক দুই তিন চার পাঁচ।";

    const fencedWordCount = countVoiceoverWords(fencedText);
    const plainWordCount = countVoiceoverWords(plainText);

    expect(plainWordCount).toBe(5);
    expect(fencedWordCount).toBe(5); // Must not count ```text or ``` as words!
  });

  it("estimateVoiceoverDurationSeconds calculates accurate speaking duration", () => {
    const tenWords = "এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ";
    expect(countVoiceoverWords(tenWords)).toBe(10);
    // 10 words / 2.4 wps = 4.16 -> Math.round = 4s
    expect(estimateVoiceoverDurationSeconds(tenWords)).toBe(4);
  });
});
