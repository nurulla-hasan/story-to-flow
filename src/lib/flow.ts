import { exec } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import { getRepo } from "./db";
import { assetExists, resolveAsset, saveAsset, stamp } from "./files";
import type { JobRecord } from "./types";

const execAsync = promisify(exec);

export interface FlowStatus {
  connected: boolean;
  bridge: string;
  extensionConnected: boolean;
  loggedIn: boolean | null;
  plan: string | null;
  message: string;
}

export async function getFlowStatus(): Promise<FlowStatus> {
  try {
    const { stdout } = await execAsync("flow-auto status --site flow --json", {
      timeout: 10_000,
    });
    const parsed = JSON.parse(stdout) as {
      bridge?: string;
      extensionConnected?: boolean;
      loggedIn?: boolean | null;
      plan?: string | null;
    };
    const extensionConnected = Boolean(parsed.extensionConnected);
    const connected = parsed.bridge === "up" && extensionConnected;
    let message = "Flow Connector extension not connected.";
    if (!extensionConnected) {
      message = "Open flow.google.com in Chrome or Edge with Flow Connector extension enabled.";
    } else if (parsed.loggedIn === false) {
      message = "Log in to your Google account on flow.google.com.";
    } else {
      message = `Connected (${parsed.plan || "Free"} plan). Ready to generate clips!`;
    }
    return {
      connected,
      bridge: parsed.bridge || "down",
      extensionConnected,
      loggedIn: parsed.loggedIn ?? null,
      plan: parsed.plan ?? null,
      message,
    };
  } catch (error) {
    return {
      connected: false,
      bridge: "down",
      extensionConnected: false,
      loggedIn: null,
      plan: null,
      message: `flow-auto check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

interface FlowJobDetail {
  id: string;
  status: "queued" | "running" | "downloading" | "done" | "failed";
  files?: Array<{ path: string; kind: string }>;
  error?: string;
}

export async function startFlowVideoGeneration(
  projectId: string,
  n: number,
  options: { model?: string } = {},
): Promise<JobRecord> {
  const repo = getRepo();
  const data = repo.getProjectData(projectId);
  const scene = data.scenes.find((s) => s.n === n);
  if (!scene) {
    throw new Error(`Scene ${n} not found`);
  }

  // Ensure prompt exists
  let promptText = scene.prompt?.text;
  if (!promptText) {
    const { versionSceneNow } = await import("./pipeline");
    const result = await versionSceneNow(projectId, n);
    promptText = result.prompt.text;
  }

  // Check start frame conditioning (Pixel-perfect continuity from scene n-1)
  let startImageRelPath: string | null = null;
  if (scene.startFramePath && assetExists(scene.startFramePath)) {
    startImageRelPath = scene.startFramePath;
  } else if (scene.chain_from_previous && n > 1) {
    const prevScene = data.scenes.find((s) => s.n === n - 1);
    if (prevScene?.lastFramePath && assetExists(prevScene.lastFramePath)) {
      startImageRelPath = prevScene.lastFramePath;
      repo.updateScene(projectId, n, {
        startFramePath: prevScene.lastFramePath,
        chainedFrom: prevScene.n,
      });
    }
  }

  let startImagePath: string | null = null;
  if (startImageRelPath) {
    try {
      startImagePath = resolveAsset(startImageRelPath);
    } catch {
      startImagePath = null;
    }
  }

  const model = options.model || (startImagePath ? "omni-flash" : "omni-flash");
  const duration = data.project.settings.clipSeconds;
  const aspectRatio = data.project.settings.aspectRatio;

  // Build CLI command
  const mode = startImagePath ? "flow-frame-to-video" : "flow-text-to-video";
  const args = [
    "flow-auto",
    "generate",
    "create",
    mode,
    `--prompt ${JSON.stringify(promptText)}`,
    `--model ${model}`,
    `--duration ${duration}`,
    `--aspect-ratio ${aspectRatio}`,
    "--json",
  ];

  if (startImagePath && fs.existsSync(/*turbopackIgnore: true*/ startImagePath)) {
    args.push(`--image ${JSON.stringify(startImagePath)}`);
  }

  const cmd = args.join(" ");
  console.info(`[flow-auto] Executing command for scene ${n}:`, cmd);

  const job = repo.createJob(projectId, "flow-generate");
  repo.updateJob(job.id, {
    progress: 5,
    message: `Submitting scene ${n} to Google Flow (${mode})...`,
  });

  void runFlowGeneration(job.id, projectId, n, cmd, startImagePath !== null).catch((err) => {
    repo.updateJob(job.id, {
      status: "error",
      error: err instanceof Error ? err.message : String(err),
      message: "Flow generation failed",
    });
  });

  return job;
}

async function runFlowGeneration(
  jobId: string,
  projectId: string,
  n: number,
  cmd: string,
  hasStartFrame: boolean,
): Promise<void> {
  const repo = getRepo();

  let createStdout: string;
  try {
    const res = await execAsync(cmd, { timeout: 60_000 });
    createStdout = res.stdout;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to submit job to flow-auto: ${msg}`);
  }

  let flowJobId: string | null = null;
  try {
    const parsed = JSON.parse(createStdout) as { id?: string } | Array<{ id?: string }>;
    if (Array.isArray(parsed) && parsed[0]?.id) flowJobId = parsed[0].id;
    else if (!Array.isArray(parsed) && parsed.id) flowJobId = parsed.id;
  } catch {
    const match = createStdout.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
    if (match) flowJobId = match[0];
  }

  if (!flowJobId) {
    throw new Error(`flow-auto did not return a job ID. Output: ${createStdout.slice(0, 300)}`);
  }

  repo.updateJob(jobId, {
    progress: 15,
    message: `Job ${flowJobId.slice(0, 8)} in flight on Google Flow${hasStartFrame ? " (chained with start frame)" : ""}…`,
  });

  // Poll until finished (timeout after 15 minutes)
  const maxPolls = 180;
  for (let poll = 0; poll < maxPolls; poll += 1) {
    await new Promise((r) => setTimeout(r, 5000));

    let statusOutput: string;
    try {
      const res = await execAsync(`flow-auto generate get ${flowJobId} --json`, {
        timeout: 15_000,
      });
      statusOutput = res.stdout;
    } catch {
      continue;
    }

    let detail: FlowJobDetail;
    try {
      detail = JSON.parse(statusOutput) as FlowJobDetail;
    } catch {
      continue;
    }

    if (detail.status === "failed") {
      throw new Error(`Flow generation failed: ${detail.error || "Generation rejected by Flow"}`);
    }

    if (detail.status === "running") {
      const prog = Math.min(85, 20 + poll * 2);
      repo.updateJob(jobId, {
        progress: prog,
        message: `Google Flow is rendering Scene ${n} (${detail.status})…`,
      });
    }

    if (detail.status === "downloading") {
      repo.updateJob(jobId, {
        progress: 90,
        message: "Downloading generated clip…",
      });
    }

    if (detail.status === "done") {
      const filePath = detail.files?.[0]?.path;
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error("Job completed but video file was not found on disk.");
      }

      // Read video file and save to data/files/
      const buffer = fs.readFileSync(filePath);
      const relPath = saveAsset(
        projectId,
        "clips",
        `scene-${n}-${stamp()}.mp4`,
        buffer,
      );

      // Update scene with clip path and mark ready
      repo.updateScene(projectId, n, {
        clipPath: relPath,
        status: "ready",
      });

      repo.updateJob(jobId, {
        status: "done",
        progress: 100,
        message: `Scene ${n} clip generated successfully in Google Flow!`,
        result: { clipPath: relPath, flowJobId },
      });
      return;
    }
  }

  throw new Error("Flow generation timed out after 15 minutes.");
}
