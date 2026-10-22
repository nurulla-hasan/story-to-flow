# Story to Flow — Fix & Upgrade Master Plan

**Status:** Approved for execution  
**Date:** 2026-10-22  
**Target:** Fix critical flaws, UX bottlenecks, and illogical settings in `story-to-flow`.

---

## 1. Executive Summary & Goals

The `story-to-flow` application generates video production plans for Google Flow / Veo from story text. While the core prompt assembly is solid, several critical architectural and logic issues degrade user experience:
1. **No Job Stop / Cancel Mechanism:** Long-running planning jobs cannot be stopped; stuck jobs lock the workspace with `409 Conflict`.
2. **Illogical Settings Constraints:**
   - Scene count is computed via `Total minutes / Clip seconds` (e.g. `0.7 min`), rather than direct target scene count or auto-detection.
   - `maxPeople` forcefully truncates characters (`deduped.slice(0, settings.maxPeople)`), deleting valid characters from scenes.
   - Low dialogue limit (15 words) and strict validator loops cause latency and API timeouts.
3. **Data Loss Danger on Bible Updates:** Clicking "Update Bible" wipes all existing scenes (`repo.replaceScenes(projectId, [])`) without confirmation.
4. **Token Limits & Large Batch Failures:** 10 scenes per batch causes smaller models to exceed context or return malformed JSON.

---

## 2. Phased Implementation Plan

### Phase 1: Real-time Cancel / Stop System & Stuck Job Recovery
- **Backend Job Registry & AbortController:**
  - Create an in-memory `Map<string, AbortController>` in `src/lib/pipeline.ts`.
  - Pass the `AbortSignal` through `runPlanJob`, `planSceneBatch`, and `chatJSON`.
  - Update `JobRecord` in `src/lib/types.ts` to support `"cancelled"` status.
  - Implement `/api/jobs/[id]/cancel` endpoint (`POST` / `DELETE`).
- **Stuck Job Auto-Recovery:**
  - If a user triggers a new plan while an old job is marked `running`, auto-cancel the zombie job instead of throwing `409 Conflict`.
- **UI Stop Button:**
  - Add a visible, red "Stop / Cancel" button to `JobProgressBanner` in `src/components/job-progress-banner.tsx`.
  - Provide instant visual feedback when cancellation is requested.

### Phase 2: Settings Overhaul (Removing Illogical Constraints)
- **Direct Scene Count / Flexible Length:**
  - Support setting a target scene count (e.g., 5, 8, 12, or Auto) instead of calculating `0.7 min / 10s`.
  - Keep minute calculation optional/informational rather than mandatory.
- **Eliminate Character Slicing Bug:**
  - Remove destructive `slice(0, settings.maxPeople)` in `sanitizeScenePlan()`.
  - Raise default `maxPeople` limit to 6-8 and add warning flags instead of silently dropping characters from the story.
- **Relax Dialogue & Ambient Sound Constraints:**
  - Increase default max dialogue words to a natural conversational length (e.g. 30 words).
  - Clean up accent note formatting so it only attaches to scenes with actual spoken dialogue.
- **Validator Strictness:**
  - Make `light` or `off` (deterministic only) the clear standard to prevent double LLM round-trips.

### Phase 3: Data Safety (Bible Update Without Scene Wiping)
- **Prevent Accidental Scene Wiping:**
  - In `buildBible()`, avoid deleting scenes if scenes already exist.
  - Add user confirmation or an option: "Update characters only (preserve scenes)" vs "Start fresh story".
  - If characters change, trigger `reassembleAll()` to update locks without destroying scene structure.

### Phase 4: LLM Robustness & Token Optimization
- **Dynamic Batch Sizing:**
  - Change batch size from 10 to 5 scenes per batch to avoid JSON truncation on smaller/local models.
- **AbortSignal in LLM Client:**
  - Allow `signal?: AbortSignal` parameter in `src/lib/llm.ts` `chat()` and `chatJSON()`.
  - Instantly abort in-flight `fetch` requests when user cancels.

### Phase 5: Verification & Quality Assurance
- Run `pnpm test` (all Vitest suites).
- Run `pnpm typecheck` (`tsc --noEmit`).
- Run `pnpm lint` (`eslint`).
- Test cancel button, settings modal, and Bible regeneration end-to-end.

---

## 3. Execution Tracking (Database & Todos)

| Todo ID | Title | Status |
| --- | --- | --- |
| `job-cancel-backend` | Job cancellation backend & AbortController registry | ✅ Completed |
| `abort-signal-llm` | Add AbortSignal to LLM client and planner loops | ✅ Completed |
| `stuck-job-recovery` | Stuck job auto-recovery in planner | ✅ Completed |
| `job-cancel-ui` | Real-time Cancel/Stop button in UI | ✅ Completed |
| `settings-cleanup-types` | Overhaul settings schema and pipeline logic | ✅ Completed |
| `settings-dialog-ui` | Redesign Settings dialog UI | ✅ Completed |
| `bible-update-protection` | Secure Bible updates against accidental scene deletion | ✅ Completed |
| `llm-batch-optimization` | Optimize LLM batching and error recovery | ✅ Completed |
| `verification-testing` | End-to-end typecheck, lint, and tests | ✅ Completed |
