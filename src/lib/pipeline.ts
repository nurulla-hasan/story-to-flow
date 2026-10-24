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
  type CharacterRecord,
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
- a character or creature appearing, acting, emerging, or speaking in the scene but missing from the "characters" list (must add to characters)
- chaining from the previous scene when previous characters were dropped or omitted in this scene without exiting (must set chain_from_previous to false)
- a character described as already in place when chained from an empty establishing shot (must enter or emerge into frame instead)
- camera jumping between wide and close-up in a static chained shot (change chain_from_previous to false or add camera push)
- speaking character facing away from camera during dialogue
- dialogue that anticipates or reacts to an action that hasn't happened yet or happened in a different scene
- omitting a character's dynamic visual feature shift (such as eye LED light colors turning red or mud splatters) described in the story
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

const jobControllers = new Map<string, AbortController>();

export function cancelJob(jobId: string) {
  const repo = getRepo();
  const controller = jobControllers.get(jobId);
  if (controller) {
    controller.abort();
    jobControllers.delete(jobId);
  }
  const job = repo.getJob(jobId);
  if (!job) return null;
  if (job.status === "running") {
    return repo.updateJob(jobId, {
      status: "cancelled",
      message: "Job cancelled by user",
    });
  }
  return job;
}

export class PipelineError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function buildBible(
  projectId = DEFAULT_PROJECT_ID,
  options: { preserveScenes?: boolean } = {},
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

  if (data.scenes.length > 0) {
    if (options.preserveScenes === false) {
      repo.replaceScenes(projectId, []);
    } else {
      // Preserve scenes and update their prompts with the fresh character & location locks
      reassembleAll(projectId);
    }
  }
  return bible;
}

export function startBibleJob(
  projectId = DEFAULT_PROJECT_ID,
  options: { preserveScenes?: boolean } = {},
) {
  const repo = getRepo();
  const data = repo.getProjectData(projectId);
  if (!data.project.story.trim()) {
    throw new PipelineError("Paste a story before creating the story bible.");
  }

  // Gracefully auto-cancel any currently running job
  const running = repo.getLastJob(projectId);
  if (running?.status === "running") {
    const prevController = jobControllers.get(running.id);
    if (prevController) {
      prevController.abort();
      jobControllers.delete(running.id);
    }
    repo.updateJob(running.id, {
      status: "cancelled",
      message: "Superseded by new request",
    });
  }

  const controller = new AbortController();
  const job = repo.createJob(projectId, "bible");
  repo.updateJob(job.id, {
    progress: 10,
    message: "Reading story, locking characters, dress, voice and locations…",
  });
  jobControllers.set(job.id, controller);

  void runBibleJob(job.id, projectId, controller.signal, options)
    .catch((error) => {
      if (controller.signal.aborted) {
        repo.updateJob(job.id, {
          status: "cancelled",
          message: "Bible creation cancelled",
        });
        return;
      }
      repo.updateJob(job.id, {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        message: "Bible creation failed",
      });
    })
    .finally(() => {
      jobControllers.delete(job.id);
    });

  return job;
}

async function runBibleJob(
  jobId: string,
  projectId: string,
  signal: AbortSignal,
  options: { preserveScenes?: boolean } = {},
): Promise<Bible> {
  const repo = getRepo();
  let progress = 15;

  const ticker = setInterval(() => {
    if (progress < 85) {
      progress += 4;
      repo.updateJob(jobId, {
        progress,
        message: "Reading story, locking characters, dress, voice and locations…",
      });
    }
  }, 600);

  let bible: Bible;
  try {
    const data = repo.getProjectData(projectId);
    bible = await generateBible(data, data.project.settings.models, signal);
  } catch (error) {
    clearInterval(ticker);
    if (signal.aborted) {
      repo.updateJob(jobId, {
        status: "cancelled",
        message: "Bible creation cancelled",
      });
      throw error;
    }
    throw error;
  } finally {
    clearInterval(ticker);
  }

  if (signal.aborted) {
    repo.updateJob(jobId, {
      status: "cancelled",
      message: "Bible creation cancelled",
    });
    throw new Error("Cancelled");
  }

  repo.updateJob(jobId, {
    progress: 88,
    message: "Saving visual & voice locks to database…",
  });

  repo.updateProject(projectId, {
    name: bible.title,
    styleLock: bible.style_lock,
  });
  repo.replaceBible(projectId, bible);

  const data = repo.getProjectData(projectId);
  if (data.scenes.length > 0) {
    if (options.preserveScenes === false) {
      repo.replaceScenes(projectId, []);
    } else {
      repo.updateJob(jobId, {
        progress: 95,
        message: "Updating scene prompts with new locks…",
      });
      reassembleAll(projectId);
    }
  }

  repo.updateJob(jobId, {
    status: "done",
    progress: 100,
    message: `Locked ${bible.characters.length} characters and ${bible.locations.length} locations.`,
    result: { bible },
  });

  return bible;
}

export function startFullPlanJob(projectId = DEFAULT_PROJECT_ID) {
  const repo = getRepo();
  const data = repo.getProjectData(projectId);
  if (!data.project.story.trim()) {
    throw new PipelineError("Paste a story before generating the production plan.");
  }

  const running = repo.getLastJob(projectId);
  if (running?.status === "running") {
    const prevController = jobControllers.get(running.id);
    if (prevController) {
      prevController.abort();
      jobControllers.delete(running.id);
    }
    repo.updateJob(running.id, {
      status: "cancelled",
      message: "Superseded by new request",
    });
  }

  const controller = new AbortController();
  const job = repo.createJob(projectId, "full_plan");
  repo.updateJob(job.id, {
    progress: 8,
    message: "Step 1/2: Reading story and locking characters, dress & locations…",
  });
  jobControllers.set(job.id, controller);

  void runFullPlanJob(job.id, projectId, controller.signal)
    .catch((error) => {
      if (controller.signal.aborted) {
        repo.updateJob(job.id, {
          status: "cancelled",
          message: "Full plan generation cancelled",
        });
        return;
      }
      repo.updateJob(job.id, {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        message: "Full plan generation failed",
      });
    })
    .finally(() => {
      jobControllers.delete(job.id);
    });

  return job;
}

async function runFullPlanJob(
  jobId: string,
  projectId: string,
  signal: AbortSignal,
): Promise<void> {
  const repo = getRepo();
  let progress = 10;

  const ticker = setInterval(() => {
    if (progress < 32) {
      progress += 2;
      repo.updateJob(jobId, {
        progress,
        message: "Step 1/2: Reading story and locking characters, dress & locations…",
      });
    }
  }, 600);

  let bible: Bible;
  try {
    const data = repo.getProjectData(projectId);
    bible = await generateBible(data, data.project.settings.models, signal);
  } catch (error) {
    clearInterval(ticker);
    if (signal.aborted) {
      repo.updateJob(jobId, {
        status: "cancelled",
        message: "Full plan generation cancelled",
      });
      return;
    }
    throw error;
  } finally {
    clearInterval(ticker);
  }

  if (signal.aborted) {
    repo.updateJob(jobId, {
      status: "cancelled",
      message: "Full plan generation cancelled",
    });
    return;
  }

  repo.updateJob(jobId, {
    progress: 35,
    message: `Step 1/2 complete: ${bible.characters.length} characters locked. Moving to scene planning…`,
  });

  repo.updateProject(projectId, {
    name: bible.title,
    styleLock: bible.style_lock,
  });
  repo.replaceBible(projectId, bible);
  repo.replaceScenes(projectId, []);

  // Step 2: Scene planning continues seamlessly from 35% to 100%
  await runPlanJob(jobId, projectId, signal, 35);
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

  // Gracefully auto-cancel any previously running/stuck job instead of blocking user with 409
  const running = repo.getLastJob(projectId);
  if (running?.status === "running") {
    const prevController = jobControllers.get(running.id);
    if (prevController) {
      prevController.abort();
      jobControllers.delete(running.id);
    }
    repo.updateJob(running.id, {
      status: "cancelled",
      message: "Superseded by new planning request",
    });
  }

  const controller = new AbortController();
  const job = repo.createJob(projectId, "plan");
  repo.updateJob(job.id, {
    progress: 10,
    message: "Initializing scene planner...",
  });
  jobControllers.set(job.id, controller);

  void runPlanJob(job.id, projectId, controller.signal)
    .catch((error) => {
      if (controller.signal.aborted) {
        repo.updateJob(job.id, {
          status: "cancelled",
          message: "Scene planning cancelled",
        });
        return;
      }
      repo.updateJob(job.id, {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        message: "Scene planning failed",
      });
    })
    .finally(() => {
      jobControllers.delete(job.id);
    });

  return job;
}

async function runPlanJob(
  jobId: string,
  projectId: string,
  signal?: AbortSignal,
  startProgressOffset = 0,
): Promise<void> {
  const repo = getRepo();
  const first = repo.getProjectData(projectId);
  const settings = first.project.settings;
  const total = Math.max(
    1,
    Math.ceil((settings.totalMinutes * 60) / settings.clipSeconds),
  );
  const batchSize = 5;
  let planned: Scene[] = [];
  const warnings: string[] = [];

  const availableRange = 100 - startProgressOffset;
  const planRange = availableRange * 0.65;

  const isAuto = settings.sceneCountMode === "auto";

  if (isAuto) {
    const baseProgress = startProgressOffset + 10;
    let currentProgress = baseProgress;
    repo.updateJob(jobId, {
      progress: currentProgress,
      message: "Analyzing story narrative and pacing scenes naturally…",
    });

    const ticker = setInterval(() => {
      if (currentProgress < startProgressOffset + 58) {
        currentProgress += 2;
        repo.updateJob(jobId, {
          progress: currentProgress,
          message: "Analyzing story narrative and pacing scenes naturally…",
        });
      }
    }, 600);

    let batch: Scene[];
    try {
      batch = await planSceneBatch({
        data: first,
        startN: 1,
        isAuto: true,
        previousScenes: [],
        models: settings.models,
        signal,
      });
    } catch (error) {
      clearInterval(ticker);
      if (signal?.aborted) {
        repo.updateJob(jobId, {
          status: "cancelled",
          message: "Scene planning cancelled",
        });
        return;
      }
      throw new Error(
        `Scene planning failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      clearInterval(ticker);
    }

    if (signal?.aborted) {
      repo.updateJob(jobId, {
        status: "cancelled",
        message: "Scene planning cancelled",
      });
      return;
    }

    planned = sanitizeScenePlan(first, batch).scenes;
    repo.replaceScenes(projectId, planned);
  } else {
    for (let offset = 0; offset < total; offset += batchSize) {
      if (signal?.aborted) {
        repo.updateJob(jobId, {
          status: "cancelled",
          message: "Scene planning cancelled",
        });
        return;
      }

      const count = Math.min(batchSize, total - offset);
      const startN = offset + 1;
      const baseProgress = startProgressOffset + Math.max(8, Math.round((offset / total) * planRange));
      const targetBatchProgress = startProgressOffset + Math.round(((offset + count) / total) * planRange);

      let currentProgress = baseProgress;
      repo.updateJob(jobId, {
        progress: currentProgress,
        message: `Writing scenes ${startN}–${startN + count - 1} of ${total}…`,
      });

      const data = repo.getProjectData(projectId);
      const previous = planned.slice(-2).map((scene) => canonicalScene(scene));

      // Dynamic ticker to increment progress while LLM generates the batch
      const ticker = setInterval(() => {
        if (currentProgress < targetBatchProgress - 2) {
          currentProgress += 2;
          repo.updateJob(jobId, {
            progress: currentProgress,
            message: `Writing scenes ${startN}–${startN + count - 1} of ${total}…`,
          });
        }
      }, 600);

      let batch: Scene[];
      try {
        batch = await planSceneBatch({
          data,
          startN,
          count,
          totalScenes: total,
          previousScenes: previous,
          models: settings.models,
          signal,
        });
      } catch (error) {
        clearInterval(ticker);
        if (signal?.aborted) {
          repo.updateJob(jobId, {
            status: "cancelled",
            message: "Scene planning cancelled",
          });
          return;
        }
        throw new Error(
          `Scene planning failed at batch starting ${startN}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      } finally {
        clearInterval(ticker);
      }

      if (signal?.aborted) {
        repo.updateJob(jobId, {
          status: "cancelled",
          message: "Scene planning cancelled",
        });
        return;
      }

      currentProgress = targetBatchProgress;
      repo.updateJob(jobId, {
        progress: currentProgress,
        message: `Completed scenes ${startN}–${startN + count - 1}…`,
      });

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
            signal,
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
  }

  if (signal?.aborted) {
    repo.updateJob(jobId, {
      status: "cancelled",
      message: "Scene planning cancelled",
    });
    return;
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

  const assembleBase = startProgressOffset + planRange;
  const assembleRange = 100 - assembleBase - 2;

  for (let index = 0; index < data.scenes.length; index += 1) {
    if (signal?.aborted) {
      repo.updateJob(jobId, {
        status: "cancelled",
        message: "Scene planning cancelled",
      });
      return;
    }

    const scene = data.scenes[index];
    const assembleProgress = Math.round(assembleBase + ((index + 1) / data.scenes.length) * assembleRange);
    repo.updateJob(jobId, {
      progress: assembleProgress,
      message:
        rounds === 0
          ? `Assembling prompt for Scene ${scene.n} of ${data.scenes.length}…`
          : `Validating Scene ${scene.n} of ${data.scenes.length}…`,
    });
    try {
      const result = await validateAndVersionScene(projectId, scene.n, rounds, signal);
      if (result.status === "needs_attention") {
        warnings.push(`Scene ${scene.n}: ${result.reasons.join("; ")}`);
      }
    } catch (error) {
      if (signal?.aborted) {
        repo.updateJob(jobId, {
          status: "cancelled",
          message: "Scene planning cancelled",
        });
        return;
      }
      await versionOnly(projectId, scene.n, [
        `Validation skipped: ${error instanceof Error ? error.message : String(error)}`,
      ]);
      warnings.push(
        `Scene ${scene.n}: validator failed (${error instanceof Error ? error.message : String(error)}).`,
      );
    }
  }

  if (signal?.aborted) {
    repo.updateJob(jobId, {
      status: "cancelled",
      message: "Scene planning cancelled",
    });
    return;
  }

  repo.updateJob(jobId, {
    status: "done",
    progress: 100,
    message: `Planned ${planned.length} scenes.`,
    result: { scenes: planned.length, warnings },
  });
}

export function isExtremeShotJump(prevShot: string, currentShot: string): boolean {
  const p = (prevShot || "").toLowerCase();
  const c = (currentShot || "").toLowerCase();
  const isWide = p.includes("wide");
  const isClose = c.includes("close");
  const wasClose = p.includes("close");
  const isNowWide = c.includes("wide");
  return (isWide && isClose) || (wasClose && isNowWide);
}

export function isTimeOfDayMismatch(state1: string, state2: string): boolean {
  const nightWords = /\b(night|midnight|twilight|dusk|evening|dark)\b/i;
  const dayWords = /\b(morning|daylight|bright sun|midday|noon|afternoon|sunrise)\b/i;
  const s1IsNight = nightWords.test(state1);
  const s1IsDay = dayWords.test(state1);
  const s2IsNight = nightWords.test(state2);
  const s2IsDay = dayWords.test(state2);
  return (s1IsNight && s2IsDay) || (s1IsDay && s2IsNight);
}

export function didCharacterExit(action: string, endState: string): boolean {
  const exitWords = /\b(exits?|walks? off|leaves?|runs? off|disappears?|walks? away|out of frame)\b/i;
  return exitWords.test(action || "") || exitWords.test(endState || "");
}

export function detectReferencedCharacters(
  scene: { action: string; start_state: string; end_state: string; dialogue?: { speaker: string; line: string } | null },
  characters: CharacterRecord[],
): string[] {
  const combined = [
    scene.action,
    scene.start_state,
    scene.end_state,
    scene.dialogue?.speaker ?? "",
    scene.dialogue?.line ?? "",
  ].join(" ").toLowerCase();

  const detected: string[] = [];
  for (const c of characters) {
    const idRegex = new RegExp(`\\b${c.id}\\b`, "i");
    const nameLower = c.name.toLowerCase();
    if (idRegex.test(combined) || combined.includes(nameLower)) {
      detected.push(c.id);
    }
  }
  return detected;
}

export function ensureCharacterEntersFrame(action: string, characterIds: string[]): string {
  if (!characterIds.length) return action;

  let modified = action;
  const entersRegex = /\b(enters?|walks?|steps?|comes?|runs?|approaches?|moves?)\s+(into|in|onto|from|the|frame|shot|scene)\b/i;

  if (!entersRegex.test(modified)) {
    const mainChar = characterIds[0];
    const startsWithChar = new RegExp(`^${mainChar}\\b\\s*`, "i");
    if (startsWithChar.test(modified)) {
      const stripped = modified.replace(startsWithChar, "").trim();
      modified = `${mainChar} enters the frame and ${stripped}`;
    } else {
      modified = `${mainChar} enters the frame; ${modified}`;
    }
  }

  // If there are other characters in characterIds described as static in an empty-origin shot, adjust their reveal
  for (let i = 1; i < characterIds.length; i++) {
    const charId = characterIds[i];
    const standingRegex = new RegExp(`\\b${charId}\\s+(standing|sitting|waiting|facing)\\b`, "i");
    if (standingRegex.test(modified)) {
      modified = modified.replace(standingRegex, `${charId} emerges and is $1`);
    }
  }

  return modified;
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function pruneTransformedOriginCharacters(
  scene: Scene,
): { characters: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const chars = [...scene.characters];
  const act = scene.action || "";
  const endState = scene.end_state || "";

  for (const c of [...chars]) {
    for (const alt of chars) {
      if (alt === c) continue;
      const isSub = alt.includes(c) || c.includes(alt);
      const replaced =
        new RegExp(`where\\s+${escapeRegex(c)}\\s+was`, "i").test(act) ||
        new RegExp(`revealing\\s+${escapeRegex(alt)}`, "i").test(act) ||
        new RegExp(`${escapeRegex(c)}\\s+transforms?\\s+into\\s+${escapeRegex(alt)}`, "i").test(act);

      // Check if original character is NOT in end_state (standalone slug match)
      const notInEnd = !new RegExp(`(?<![-_\\w])${escapeRegex(c)}(?![-_\\w])`, "i").test(endState);

      if ((isSub || replaced) && notInEnd) {
        const idx = chars.indexOf(c);
        if (idx !== -1) {
          chars.splice(idx, 1);
          warnings.push(
            `Scene ${scene.n}: pruned origin character "${c}" because transformed form "${alt}" is active and "${c}" has been transformed.`,
          );
        }

        // Remap dialogue speaker if it was set to the origin character
        if (scene.dialogue && scene.dialogue.speaker) {
          const speakerTokens = scene.dialogue.speaker.split(/[,&/]/).map((s) => s.trim());
          if (speakerTokens.includes(c)) {
            scene.dialogue.speaker = speakerTokens.map((s) => (s === c ? alt : s)).join(", ");
          }
        }
        break;
      }
    }
  }

  return { characters: chars, warnings };
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

    // Auto-detect any character mentioned in action/state/dialogue who was omitted from scene.characters
    const autoDetected = detectReferencedCharacters(scene, data.characters);
    for (const charId of autoDetected) {
      if (!scene.characters.includes(charId)) {
        scene.characters.push(charId);
        warnings.push(
          `Scene ${scene.n}: character "${charId}" was mentioned in action/dialogue but missing from character list; automatically added.`,
        );
      }
    }

    // Prune transformed origin character when transformed form has taken over (prevents clone paradox)
    const pruned = pruneTransformedOriginCharacters(scene);
    scene.characters = pruned.characters;
    warnings.push(...pruned.warnings);

    const deduped = [...new Set(scene.characters)].filter((id) =>
      knownCharacters.has(id),
    );
    if (deduped.length !== scene.characters.length) {
      warnings.push(`Scene ${scene.n}: removed unknown character ids.`);
    }
    const allowedLimit = Math.max(settings.maxPeople, data.characters.length);
    if (deduped.length > allowedLimit) {
      warnings.push(
        `Scene ${scene.n}: character count (${deduped.length}) exceeded limit (${allowedLimit}); prioritized visible speaker.`,
      );
      const speakerId = scene.dialogue?.speaker;
      if (speakerId && deduped.includes(speakerId)) {
        const others = deduped.filter((id) => id !== speakerId);
        scene.characters = [speakerId, ...others.slice(0, Math.max(1, allowedLimit - 1))];
      } else {
        scene.characters = deduped.slice(0, allowedLimit);
      }
    } else {
      scene.characters = deduped;
    }

    if (!knownLocations.has(scene.location_id) && data.locations[0]) {
      warnings.push(
        `Scene ${scene.n}: unknown location "${scene.location_id}"; using "${data.locations[0].id}".`,
      );
      scene.location_id = data.locations[0].id;
    }

    if (!settings.dialogueEnabled) scene.dialogue = null;
    if (scene.dialogue) {
      const speakerTokens = scene.dialogue.speaker
        .split(/[,&/]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const isVisible = speakerTokens.some((token) => scene.characters.includes(token));
      const isKnown = speakerTokens.some((token) => data.characters.some((c) => c.id === token));
      if (!isVisible && !isKnown) {
        warnings.push(
          `Scene ${scene.n}: dialogue speaker is not visible; dialogue removed.`,
        );
        scene.dialogue = null;
      }
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
      if (scene.n === 1 && (scene.dialogue || scene.characters.length > 0)) {
        scene.is_establishing = false;
      } else {
        scene.dialogue = null;
        scene.chain_from_previous = false;
      }
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

    // Safety check 1: Camera shot scale jump in static chained take (wide <-> close needs movement)
    if (
      scene.chain_from_previous &&
      previous &&
      isExtremeShotJump(previous.camera.shot, scene.camera.shot) &&
      !/push|zoom|dolly|track|move/i.test(scene.camera.movement)
    ) {
      scene.camera.movement = "slow push in";
      warnings.push(
        `Scene ${scene.n}: shot scale jumped from ${previous.camera.shot} to ${scene.camera.shot} while chained; added slow push in camera movement for continuity.`,
      );
    }

    // Safety check 2: Lighting/time-of-day shift between chained scenes
    if (
      scene.chain_from_previous &&
      previous &&
      isTimeOfDayMismatch(previous.end_state, scene.start_state || scene.action)
    ) {
      scene.chain_from_previous = false;
      warnings.push(
        `Scene ${scene.n}: lighting/time-of-day shifted from previous scene; unchained to prevent lighting glitches.`,
      );
    }

    // Safety check 4: Dropped characters in chained take (subset paradox)
    if (
      scene.chain_from_previous &&
      previous &&
      previous.characters.length > 0 &&
      !previous.is_establishing
    ) {
      const droppedChars = previous.characters.filter((id) => !scene.characters.includes(id));
      const prevExited = didCharacterExit(previous.action, previous.end_state);
      if (droppedChars.length > 0 && !prevExited) {
        scene.chain_from_previous = false;
        warnings.push(
          `Scene ${scene.n}: character(s) [${droppedChars.join(", ")}] from Scene ${previous.n} are omitted without exiting; unchained to prevent character vanishing paradox.`,
        );
      }
    }

    if (scene.chain_from_previous && previous) {
      scene.start_state = previous.end_state;
      const prevHadNoChars = previous.characters.length === 0 || previous.is_establishing;
      const prevExited = didCharacterExit(previous.action, previous.end_state);
      if ((prevHadNoChars || prevExited) && scene.characters.length > 0) {
        scene.action = ensureCharacterEntersFrame(scene.action, scene.characters);
      }
    }

    // Safety check 3: Dialogue speaker facing away from camera
    if (scene.dialogue && /\b(facing away|from behind|back to camera|facing back)\b/i.test(scene.camera.angle)) {
      scene.camera.angle = "eye level";
      warnings.push(
        `Scene ${scene.n}: speaking character was facing away; adjusted camera angle to eye level for lip-sync.`,
      );
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
  signal?: AbortSignal,
): Promise<{ status: "ready" | "needs_attention"; reasons: string[] }> {
  const repo = getRepo();
  let scene = repo.getScene(projectId, n);
  if (!scene) throw new PipelineError(`Scene ${n} not found`, 404);
  const models = repo.getProject(projectId).settings.models;

  for (let round = 0; round <= maxRounds; round += 1) {
    if (signal?.aborted) {
      throw new Error("Validation cancelled");
    }
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
        signal,
        messages: [
          { role: "system", content: VALIDATOR_SYSTEM },
          { role: "user", content: user },
        ],
      });
    } catch (error) {
      if (signal?.aborted) throw error;
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
