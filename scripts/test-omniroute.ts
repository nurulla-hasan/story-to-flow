import fs from "node:fs";
import path from "node:path";
import { getEnv } from "../src/lib/env";
import { OmnirouteImageProvider } from "../src/lib/image";
import { tryParseJson } from "../src/lib/llm";

/**
 * T0 probe. Run: pnpm omniroute:test
 * Tests every configured text model with (1) a one-line Bangla reply,
 * (2) JSON-only output, and (3) the image attempt. Prints a table and writes
 * tasks/omniroute-results.md. Never throws if the gateway is down.
 */

interface Result {
  model: string;
  test: string;
  ok: boolean;
  latencyMs: number;
  notes: string;
}

const results: Result[] = [];
const env = getEnv();

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = Date.now();
  const value = await fn();
  return { value, ms: Date.now() - start };
}

async function rawChat(model: string, content: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.apiKey) headers.Authorization = `Bearer ${env.apiKey}`;
  const res = await fetch(`${env.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      temperature: 0.1,
      stream: false,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  const parsed = tryParseJson(text) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | undefined;
  const reply = parsed?.choices?.[0]?.message?.content;
  if (typeof reply !== "string") {
    throw new Error(`no message content: ${text.slice(0, 200)}`);
  }
  return reply;
}

async function testText(model: string, label: string) {
  // 1. Bangla one-liner
  try {
    const { value, ms } = await timed(() =>
      rawChat(model, "এক বাক্যে বাংলায় বলো: নদীর ঘাটে সকালবেলা কেমন দেখায়?"),
    );
    results.push({
      model,
      test: `${label}: Bangla text`,
      ok: /[\u0980-\u09FF]/.test(value),
      latencyMs: ms,
      notes: value.replace(/\s+/g, " ").slice(0, 100),
    });
  } catch (error) {
    results.push({
      model,
      test: `${label}: Bangla text`,
      ok: false,
      latencyMs: 0,
      notes: error instanceof Error ? error.message : String(error),
    });
  }

  // 2. JSON-only
  try {
    const { value, ms } = await timed(() =>
      rawChat(model, 'Return JSON only, exactly {"ok":true,"word":"বাংলা"}.'),
    );
    const parsed = tryParseJson(value) as { ok?: unknown; word?: unknown } | undefined;
    results.push({
      model,
      test: `${label}: JSON only`,
      ok: Boolean(parsed && parsed.ok === true && typeof parsed.word === "string"),
      latencyMs: ms,
      notes: `fences=${value.trim().startsWith("```")}; parsed=${parsed ? "yes" : "no"}; raw=${value.replace(/\s+/g, " ").slice(0, 80)}`,
    });
  } catch (error) {
    results.push({
      model,
      test: `${label}: JSON only`,
      ok: false,
      latencyMs: 0,
      notes: error instanceof Error ? error.message : String(error),
    });
  }
}

async function testImage() {
  const model = env.models.image;
  const provider = new OmnirouteImageProvider(model);
  try {
    const { value, ms } = await timed(() =>
      provider.generate(
        "Cinematic wide keyframe, a young woman in a blue saree standing at a river ghat at sunrise, photorealistic, 16:9",
        "16:9",
      ),
    );
    results.push({
      model,
      test: "image generation",
      ok: value.buffer.length > 500,
      latencyMs: ms,
      notes: `bytes=${value.buffer.length} mime=${value.mime} via ${value.note}`,
    });
    return true;
  } catch (error) {
    results.push({
      model,
      test: "image generation",
      ok: false,
      latencyMs: 0,
      notes: error instanceof Error ? error.message.slice(0, 300) : String(error),
    });
    return false;
  }
}

function printTable() {
  const lines: string[] = [];
  lines.push(
    `| model | test | ok | latency | notes |`,
  );
  lines.push(`| --- | --- | --- | --- | --- |`);
  for (const r of results) {
    lines.push(
      `| ${r.model} | ${r.test} | ${r.ok ? "PASS" : "FAIL"} | ${r.latencyMs} ms | ${r.notes.replace(/\|/g, "/")} |`,
    );
  }
  lines.push("");
  lines.push(`Base URL: ${env.baseUrl}`);
  lines.push(`API key present: ${env.apiKey ? "yes" : "no"}`);
  console.log(lines.join("\n"));
  return lines.join("\n");
}

async function main() {
  console.log(`Probing OmniRoute at ${env.baseUrl} …\n`);
  const textModels: Array<[string, string]> = [
    [env.models.planner, "planner"],
    [env.models.validator, "validator"],
  ];
  const seen = new Set<string>();
  for (const [model, label] of textModels) {
    if (!model || seen.has(model)) continue;
    seen.add(model);
    await testText(model, label);
  }
  if (env.models.fallback && !seen.has(env.models.fallback)) {
    await testText(env.models.fallback, "fallback");
  }
  const imageOk = await testImage();

  const table = printTable();
  const target = path.join(process.cwd(), "tasks", "omniroute-results.md");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    `# OmniRoute probe results\n\n${new Date().toISOString()}\n\n${table}\n\n## Image provider default\n\n\`${imageOk ? "omniroute" : "manual"}\`\n`,
    "utf8",
  );
  console.log(`\nWrote ${target}`);
  console.log(`\nIMAGE PROVIDER DEFAULT: ${imageOk ? "omniroute" : "manual"}`);
  if (!imageOk) {
    console.log(
      "No image came back, so the app defaults to the manual provider (copy prompt, generate in Flow, upload).",
    );
  }
}

void main().catch((error) => {
  console.error("Probe crashed:", error);
  process.exitCode = 1;
});
