# Story to Flow — Plan

## Overview

Local-only, single-user Next.js app that turns a pasted story into a production plan for Google Flow / Veo: characters and locations with visual/voice locks, scene plan, deterministically assembled prompts, keyframes, clip review, frame chaining, chat editing and export. No auth, no video generation, no Flow automation.

## Architecture decisions

- **Next.js 16 App Router** (installed 16.4.2), React 19, Tailwind v4, shadcn/base-ui components. UI is one client-side workspace page that talks to route handlers via `fetch`; avoids Cache Components prerender surprises and keeps long jobs out of the render path.
- **Storage:** SQLite via `better-sqlite3` in `data/story-to-flow.db`. If the native module cannot be loaded, a JSON-document store (`data/db.json`) implements the same `Repo` interface. Both selected lazily in `src/lib/db/index.ts`.
- **Files:** `data/files/<projectId>/...`, served only through `/api/files/[...path]`. Uploaded clips, keyframes, last frames and reference images never live in `public/`.
- **LLM:** all calls server-side through OmniRoute in `src/lib/llm.ts`. Roles map to env models. One retry on the same model, then one on `MODEL_FALLBACK`; JSON parsing strips fences; one repair call on validation failure. `response_format` is attempted and dropped if rejected.
- **Prompts:** assembled by code only (`src/lib/assemble.ts`). Locks inserted verbatim, every scene, from current DB state. Changing a lock/rule calls `reassembleAffected` instead of re-planning.
- **Validation:** deterministic checks first (`src/lib/validate.ts`), then LLM validator returning structured field edits, max 2 auto-fix rounds; unresolved scenes become `needs_attention` with reasons.
- **Images:** `ImageProvider` interface with `omniroute` and `manual` implementations. Default is decided by `scripts/test-omniroute.ts`; app is fully usable with `manual`.
- **Long jobs:** a job row is created, the route returns `202 {jobId}`, work continues in-process (local dev/server), progress is written to DB and the UI polls `/api/jobs/:id`.
- **Chat editing:** planner returns zod-validated operations; UI shows a diff; apply endpoint mutates data then re-assembles affected prompts.
- **Export:** `.txt` (all prompts), `.json` (full plan + prompts), `.zip` (prompts + available scene images) via `jszip`.

## Dependency order

1. Types/schemas + settings → repo (SQLite/JSON) → API skeleton → workspace shell (T0/T1)
2. Bible generation → characters/locations UI (T1)
3. Settings + scene planning in batches → scene list (T2)
4. Assembler + prompt API + copy (T3)
5. Deterministic + LLM validation (T4)
6. Image provider + keyframes + references (T5)
7. Clip upload + browser last frame + chaining (T6)
8. Review/regenerate + rules + versions (T7)
9. Chat editing with diff/confirm (T8)
10. Export + polish + report (T9)

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| OmniRoute unreachable / no key | App still runs; clear errors in UI; tests mock `fetch`; manual image provider works. |
| Text model cannot generate images | `test-omniroute.ts` evidence; `imageProvider` defaults to `manual` when no image bytes return. |
| Suggested/model IDs (`gemini-3.8-flash-high`) don't exist | Models are env-driven and editable in Settings; failures surface with model name and gateway message. |
| better-sqlite3 native install on Windows | Verified locally; JSON fallback behind `Repo` interface. |
| Long plan job cancels after response | Work started with `void run()` in the Node process and progress persisted; each batch is idempotent per project. |
| Bangla rendering | UTF-8 end-to-end, Hind Siliguri font, `lang` attributes on dialogue; DB text columns. |
| LLM produces invalid JSON | Fence stripping, zod, one repair call, deterministic fallback (bible/scene plan error to UI). |

## Open questions / assumptions

- **OmniRoute results:** script is implemented and runnable; without a reachable gateway/key the run cannot produce evidence. Default `imageProvider` is therefore `manual` until the script proves image bytes come back. Assumption recorded per spec §3.
- **Model IDs:** exactly the IDs from the prompt are used as defaults; all four can be overridden in Settings and `.env.local`.
- **Clip length:** 8 or 10 seconds only (spec), scene count `ceil(totalSeconds / clipSeconds)`.
- **Location name:** the bible schema only provides `id` + `visual_lock`; UI derives a display name from `id` (e.g. `ghat` → `Ghat`) while keeping the lock verbatim.
- **Frame chaining:** the last-frame extraction runs client-side; if the browser refuses canvas access, the user can still upload a PNG manually.
- **Validation cost:** scene validation runs automatically after planning but is capped to the configured strictness; any failure downgrades to `needs_attention` rather than blocking the plan. This is a local single-user app, so synchronous-per-scene validation in the background job is acceptable.
- **No full auth/multi-project:** the app manages one project (id `default`); spec says one user, no login.
