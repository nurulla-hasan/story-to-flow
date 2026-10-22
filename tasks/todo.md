# Story to Flow — Todo

Status legend: [x] done. Each task is a vertical slice with UI + API + store.

## T0 — Scaffold, env, OmniRoute probe
- [x] `.env.local.example`, typed env reader, `lib/llm.ts` with retries/fallback/repair
- [x] `scripts/test-omniroute.ts` (Bangla text, JSON-only, image attempt, table output)
- [x] Record result in plan, decide default image provider (omniroute returned no image, defaulted to `manual`)
- Acceptance: script runs and prints model/ok/latency/notes table; app builds.
- Verify: `pnpm exec tsx scripts/test-omniroute.ts`, `tsc --noEmit`, `eslint`, `next build`.

## T1 — Story → Bible
- [x] zod bible schema, planner call, repository save, `/api/bible`
- [x] Workspace story box + "Create story bible" + characters/locations render
- Acceptance: test story returns 3 characters (Rina, Karim, Ma) and 2 locations; bad JSON triggers one repair.
- Verify: verified live via `scripts/test-pipeline.ts` with OmniRoute.

## T2 — Settings + scene plan
- [x] Settings schema/defaults, settings UI, project PATCH
- [x] Batch scene planner with last-2-scene continuity, `/api/plan` job + progress poll
- [x] Scene count = ceil(total seconds / clip seconds); establishing shot before location change
- Acceptance: plan has N scenes, valid enums, establishing shots; start_state = previous end_state where chained.
- Verify: verified with unit tests `tests/planner.test.ts` and live execution in `scripts/test-pipeline.ts`.

## T3 — Assembler + copy
- [x] `lib/assemble.ts` exact template, plain text
- [x] prompt versions table, `/api/scenes/[n]/prompt`, copy button in UI
- Acceptance: unit tests prove every visible character's visual_lock + voice_lock appear verbatim; output is plain text (no markdown fences).
- Verify: `tests/assemble.test.ts` via Vitest.

## T4 — Validation
- [x] deterministic checks + LLM validator with structured edits, 2 fix rounds, needs_attention reasons
- [x] Validate button + status chips
- Acceptance: unit tests for each deterministic check; max 2 rounds enforced.
- Verify: `tests/validate.test.ts` via Vitest.

## T5 — Keyframes + image provider
- [x] `ImageProvider` (omniroute, manual), image prompt builder, file storage
- [x] Generate/upload keyframe, copy prompt, download; character/location reference uploads
- Acceptance: manual provider path fully usable; omniroute failures produce a clear error.
- Verify: unit tests + route handlers `/api/scenes/[n]/keyframe`, `/api/characters/[id]/ref`, `/api/locations/[id]/ref`.

## T6 — Clip upload, last frame, chaining
- [x] clip upload, `last_frame_path`, `/api/scenes/[n]/last-frame`
- [x] browser extraction (video + canvas), send to next scene, Chained badge, download
- Acceptance: a test video yields a stored PNG attached to scene N+1.
- Verify: client-side frame extraction + chaining endpoint `/api/scenes/[n]/chain`.

## T7 — Review/regenerate
- [x] problem checkboxes, reinforcement lines, green diff, versioned prompts, save-as-rule
- Acceptance: "dress changed" creates new prompt version with MUST line; saved rule appears in every scene prompt.
- Verify: `/api/scenes/[n]/regenerate` + review modal with green diff and version increment.

## T8 — Chat editing
- [x] zod op list, diff, confirm/apply, re-assemble affected
- Acceptance: changing dress via chat updates all prompts without re-planning.
- Verify: verified via `scripts/test-pipeline.ts` with live OmniRoute chat planning and op application.

## T9 — Export + finish
- [x] txt/json/zip export, loading/error/empty states, README Windows instructions, REPORT
- Acceptance: export downloads prompts .txt + .json (+ zip).
- Verify: route test /api/export + `REPORT.md`.
