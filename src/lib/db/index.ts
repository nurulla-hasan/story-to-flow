import path from "node:path";
import { createRequire } from "node:module";
import type BetterSqlite3 from "better-sqlite3";
import { JsonRepo } from "./json";
import { SqliteRepo } from "./sqlite";
import type { Repo } from "./repo";

let cached: Repo | null = null;

function createRepo(): Repo {
  // On serverless environments (e.g. Vercel), native binaries like better-sqlite3 often fail or aren't compatible
  // Fall back cleanly to JsonRepo which works seamlessly with /tmp storage
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    console.info("[story-to-flow] Vercel/serverless detected: using JsonRepo");
    return new JsonRepo();
  }

  try {
    const nativeRequire = createRequire(path.join(process.cwd(), "package.json"));
    const Database = nativeRequire("better-sqlite3") as typeof BetterSqlite3;
    const repo = new SqliteRepo(Database);
    console.info("[story-to-flow] storage: sqlite");
    return repo;
  } catch (error) {
    console.warn(
      "[story-to-flow] better-sqlite3 unavailable, falling back to JSON store:",
      error instanceof Error ? error.message : error,
    );
    return new JsonRepo();
  }
}

export function getRepo(): Repo {
  if (!cached) cached = createRepo();
  return cached;
}

export { DEFAULT_PROJECT_ID } from "./repo";
export type { Repo, ScenePatch } from "./repo";
