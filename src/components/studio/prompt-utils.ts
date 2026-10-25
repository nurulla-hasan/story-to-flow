import type { StudioClip, StudioProject } from "./types";
import { evaluateHeroShot } from "../../lib/hero-shot";

export type PromptExportProject = Pick<
  StudioProject,
  "title" | "clips" | "aspectRatio" | "defaultClipDuration" | "stylePreset"
>;

/**
 * Downloads a string as a plain text file in the browser.
 */
export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Formats all clip prompts into a sequential, human-readable list with timestamps.
 */
export function formatAllPrompts(
  clips: StudioClip[],
  defaultDuration = 3.0,
): string {
  if (!clips.length) return "";
  let elapsed = 0;
  return clips
    .map((clip, index) => {
      const hero = evaluateHeroShot(clip);
      const isHero = hero.recommendedMediaType === "video";
      const duration = isHero ? 4.0 : (clip.duration || defaultDuration || 3.0);
      const start = elapsed;
      const end = elapsed + duration;
      elapsed = end;

      const time = formatTimeRange(start, end);
      const badge = isHero
        ? `[🎥 4s Video Clip (Flow Animate)${hero.heroReason ? ` • ${hero.heroReason}` : ""}]`
        : "[🖼️ Static Image]";

      return (
        `IMAGE #${String(clip.index || index + 1).padStart(2, "0")} (${time} • ${duration.toFixed(1)}s • ${clip.motion || "zoom-in"}) ${badge}\n` +
        `VOICEOVER: ${clip.narration}\n` +
        `PROMPT: ${clip.imagePrompt}`
      );
    })
    .join("\n\n" + "—".repeat(44) + "\n\n");
}

/**
 * Formats all prompts into an exportable file header + numbered prompt list.
 */
export function formatPromptsExport(
  project: PromptExportProject,
  totalDuration: number,
): string {
  let elapsed = 0;
  return (
    `STORY TO FLOW — PROMPT LIST\n` +
    `Title: ${project.title}\n` +
    `Total Images: ${project.clips.length} (~${totalDuration.toFixed(0)}s)\n` +
    `Aspect Ratio: ${project.aspectRatio}\n` +
    `Art Style: ${project.stylePreset ?? ""}\n\n` +
    project.clips
      .map((clip, index) => {
        const duration = clip.duration || project.defaultClipDuration || 3.0;
        const start = elapsed;
        const end = elapsed + duration;
        elapsed = end;
        const time = formatTimeRange(start, end);

        return (
          `IMAGE #${String(clip.index || index + 1).padStart(2, "0")} (${time} • ${duration.toFixed(1)}s • ${clip.motion || "zoom-in"})\n` +
          `Narration: ${clip.narration}\n` +
          `Flow Prompt: ${clip.imagePrompt}\n`
        );
      })
      .join("\n" + "-".repeat(60) + "\n\n")
  );
}

function formatTimeRange(start: number, end: number): string {
  const startMinutes = Math.floor(start / 60);
  const startSeconds = Math.floor(start % 60);
  const endMinutes = Math.floor(end / 60);
  const endSeconds = Math.floor(end % 60);
  return `${startMinutes}:${startSeconds.toString().padStart(2, "0")} - ${endMinutes}:${endSeconds.toString().padStart(2, "0")}`;
}
