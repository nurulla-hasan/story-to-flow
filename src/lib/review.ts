import { assembleImagePrompt, assemblePrompt } from "./assemble";
import { getRepo } from "./db";
import { chatJSON } from "./llm";
import { reassembleAll } from "./pipeline";
import {
  promptReinforcementsSchema,
  type PromptReinforcements,
} from "./types";

const PROBLEM_LABELS: Record<string, string> = {
  face_changed: "face changed",
  dress_changed: "dress changed",
  location_changed: "location changed",
  voice_changed: "voice changed",
  continuity_broken: "continuity broken",
};

const REVIEW_SYSTEM = `You fix consistency problems in one AI video scene prompt. Return JSON only, no markdown.

Schema:
{
  "reinforcements": [
    "1-3 short imperative lines for the MUST section of the prompt"
  ],
  "custom_rule": "optional one-line rule for all scenes, or null"
}

Rules:
- Base the fix on the reported problems and the previous prompt.
- Each reinforcement line must be concrete and visual or vocal: face, hair, dress, accessory, location object, light, voice pitch/speed/accent, or the exact last-frame continuity.
- Never repeat the whole prompt. Never add personality or backstory.
- 1 to 3 lines, max 20 words each.
- custom_rule only when the problem is global (for example a dress lock that must change for every scene). Otherwise null.
- Write in English.`;

export interface ReviewInput {
  problems: string[];
  note: string;
  apply: boolean;
  reinforcements?: string[];
  customRule?: string | null;
  saveRule?: boolean;
}

export async function reviewScene(
  projectId: string,
  n: number,
  input: ReviewInput,
) {
  const repo = getRepo();
  const data = repo.getProjectData(projectId);
  const scene = data.scenes.find((item) => item.n === n);
  if (!scene) throw new Error(`Scene ${n} not found`);
  const latest = scene.prompt;
  const existing = latest?.reinforcements ?? [];

  let proposal: PromptReinforcements;
  if (input.reinforcements && input.reinforcements.length) {
    const parsed = promptReinforcementsSchema.safeParse({
      reinforcements: input.reinforcements,
      custom_rule: input.customRule ?? null,
    });
    if (!parsed.success) {
      throw new Error(
        "The proposed reinforcement lines are invalid: " +
          parsed.error.issues.map((issue) => issue.message).join("; "),
      );
    }
    proposal = parsed.data;
  } else {
    if (!input.problems.length && !input.note.trim()) {
      throw new Error("Tick at least one problem or add a note.");
    }
    proposal = await chatJSON({
      role: "validator",
      schema: promptReinforcementsSchema,
      temperature: 0.2,
      models: data.project.settings.models,
      messages: [
        { role: "system", content: REVIEW_SYSTEM },
        {
          role: "user",
          content: `SCENE ${scene.n}:
${JSON.stringify(scene, null, 2)}

PREVIOUS PROMPT VERSION (v${latest?.version ?? 0}):
${latest?.text ?? "(not generated yet)"}

REPORTED PROBLEMS:
${input.problems.map((problem) => `- ${PROBLEM_LABELS[problem] ?? problem}`).join("\n") || "(none)"}

FREE NOTE:
${input.note || "(none)"}

EXISTING CUSTOM RULES:
${data.rules.map((rule) => `- ${rule.text}`).join("\n") || "(none)"}

Return the JSON.`,
        },
      ],
    });
  }

  const allReinforcements = dedupe([...existing, ...proposal.reinforcements]);
  const previewPrompt = assemblePrompt(data, scene, {
    reinforcements: allReinforcements,
  });

  if (!input.apply) {
    return {
      applied: false,
      reinforcements: proposal.reinforcements,
      customRule: proposal.custom_rule,
      allReinforcements,
      prompt: previewPrompt,
      imagePrompt: latest?.imagePrompt ?? "",
      version: latest?.version ?? 0,
    };
  }

  if (input.saveRule && proposal.custom_rule) {
    repo.addRule(projectId, proposal.custom_rule);
    rebuildWithReinforcements(projectId, n, allReinforcements);
    reassembleAll(projectId);
    const refreshed = repo.getScene(projectId, n);
    return {
      applied: true,
      reinforcements: proposal.reinforcements,
      customRule: proposal.custom_rule,
      allReinforcements,
      prompt: refreshed?.prompt?.text ?? previewPrompt,
      imagePrompt: refreshed?.prompt?.imagePrompt ?? "",
      version: refreshed?.prompt?.version ?? 0,
    };
  }

  const prompt = repo.addPromptVersion(projectId, n, {
    text: previewPrompt,
    imagePrompt: assembleImagePrompt(data, scene),
    reinforcements: allReinforcements,
  });
  repo.updateScene(projectId, n, { status: "ready", reasons: [] });
  return {
    applied: true,
    reinforcements: proposal.reinforcements,
    customRule: proposal.custom_rule,
    allReinforcements,
    prompt: prompt.text,
    imagePrompt: prompt.imagePrompt,
    version: prompt.version,
  };
}

function dedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = line.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(line.trim());
  }
  return out.slice(-8);
}

function rebuildWithReinforcements(projectId: string, n: number, lines: string[]) {
  const repo = getRepo();
  const data = repo.getProjectData(projectId);
  const scene = data.scenes.find((item) => item.n === n);
  if (!scene) return;
  const text = assemblePrompt(data, scene, { reinforcements: lines });
  repo.addPromptVersion(projectId, n, {
    text,
    imagePrompt: assembleImagePrompt(data, scene),
    reinforcements: lines,
  });
}
