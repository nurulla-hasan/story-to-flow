# Story to Flow — Todo

Status legend: [ ] pending, [x] done. Each task is a vertical slice with UI + API + store.

## T0 — Scaffold, env, OmniRoute probe
- [ ] `.env.local.example`, typed env reader, `lib/llm.ts` with retries/fallback/repair
- [ ] `scripts/test-omniroute.ts` (Bangla text, JSON-only, image attempt, table output)
- [ ] Record result in plan, decide default image provider
- Acceptance: script runs and prints model/ok/latency/notes table; app builds.
- Verify: `pnpm exec tsx`/`node` run, `tsc --noEmit`, `lint`, `build`.

## T1 — Story → Bible
- [ ] zod bible schema, planner call, repository save, `/api/bible`
- [ ] Workspace story box + "Create story bible" + characters/locations render
- Acceptance: test story returns 3 characters (Rina, Karim, Ma) and 2 locations; bad JSON triggers one repair.
- Verify: unit test with mocked LLM; manual UI path.

## T2 — Settings + scene plan
- [ ] Settings schema/defaults, settings UI, project PATCH
- [ ] Batch scene planner with last-2-scene continuity, `/api/plan` job + progress poll
- [ ] Scene count = ceil(total seconds / clip seconds); establishing shot before location change
- Acceptance: plan has N scenes, valid enums, establishing shots; start_state = previous end_state where chained.
- Verify: unit tests for scene count and continuity check.

## T3 — Assembler + copy
- [ ] `lib/assemble.ts` exact template, plain text
- [ ] prompt versions table, `/api/scenes/[n]/prompt`, copy button in UI
- Acceptance: unit tests prove every visible character's visual_lock + voice_lock appear verbatim; output is plain text (no markdown fences).
- Verify: vitest.

## T4 — Validation
- [ ] deterministic checks + LLM validator with structured edits, 2 fix rounds, needs_attention reasons
- [ ] Validate button + status chips
- Acceptance: unit tests for each deterministic check; max 2 rounds enforced.
- Verify: vitest + build.

## T5 — Keyframes + image provider
- [ ] `ImageProvider` (omniroute, manual), image prompt builder, file storage
- [ ] Generate/upload keyframe, copy prompt, download; character/location reference uploads
- Acceptance: manual provider path fully usable; omniroute failures produce a clear error.
- Verify: build + manual check.

## T6 — Clip upload, last frame, chaining
- [ ] clip upload, `last_frame_path`, `/api/scenes/[n]/last-frame`
- [ ] browser extraction (video + canvas), send to next scene, Chained badge, download
- Acceptance: a test video yields a stored PNG attached to scene N+1.
- Verify: unit test store attach; manual browser check if possible.

## T7 — Review/regenerate
- [ ] problem checkboxes, reinforcement lines, green diff, versioned prompts, save-as-rule
- Acceptance: "dress changed" creates new prompt version with MUST line; saved rule appears in every scene prompt.
- Verify: unit test assemble with rule + mocked review response.

## T8 — Chat editing
- [ ] zod op list, diff, confirm/apply, re-assemble affected
- Acceptance: changing dress via chat updates all prompts without re-planning.
- Verify: unit test apply ops.

## T9 — Export + finish
- [ ] txt/json/zip export, loading/error/empty states, README Windows instructions, REPORT
- Acceptance: export downloads prompts .txt + .json (+ zip).
- Verify: route test/build + manual.
