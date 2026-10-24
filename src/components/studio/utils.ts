import type { StudioClip, StudioProject } from "./types";

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
    .map((c, i) => {
      const dur = c.duration || defaultDuration || 3.0;
      const start = elapsed;
      const end = elapsed + dur;
      elapsed = end;

      const sm = Math.floor(start / 60);
      const ss = Math.floor(start % 60);
      const em = Math.floor(end / 60);
      const es = Math.floor(end % 60);
      const timeStr = `${sm}:${ss.toString().padStart(2, "0")} - ${em}:${es.toString().padStart(2, "0")}`;

      return (
        `IMAGE #${String(c.index || i + 1).padStart(2, "0")} (${timeStr} • ${dur.toFixed(1)}s • ${c.motion || "zoom-in"})\n` +
        `VOICEOVER: ${c.narration}\n` +
        `PROMPT: ${c.imagePrompt}`
      );
    })
    .join("\n\n" + "—".repeat(44) + "\n\n");
}

/**
 * Formats all prompts into an exportable file header + numbered prompt list.
 */
export function formatPromptsExport(
  project: StudioProject,
  totalDuration: number,
): string {
  let elapsed = 0;
  return (
    `STORY TO FLOW — PROMPT LIST\n` +
    `Title: ${project.title}\n` +
    `Total Images: ${project.clips.length} (~${totalDuration.toFixed(0)}s)\n` +
    `Aspect Ratio: ${project.aspectRatio}\n` +
    `Art Style: ${project.stylePreset}\n\n` +
    project.clips
      .map((c, i) => {
        const dur = c.duration || project.defaultClipDuration || 3.0;
        const start = elapsed;
        const end = elapsed + dur;
        elapsed = end;
        const sm = Math.floor(start / 60);
        const ss = Math.floor(start % 60);
        const em = Math.floor(end / 60);
        const es = Math.floor(end % 60);
        const timeStr = `${sm}:${ss.toString().padStart(2, "0")} - ${em}:${es.toString().padStart(2, "0")}`;

        return (
          `IMAGE #${String(c.index || i + 1).padStart(2, "0")} (${timeStr} • ${dur.toFixed(1)}s • ${c.motion || "zoom-in"})\n` +
          `Narration: ${c.narration}\n` +
          `Flow Prompt: ${c.imagePrompt}\n`
        );
      })
      .join("\n" + "-".repeat(60) + "\n\n")
  );
}
