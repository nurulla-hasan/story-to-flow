import { assembleImagePrompt, assembleScene } from "./assemble";
import { getRepo, DEFAULT_PROJECT_ID } from "./db";
import { getImageProvider } from "./image";
import { chatJSON } from "./llm";
import { generateBible, planSceneBatch } from "./planner";
import { saveAsset, stamp } from "./files";
import {
  canonicalScene,
  validatorResultSchema,
  type Bible,
  type ProjectData,
  type Scene,
  type SceneRecord,
  type Settings,
} from "./types";
import {
  deterministicChecksForScene,
  hasErrors,
} from "./validate";
import { applySceneFieldEdits } from "./sceneEdits";

const VALIDATOR_SYSTEM = `You validate one scene of an AI video production plan. Return JSON only, no markdown.

Schema:
{
  "ok": true,
  "issues": ["short reason"],
  "edits": [
    { "field": "action", "value": "corrected text", "reason": "why" }
  ]
}

Check only semantic problems:
- more than one main action in the scene
- contradiction between action and start_state/end_state
- continuity with the previous scene (positions, facing, props, light)
- a location jump without an establishing shot
- dialogue that does not fit the action or the visible speaker
- camera directions that cannot be shot in one continuous clip

Rules:
- Do NOT rewrite a scene that is already valid. ok=true, issues=[], edits=[].
- If a fix is needed, return the smallest structured field edits. Never return a whole new prompt.
- Allowed fields: action, start_state, end_state, sound, location_id, characters, dialogue, camera.shot, camera.angle, camera.movement, is_establishing, chain_from_previous.
- Do not change n, locks, style, or character ids.
- Keep action under 25 words. Keep dialogue under the project limit.
- start_state must equal the previous scene's end_state when chain_from_previous is true.`;

export class PipelineError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function buildBible(
  projectId = DEFAULT_PROJECT_ID,
): Promise<Bible> {
  const repo = getRepo();
  const data = repo.getProjectData(projectId);
  if (!data.project.story.trim()) {
    throw new PipelineError("Paste a story before creating the story bible.");
  }
  const bible = await generateBible(data, data.project.settings.models);
  repo.updateProject(projectId, {
    name: bible.title,
    styleLock: bible.style_lock,
  });
  repo.replaceBible(projectId, bible);
  // Old scenes belonged to old characters/locations that no longer exist in this bible.
  repo.replaceScenes(projectId, []);
  return bible;
}

export function startPlanJob(projectId = DEFAULT_PROJECT_ID) {
  const repo = getRepo();
  const data = repo.getProjectData(projectId);
  if (!data.project.story.trim()) {
    throw new PipelineError("Paste a story before planning scenes.");
  }
  if (!data.characters.length || !data.locations.length) {
    throw new PipelineError("Create the story bible first so scenes have locks.");
  }
  const running = repo.getLastJob(projectId, "plan");
  if (running?.status === "running") {
    throw new PipelineError("A scene plan is already running. Please wait.", 409);
  }
  const job = repo.createJob(projectId, "plan");
  void runPlanJob(job.id, projectId).catch((error) => {
    repo.updateJob(job.id, {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      message: "Scene planning failed",
    });
  });
  return job;
}

async function runPlanJob(jobId: string, projectId: string): Promise<void> {
  const repo = getRepo();
  const first = repo.getProjectData(projectId);
  const settings = first.project.settings;
  const total = Math.max(
    1,
    Math.ceil((settings.totalMinutes * 60) / settings.clipSeconds),
  );
  const batchSize = 10;
  let planned: Scene[] = [];
  const warnings: string[] = [];

  for (let offset = 0; offset < total; offset += batchSize) {
    const count = Math.min(batchSize, total - offset);
    const startN = offset + 1;
    repo.updateJob(jobId, {
      progress: Math.round((offset / total) * 60),
      message: `Planning scenes ${startN}–${startN + count - 1} of ${total}…`,
    });
    const data = repo.getProjectData(projectId);
    const previous = planned.slice(-2).map((scene) => canonicalScene(scene));
    let batch: Scene[];
    try {
      batch = await planSceneBatch({
        data,
        startN,
        count,
        previousScenes: previous,
        models: settings.models,
      });
    } catch (error) {
      throw new Error(
        `Scene planning failed at batch starting ${startN}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    if (batch.length !== count) {
      warnings.push(
        `Batch ${startN}: model returned ${batch.length} scenes instead of ${count}; retried once.`,
      );
      try {
        const retry = await planSceneBatch({
          data,
          startN,
          count,
          previousScenes: previous,
          models: settings.models,
        });
        if (retry.length === count) batch = retry;
        else
          warnings.push(
            `Batch ${startN}: retry returned ${retry.length} scenes instead of ${count}.`,
          );
      } catch {
        // keep first batch
      }
    }
    planned = planned.concat(batch);
    const sanitized = sanitizeScenePlan(first, planned).scenes;
    repo.replaceScenes(projectId, sanitized);
    planned = sanitized;
  }

  planned = sanitizeScenePlan(repo.getProjectData(projectId), planned).scenes;
  repo.replaceScenes(projectId, planned);

  const data = repo.getProjectData(projectId);
  const rounds =
    settings.validatorStrictness === "off"
      ? 0
      : settings.validatorStrictness === "strict"
        ? 2
        : 1;

  for (let index = 0; index < data.scenes.length; index += 1) {
    const scene = data.scenes[index];
    repo.updateJob(jobId, {
      progress: 60 + Math.round(((index + 1) / data.scenes.length) * 38),
      message:
        rounds === 0
          ? `Assembling prompt ${scene.n} of ${data.scenes.length}…`
          : `Validating scene ${scene.n} of ${data.scenes.length}…`,
    });
    try {
      const result = await validateAndVersionScene(projectId, scene.n, rounds);
      if (result.status === "needs_attention") {
        warnings.push(`Scene ${scene.n}: ${result.reasons.join("; ")}`);
      }
    } catch (error) {
      await versionOnly(projectId, scene.n, [
        `Validation skipped: ${error instanceof Error ? error.message : String(error)}`,
      ]);
      warnings.push(
        `Scene ${scene.n}: validator failed (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  }

  repo.updateJob(jobId, {
    status: "done",
    progress: 100,
    message: `Planned ${planned.length} scenes.`,
    result: { scenes: planned.length, warnings },
  });
}

export function sanitizeScenePlan(
  data: ProjectData,
  input: Scene[],
): { scenes: Scene[]; warnings: string[] } {
  const settings = data.project.settings;
  const warnings: string[] = [];
  const sorted = [...input].sort((a, b) => a.n - b.n);
  const out: Scene[] = [];
  const knownCharacters = new Set(data.characters.map((character) => character.id));
  const knownLocations = new Set(data.locations.map((location) => location.id));

  for (const raw of sorted) {
    const scene = canonicalScene(raw);
    const previous = out[out.length - 1];
    scene.n = out.length + 1;

    const deduped = [...new Set(scene.characters)].filter((id) =>
      knownCharacters.has(id),
    );
    if (deduped.length !== scene.characters.length) {
      warnings.push(`Scene ${scene.n}: removed unknown character ids.`);
    }
    if (deduped.length > settings.maxPeople) {
      warnings.push(
        `Scene ${scene.n}: people count ${deduped.length} exceeded max ${settings.maxPeople}; trimmed.`,
      );
    }
    scene.characters = deduped.slice(0, settings.maxPeople);

    if (!knownLocations.has(scene.location_id) && data.locations[0]) {
      warnings.push(
        `Scene ${scene.n}: unknown location "${scene.location_id}"; using "${data.locations[0].id}".`,
      );
      scene.location_id = data.locations[0].id;
    }

    if (!settings.dialogueEnabled) scene.dialogue = null;
    if (scene.dialogue && !scene.characters.includes(scene.dialogue.speaker)) {
      warnings.push(
        `Scene ${scene.n}: dialogue speaker is not visible; dialogue removed.`,
      );
      scene.dialogue = null;
    }
    if (scene.dialogue && !data.characters.some((character) => character.id === scene.dialogue?.speaker)) {
      scene.dialogue = null;
    }

    const locationChanged = previous && previous.location_id !== scene.location_id;
    if (locationChanged && !scene.is_establishing) {
      scene.is_establishing = true;
      scene.chain_from_previous = false;
      scene.dialogue = null;
      const location = data.locations.find((item) => item.id === scene.location_id);
      scene.action = `Establishing shot of ${location?.name ?? scene.location_id}. ${scene.action}`.slice(
        0,
        600,
      );
      warnings.push(
        `Scene ${scene.n}: location changed without an establishing shot; converted to establishing.`,
      );
    }
    if (scene.is_establishing) {
      scene.dialogue = null;
      scene.chain_from_previous = false;
    }
    if (!previous) scene.chain_from_previous = false;
    if (!settings.frameChaining) scene.chain_from_previous = false;
    if (
      settings.frameChaining &&
      previous &&
      !scene.is_establishing &&
      previous.location_id === scene.location_id
    ) {
      scene.chain_from_previous = true;
    }
    if (scene.chain_from_previous && previous) {
      scene.start_state = previous.end_state;
    }
    if (!scene.sound.trim() && settings.ambientSound) {
      scene.sound = "Natural ambience of the location";
    }
    out.push(scene);
  }
  return { scenes: out, warnings };
}

export async function validateAndVersionScene(
  projectId: string,
  n: number,
  maxRounds: number,
): Promise<{ status: "ready" | "needs_attention"; reasons: string[] }> {
  const repo = getRepo();
  let scene = repo.getScene(projectId, n);
  if (!scene) throw new PipelineError(`Scene ${n} not found`, 404);
  const models = repo.getProject(projectId).settings.models;

  for (let round = 0; round <= maxRounds; round += 1) {
    const data = repo.getProjectData(projectId);
    scene = data.scenes.find((item) => item.n === n) ?? scene;
    const built = assembleScene(data, scene);
    const issues = deterministicChecksForScene(
      data,
      scene,
      built.prompt,
      built.imagePrompt,
    );
    if (round === maxRounds) break;
    if (data.project.settings.validatorStrictness === "off" && maxRounds === 0) break;

    const previous = data.scenes.find((item) => item.n === n - 1) ?? null;
    const user = `PROJECT SETTINGS:
${JSON.stringify(data.project.settings)}

CURRENT SCENE:
${JSON.stringify(scene, null, 2)}

PREVIOUS SCENE:
${previous ? JSON.stringify(previous, null, 2) : "(none)"}

ASSEMBLED PROMPT:
${built.prompt}

DETERMINISTIC CHECK RESULTS:
${issues.length ? issues.map((issue) => `- [${issue.severity}] ${issue.message}`).join("\n") : "(clean)"}

Return the validation JSON.`;

    let result;
    try {
      result = await chatJSON({
        role: "validator",
        schema: validatorResultSchema,
        temperature: 0.1,
        models,
        messages: [
          { role: "system", content: VALIDATOR_SYSTEM },
          { role: "user", content: user },
        ],
      });
    } catch (error) {
      await versionOnly(projectId, n, [
        ...issues.map((issue) => issue.message),
        `LLM validator failed: ${error instanceof Error ? error.message : String(error)}`,
      ]);
      return {
        status: hasErrors(issues) ? "needs_attention" : "ready",
        reasons: [
          ...issues.map((issue) => issue.message),
          `LLM validator failed: ${error instanceof Error ? error.message : String(error)}`,
        ],
      };
    }

    if (!result.ok || result.edits.length) {
      const patch = applySceneFieldEdits(data, scene, result.edits);
      if (Object.keys(patch).length) {
        repo.updateScene(projectId, n, patch);
        continue;
      }
    }
    break;
  }

  const data = repo.getProjectData(projectId);
  const finalScene = data.scenes.find((item) => item.n === n);
  if (!finalScene) throw new PipelineError(`Scene ${n} disappeared`, 500);
  const built = assembleScene(data, finalScene);
  const finalIssues = deterministicChecksForScene(
    data,
    finalScene,
    built.prompt,
    built.imagePrompt,
  );
  const status = hasErrors(finalIssues) ? "needs_attention" : "ready";
  repo.addPromptVersion(projectId, n, {
    text: built.prompt,
    imagePrompt: built.imagePrompt,
    reinforcements: finalScene.prompt?.reinforcements ?? [],
  });
  repo.updateScene(projectId, n, {
    status,
    reasons: finalIssues.map((issue) => issue.message),
  });
  return { status, reasons: finalIssues.map((issue) => issue.message) };
}

async function versionOnly(projectId: string, n: number, reasons: string[]) {
  const repo = getRepo();
  const data = repo.getProjectData(projectId);
  const scene = data.scenes.find((item) => item.n === n);
  if (!scene) return;
  const built = assembleScene(data, scene);
  repo.addPromptVersion(projectId, n, {
    text: built.prompt,
    imagePrompt: built.imagePrompt,
    reinforcements: scene.prompt?.reinforcements ?? [],
  });
  repo.updateScene(projectId, n, {
    status: reasons.length ? "needs_attention" : "ready",
    reasons,
  });
}

export async function versionSceneNow(projectId: string, n: number) {
  const repo = getRepo();
  const data = repo.getProjectData(projectId);
  const scene = data.scenes.find((item) => item.n === n);
  if (!scene) throw new PipelineError(`Scene ${n} not found`, 404);
  const built = assembleScene(data, scene);
  const issues = deterministicChecksForScene(
    data,
    scene,
    built.prompt,
    built.imagePrompt,
  );
  const prompt = repo.addPromptVersion(projectId, n, {
    text: built.prompt,
    imagePrompt: built.imagePrompt,
    reinforcements: scene.prompt?.reinforcements ?? [],
  });
  repo.updateScene(projectId, n, {
    status: hasErrors(issues) ? "needs_attention" : "ready",
    reasons: issues.map((issue) => issue.message),
  });
  return { prompt, issues };
}

/** Rebuild every prompt after a lock/rule change. No re-planning. */
export function reassembleAll(projectId = DEFAULT_PROJECT_ID): number {
  const repo = getRepo();
  const data = repo.getProjectData(projectId);
  let changed = 0;
  for (const scene of data.scenes) {
    const built = assembleScene(data, scene, {
      reinforcements: scene.prompt?.reinforcements ?? [],
    });
    if (scene.prompt?.text === built.prompt) continue;
    repo.addPromptVersion(projectId, scene.n, {
      text: built.prompt,
      imagePrompt: built.imagePrompt,
      reinforcements: scene.prompt?.reinforcements ?? [],
    });
    changed += 1;
  }
  return changed;
}

export async function generateKeyframe(projectId: string, n: number) {
  const repo = getRepo();
  const data = repo.getProjectData(projectId);
  const scene = data.scenes.find((item) => item.n === n);
  if (!scene) throw new PipelineError(`Scene ${n} not found`, 404);
  const imagePrompt = assembleImagePrompt(data, scene);
  const provider = getImageProvider(data.project.settings);
  const image = await provider.generate(
    imagePrompt,
    data.project.settings.aspectRatio,
  );
  const rel = saveAsset(
    projectId,
    "keyframes",
    `scene-${n}-${stamp()}.${image.ext}`,
    image.buffer,
  );
  repo.updateScene(projectId, n, { keyframePath: rel });
  return { path: rel, note: image.note };
}

export function addRule(projectId: string, text: string) {
  const repo = getRepo();
  if (!text.trim()) throw new PipelineError("Rule text is empty.");
  const rule = repo.addRule(projectId, text.trim());
  const changed = reassembleAll(projectId);
  return { rule, changedScenes: changed };
}

export function removeRule(projectId: string, id: number) {
  const repo = getRepo();
  repo.deleteRule(projectId, id);
  return { changedScenes: reassembleAll(projectId) };
}

export function chainToNext(projectId: string, n: number) {
  const repo = getRepo();
  const scene = repo.getScene(projectId, n);
  if (!scene) throw new PipelineError(`Scene ${n} not found`, 404);
  if (!scene.lastFramePath) {
    throw new PipelineError("Extract or upload the last frame first.");
  }
  const next = repo.getScene(projectId, n + 1);
  if (!next) throw new PipelineError("This is the last scene.", 409);
  repo.updateScene(projectId, next.n, {
    startFramePath: scene.lastFramePath,
    chainedFrom: n,
  });
  reassembleAll(projectId);
  return repo.getScene(projectId, next.n);
}

export function sceneStatusCounts(scenes: SceneRecord[], settings: Settings) {
  return {
    total: scenes.length,
    done: scenes.filter((scene) => scene.status === "done").length,
    effectiveLengthSeconds: scenes.length * settings.clipSeconds,
  };
}
