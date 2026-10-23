import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import {
  DEFAULT_SETTINGS,
  newId,
  nowIso,
  settingsSchema,
  type Bible,
  type CharacterRecord,
  type JobRecord,
  type ProjectData,
  type ProjectRecord,
  type PromptVersion,
  type RuleRecord,
  type Scene,
  type SceneRecord,
  type Settings,
  type SettingsPatch,
} from "../types";
import { DATA_DIR, ensureDirs } from "../files";
import {
  locationDisplayName,
  mergeSettings,
  type Repo,
  type ScenePatch,
} from "./repo";

type DatabaseCtor = typeof BetterSqlite3;
type Db = BetterSqlite3.Database;
type Row = Record<string, unknown>;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  story TEXT NOT NULL DEFAULT '',
  style_lock TEXT NOT NULL DEFAULT '',
  settings TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS characters (
  project_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  visual_lock TEXT NOT NULL,
  voice_lock TEXT NOT NULL,
  language TEXT NOT NULL,
  outfit_changes INTEGER NOT NULL DEFAULT 0,
  ref_image TEXT,
  PRIMARY KEY (project_id, id)
);
CREATE TABLE IF NOT EXISTS locations (
  project_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  visual_lock TEXT NOT NULL,
  ref_image TEXT,
  PRIMARY KEY (project_id, id)
);
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  n INTEGER NOT NULL,
  location_id TEXT NOT NULL,
  characters TEXT NOT NULL DEFAULT '[]',
  is_establishing INTEGER NOT NULL DEFAULT 0,
  chain_from_previous INTEGER NOT NULL DEFAULT 1,
  action TEXT NOT NULL DEFAULT '',
  camera TEXT NOT NULL,
  start_state TEXT NOT NULL DEFAULT '',
  end_state TEXT NOT NULL DEFAULT '',
  dialogue TEXT,
  sound TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  reasons TEXT NOT NULL DEFAULT '[]',
  keyframe_path TEXT,
  clip_path TEXT,
  last_frame_path TEXT,
  start_frame_path TEXT,
  chained_from INTEGER,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scenes_project_n ON scenes(project_id, n);
CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  scene_n INTEGER NOT NULL,
  version INTEGER NOT NULL,
  text TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  reinforcements TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS prompts_project_scene ON prompts(project_id, scene_n, version);
CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  error TEXT,
  result TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function bool(value: unknown): boolean {
  return Number(value) === 1;
}

export class SqliteRepo implements Repo {
  readonly kind = "sqlite" as const;
  private db: Db;

  constructor(Database: DatabaseCtor) {
    ensureDirs();
    this.db = new Database(path.join(DATA_DIR, "story-to-flow.db"));
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
    const columns = this.db
      .prepare("PRAGMA table_info(projects)")
      .all() as Row[];
    if (!columns.some((column) => column.name === "style_lock")) {
      this.db.exec("ALTER TABLE projects ADD COLUMN style_lock TEXT NOT NULL DEFAULT ''");
    }
  }

  private ensureProject(projectId: string): ProjectRecord {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(projectId) as Row | undefined;
    if (row) return this.mapProject(row);
    const now = nowIso();
    const project: ProjectRecord = {
      id: projectId,
      name: "Untitled story",
      story: "",
      styleLock: "",
      settings: DEFAULT_SETTINGS,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        "INSERT INTO projects (id, name, story, style_lock, settings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        project.id,
        project.name,
        project.story,
        project.styleLock,
        JSON.stringify(project.settings),
        project.createdAt,
        project.updatedAt,
      );
    return project;
  }

  private mapProject(row: Row): ProjectRecord {
    return {
      id: String(row.id),
      name: String(row.name),
      story: String(row.story ?? ""),
      styleLock: String(row.style_lock ?? ""),
      settings: settingsSchema.parse(parseJson<Partial<Settings>>(row.settings, {})),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private mapCharacter(row: Row): CharacterRecord {
    return {
      id: String(row.id),
      name: String(row.name),
      visual_lock: String(row.visual_lock),
      voice_lock: String(row.voice_lock),
      language: row.language === "en" ? "en" : "bn",
      outfit_changes: bool(row.outfit_changes),
      refImage: row.ref_image ? String(row.ref_image) : null,
    };
  }

  private mapLocation(row: Row) {
    return {
      id: String(row.id),
      name: String(row.name),
      visual_lock: String(row.visual_lock),
      refImage: row.ref_image ? String(row.ref_image) : null,
    };
  }

  private latestPrompt(projectId: string, n: number): PromptVersion | null {
    const row = this.db
      .prepare(
        "SELECT * FROM prompts WHERE project_id = ? AND scene_n = ? ORDER BY version DESC LIMIT 1",
      )
      .get(projectId, n) as Row | undefined;
    if (!row) return null;
    return {
      version: Number(row.version),
      text: String(row.text),
      imagePrompt: String(row.image_prompt),
      reinforcements: parseJson<string[]>(row.reinforcements, []),
      createdAt: String(row.created_at),
    };
  }

  private mapScene(row: Row, projectId: string): SceneRecord {
    return {
      n: Number(row.n),
      location_id: String(row.location_id),
      characters: parseJson<string[]>(row.characters, []),
      is_establishing: bool(row.is_establishing),
      chain_from_previous: bool(row.chain_from_previous),
      action: String(row.action ?? ""),
      camera: parseJson(row.camera, { shot: "", angle: "", movement: "" }),
      start_state: String(row.start_state ?? ""),
      end_state: String(row.end_state ?? ""),
      dialogue: parseJson(row.dialogue, null),
      sound: String(row.sound ?? ""),
      status: (row.status as SceneRecord["status"]) ?? "draft",
      reasons: parseJson<string[]>(row.reasons, []),
      keyframePath: row.keyframe_path ? String(row.keyframe_path) : null,
      clipPath: row.clip_path ? String(row.clip_path) : null,
      lastFramePath: row.last_frame_path ? String(row.last_frame_path) : null,
      startFramePath: row.start_frame_path ? String(row.start_frame_path) : null,
      chainedFrom: row.chained_from === null || row.chained_from === undefined ? null : Number(row.chained_from),
      prompt: this.latestPrompt(projectId, Number(row.n)),
      updatedAt: String(row.updated_at),
    };
  }

  getProject(projectId: string): ProjectRecord {
    return this.ensureProject(projectId);
  }

  getProjectData(projectId: string): ProjectData {
    const project = this.ensureProject(projectId);
    const characters = (
      this.db
        .prepare("SELECT * FROM characters WHERE project_id = ? ORDER BY name COLLATE NOCASE")
        .all(projectId) as Row[]
    ).map((row) => this.mapCharacter(row));
    const locations = (
      this.db
        .prepare("SELECT * FROM locations WHERE project_id = ? ORDER BY id")
        .all(projectId) as Row[]
    ).map((row) => this.mapLocation(row));
    const scenes = (
      this.db
        .prepare("SELECT * FROM scenes WHERE project_id = ? ORDER BY n")
        .all(projectId) as Row[]
    ).map((row) => this.mapScene(row, projectId));
    const rules = (
      this.db
        .prepare("SELECT * FROM rules WHERE project_id = ? ORDER BY id")
        .all(projectId) as Row[]
    ).map((row) => ({
      id: Number(row.id),
      text: String(row.text),
      createdAt: String(row.created_at),
    }));
    return { project, characters, locations, scenes, rules };
  }

  updateProject(
    projectId: string,
    patch: {
      name?: string;
      story?: string;
      styleLock?: string;
      settings?: SettingsPatch;
    },
  ): ProjectRecord {
    const current = this.ensureProject(projectId);
    const next: ProjectRecord = {
      ...current,
      name: patch.name ?? current.name,
      story: patch.story ?? current.story,
      styleLock: patch.styleLock ?? current.styleLock,
      settings: mergeSettings(current.settings, patch.settings),
      updatedAt: nowIso(),
    };
    this.db
      .prepare(
        "UPDATE projects SET name = ?, story = ?, style_lock = ?, settings = ?, updated_at = ? WHERE id = ?",
      )
      .run(
        next.name,
        next.story,
        next.styleLock,
        JSON.stringify(next.settings),
        next.updatedAt,
        projectId,
      );
    return next;
  }

  replaceBible(projectId: string, bible: Bible): void {
    const tx = this.db.transaction(() => {
      this.ensureProject(projectId);
      this.db.prepare("DELETE FROM characters WHERE project_id = ?").run(projectId);
      this.db.prepare("DELETE FROM locations WHERE project_id = ?").run(projectId);
      const charStmt = this.db.prepare(
        "INSERT INTO characters (project_id, id, name, visual_lock, voice_lock, language, outfit_changes, ref_image) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)",
      );
      for (const character of bible.characters) {
        charStmt.run(
          projectId,
          character.id,
          character.name,
          character.visual_lock,
          character.voice_lock,
          character.language,
          character.outfit_changes ? 1 : 0,
        );
      }
      const locStmt = this.db.prepare(
        "INSERT INTO locations (project_id, id, name, visual_lock, ref_image) VALUES (?, ?, ?, ?, NULL)",
      );
      for (const location of bible.locations) {
        locStmt.run(
          projectId,
          location.id,
          locationDisplayName(location.id),
          location.visual_lock,
        );
      }
    });
    tx();
  }

  getCharacters(projectId: string): CharacterRecord[] {
    return this.getProjectData(projectId).characters;
  }

  addCharacter(projectId: string, character: CharacterRecord): void {
    this.ensureProject(projectId);
    this.db
      .prepare(
        "INSERT INTO characters (project_id, id, name, visual_lock, voice_lock, language, outfit_changes, ref_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        projectId,
        character.id,
        character.name,
        character.visual_lock,
        character.voice_lock,
        character.language,
        character.outfit_changes ? 1 : 0,
        character.refImage,
      );
  }

  updateCharacter(projectId: string, id: string, patch: Partial<CharacterRecord>): void {
    const current = this.db
      .prepare("SELECT * FROM characters WHERE project_id = ? AND id = ?")
      .get(projectId, id) as Row | undefined;
    if (!current) throw new Error(`Character "${id}" not found`);
    const merged = { ...this.mapCharacter(current), ...patch };
    this.db
      .prepare(
        "UPDATE characters SET name = ?, visual_lock = ?, voice_lock = ?, language = ?, outfit_changes = ?, ref_image = ? WHERE project_id = ? AND id = ?",
      )
      .run(
        merged.name,
        merged.visual_lock,
        merged.voice_lock,
        merged.language,
        merged.outfit_changes ? 1 : 0,
        merged.refImage,
        projectId,
        id,
      );
  }

  deleteCharacter(projectId: string, id: string): void {
    const tx = this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM characters WHERE project_id = ? AND id = ?")
        .run(projectId, id);
      const rows = this.db
        .prepare("SELECT id, characters FROM scenes WHERE project_id = ?")
        .all(projectId) as Row[];
      for (const row of rows) {
        const list = parseJson<string[]>(row.characters, []).filter((cid) => cid !== id);
        this.db
          .prepare("UPDATE scenes SET characters = ? WHERE id = ?")
          .run(JSON.stringify(list), row.id);
      }
    });
    tx();
  }

  updateLocation(
    projectId: string,
    id: string,
    patch: { visual_lock?: string; refImage?: string | null; name?: string },
  ): void {
    const current = this.db
      .prepare("SELECT * FROM locations WHERE project_id = ? AND id = ?")
      .get(projectId, id) as Row | undefined;
    if (!current) throw new Error(`Location "${id}" not found`);
    const merged = { ...this.mapLocation(current), ...patch };
    this.db
      .prepare(
        "UPDATE locations SET name = ?, visual_lock = ?, ref_image = ? WHERE project_id = ? AND id = ?",
      )
      .run(merged.name, merged.visual_lock, merged.refImage, projectId, id);
  }

  getScenes(projectId: string): SceneRecord[] {
    return this.getProjectData(projectId).scenes;
  }

  getScene(projectId: string, n: number): SceneRecord | null {
    return this.getScenes(projectId).find((scene) => scene.n === n) ?? null;
  }

  replaceScenes(projectId: string, scenes: Scene[]): void {
    const tx = this.db.transaction(() => {
      this.ensureProject(projectId);
      this.db.prepare("DELETE FROM scenes WHERE project_id = ?").run(projectId);
      this.db.prepare("DELETE FROM prompts WHERE project_id = ?").run(projectId);
      const stmt = this.db.prepare(
        `INSERT INTO scenes (id, project_id, n, location_id, characters, is_establishing, chain_from_previous, action, camera, start_state, end_state, dialogue, sound, status, reasons, keyframe_path, clip_path, last_frame_path, start_frame_path, chained_from, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', '[]', NULL, NULL, NULL, NULL, NULL, ?)`,
      );
      const now = nowIso();
      for (const scene of scenes) {
        stmt.run(
          newId(),
          projectId,
          scene.n,
          scene.location_id,
          JSON.stringify(scene.characters),
          scene.is_establishing ? 1 : 0,
          scene.chain_from_previous ? 1 : 0,
          scene.action,
          JSON.stringify(scene.camera),
          scene.start_state,
          scene.end_state,
          scene.dialogue ? JSON.stringify(scene.dialogue) : null,
          scene.sound,
          now,
        );
      }
    });
    tx();
  }

  updateScene(projectId: string, n: number, patch: ScenePatch): void {
    const columns: Record<string, string> = {
      location_id: "location_id",
      characters: "characters",
      is_establishing: "is_establishing",
      chain_from_previous: "chain_from_previous",
      action: "action",
      camera: "camera",
      start_state: "start_state",
      end_state: "end_state",
      dialogue: "dialogue",
      sound: "sound",
      status: "status",
      reasons: "reasons",
      keyframePath: "keyframe_path",
      clipPath: "clip_path",
      lastFramePath: "last_frame_path",
      startFramePath: "start_frame_path",
      chainedFrom: "chained_from",
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [key, value] of Object.entries(patch)) {
      const column = columns[key];
      if (!column) continue;
      sets.push(`${column} = ?`);
      if (
        key === "characters" ||
        key === "camera" ||
        key === "dialogue" ||
        key === "reasons"
      ) {
        values.push(value === null ? null : JSON.stringify(value));
      } else if (key === "is_establishing" || key === "chain_from_previous") {
        values.push(value ? 1 : 0);
      } else {
        values.push(value ?? null);
      }
    }
    if (!sets.length) return;
    sets.push("updated_at = ?");
    values.push(nowIso(), projectId, n);
    const result = this.db
      .prepare(`UPDATE scenes SET ${sets.join(", ")} WHERE project_id = ? AND n = ?`)
      .run(...values);
    if (result.changes === 0) throw new Error(`Scene ${n} not found`);
  }

  splitScene(
    projectId: string,
    n: number,
    first?: Partial<Scene>,
    second?: Partial<Scene>,
  ): void {
    const tx = this.db.transaction(() => {
      const row = this.db
        .prepare("SELECT * FROM scenes WHERE project_id = ? AND n = ?")
        .get(projectId, n) as Row | undefined;
      if (!row) throw new Error(`Scene ${n} not found`);
      const scene = this.mapScene(row, projectId);
      this.db
        .prepare("UPDATE scenes SET n = n + 1 WHERE project_id = ? AND n > ?")
        .run(projectId, n);
      this.db
        .prepare("UPDATE prompts SET scene_n = scene_n + 1 WHERE project_id = ? AND scene_n > ?")
        .run(projectId, n);
      const firstEnd = (first?.end_state as string | undefined) ?? scene.end_state;
      const next: Scene = {
        ...scene,
        ...(second ?? {}),
        n: n + 1,
        start_state: second?.start_state ?? firstEnd,
        action: second?.action ?? scene.action,
      };
      this.db
        .prepare(
          `INSERT INTO scenes (id, project_id, n, location_id, characters, is_establishing, chain_from_previous, action, camera, start_state, end_state, dialogue, sound, status, reasons, keyframe_path, clip_path, last_frame_path, start_frame_path, chained_from, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', '[]', NULL, NULL, NULL, NULL, NULL, ?)`,
        )
        .run(
          newId(),
          projectId,
          next.n,
          next.location_id,
          JSON.stringify(next.characters),
          next.is_establishing ? 1 : 0,
          next.chain_from_previous ? 1 : 0,
          next.action,
          JSON.stringify(next.camera),
          next.start_state,
          next.end_state,
          next.dialogue ? JSON.stringify(next.dialogue) : null,
          next.sound,
          nowIso(),
        );
      this.updateScene(projectId, n, { ...(first ?? {}), end_state: firstEnd });
    });
    tx();
  }

  mergeScenes(projectId: string, n: number, merged?: Partial<Scene>): void {
    const tx = this.db.transaction(() => {
      const rows = this.db
        .prepare("SELECT * FROM scenes WHERE project_id = ? AND n IN (?, ?)")
        .all(projectId, n, n + 1) as Row[];
      const first = rows.find((row) => Number(row.n) === n);
      const second = rows.find((row) => Number(row.n) === n + 1);
      if (!first || !second) throw new Error(`Scenes ${n} and ${n + 1} are required`);
      const one = this.mapScene(first, projectId);
      const two = this.mapScene(second, projectId);
      this.db
        .prepare("UPDATE scenes SET n = n - 1 WHERE project_id = ? AND n > ?")
        .run(projectId, n + 1);
      this.db
        .prepare("DELETE FROM scenes WHERE project_id = ? AND n = ?")
        .run(projectId, n + 1);
      this.db
        .prepare("DELETE FROM prompts WHERE project_id = ? AND scene_n = ?")
        .run(projectId, n + 1);
      this.db
        .prepare("UPDATE prompts SET scene_n = scene_n - 1 WHERE project_id = ? AND scene_n > ?")
        .run(projectId, n + 1);
      this.updateScene(projectId, n, {
        action: merged?.action ?? `${one.action} ${two.action}`,
        start_state: merged?.start_state ?? one.start_state,
        end_state: merged?.end_state ?? two.end_state,
        characters: merged?.characters ?? [...new Set([...one.characters, ...two.characters])],
        dialogue: merged?.dialogue ?? one.dialogue ?? two.dialogue,
        ...(merged ?? {}),
        status: "draft",
      });
    });
    tx();
  }

  deleteScene(projectId: string, n: number): void {
    const tx = this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM scenes WHERE project_id = ? AND n = ?")
        .run(projectId, n);
      this.db
        .prepare("DELETE FROM prompts WHERE project_id = ? AND scene_n = ?")
        .run(projectId, n);
      this.db
        .prepare("UPDATE scenes SET n = n - 1 WHERE project_id = ? AND n > ?")
        .run(projectId, n);
      this.db
        .prepare("UPDATE prompts SET scene_n = scene_n - 1 WHERE project_id = ? AND scene_n > ?")
        .run(projectId, n);
    });
    tx();
  }

  getPromptVersions(projectId: string, n: number): PromptVersion[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM prompts WHERE project_id = ? AND scene_n = ? ORDER BY version DESC",
      )
      .all(projectId, n) as Row[];
    return rows.map((row) => ({
      version: Number(row.version),
      text: String(row.text),
      imagePrompt: String(row.image_prompt),
      reinforcements: parseJson<string[]>(row.reinforcements, []),
      createdAt: String(row.created_at),
    }));
  }

  getLatestPrompt(projectId: string, n: number): PromptVersion | null {
    return this.latestPrompt(projectId, n);
  }

  addPromptVersion(
    projectId: string,
    n: number,
    data: { text: string; imagePrompt: string; reinforcements: string[] },
  ): PromptVersion {
    const row = this.db
      .prepare(
        "SELECT MAX(version) AS maxVersion FROM prompts WHERE project_id = ? AND scene_n = ?",
      )
      .get(projectId, n) as Row | undefined;
    const version = Number(row?.maxVersion ?? 0) + 1;
    const createdAt = nowIso();
    this.db
      .prepare(
        "INSERT INTO prompts (project_id, scene_n, version, text, image_prompt, reinforcements, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        projectId,
        n,
        version,
        data.text,
        data.imagePrompt,
        JSON.stringify(data.reinforcements),
        createdAt,
      );
    return { version, ...data, createdAt };
  }

  listRules(projectId: string): RuleRecord[] {
    const rows = this.db
      .prepare("SELECT * FROM rules WHERE project_id = ? ORDER BY id")
      .all(projectId) as Row[];
    return rows.map((row) => ({
      id: Number(row.id),
      text: String(row.text),
      createdAt: String(row.created_at),
    }));
  }

  addRule(projectId: string, text: string): RuleRecord {
    const createdAt = nowIso();
    const result = this.db
      .prepare("INSERT INTO rules (project_id, text, created_at) VALUES (?, ?, ?)")
      .run(projectId, text, createdAt);
    return { id: Number(result.lastInsertRowid), text, createdAt };
  }

  deleteRule(projectId: string, id: number): void {
    this.db
      .prepare("DELETE FROM rules WHERE project_id = ? AND id = ?")
      .run(projectId, id);
  }

  private mapJob(row: Row): JobRecord {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      type: String(row.type),
      status: row.status as JobRecord["status"],
      progress: Number(row.progress ?? 0),
      message: String(row.message ?? ""),
      error: row.error ? String(row.error) : null,
      result: parseJson<unknown>(row.result, null),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  createJob(projectId: string, type: string): JobRecord {
    this.ensureProject(projectId);
    const now = nowIso();
    const job: JobRecord = {
      id: newId(),
      projectId,
      type,
      status: "running",
      progress: 0,
      message: "Starting…",
      error: null,
      result: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare(
        "INSERT INTO jobs (id, project_id, type, status, progress, message, error, result, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)",
      )
      .run(job.id, projectId, type, job.status, job.progress, job.message, now, now);
    return job;
  }

  updateJob(
    id: string,
    patch: Partial<Pick<JobRecord, "status" | "progress" | "message" | "error" | "result">>,
  ): JobRecord | null {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Row | undefined;
    if (!row) return null;
    const merged: JobRecord = {
      ...this.mapJob(row),
      ...patch,
      updatedAt: nowIso(),
    };
    this.db
      .prepare(
        "UPDATE jobs SET status = ?, progress = ?, message = ?, error = ?, result = ?, updated_at = ? WHERE id = ?",
      )
      .run(
        merged.status,
        merged.progress,
        merged.message,
        merged.error,
        merged.result === null ? null : JSON.stringify(merged.result),
        merged.updatedAt,
        id,
      );
    return merged;
  }

  getJob(id: string): JobRecord | null {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Row | undefined;
    return row ? this.mapJob(row) : null;
  }

  getLastJob(projectId: string, type?: string): JobRecord | null {
    const row = (
      type
        ? this.db
            .prepare(
              "SELECT * FROM jobs WHERE project_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1",
            )
            .get(projectId, type)
        : this.db
            .prepare("SELECT * FROM jobs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
            .get(projectId)
    ) as Row | undefined;
    return row ? this.mapJob(row) : null;
  }
}
