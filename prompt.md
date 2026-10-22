# MASTER PROMPT: Build "Story to Flow"

You are a senior full-stack engineer. Build the COMPLETE app described below inside this repo, in ONE autonomous run. Read the whole prompt first.

How to run: do NOT stop for my approval, do NOT ask me questions mid-way, and do NOT end your turn until every task in section 8 is done or truly blocked. If something is ambiguous, choose the simplest reasonable option, write the assumption under "Open Questions" in `tasks/plan.md`, and keep going. The only reason to stop and ask me is a hard blocker you cannot work around (for example OmniRoute is not running or the key is rejected and you cannot test anything). Even then, finish everything that does not depend on it first.

## 1. What this app is

A personal, local-only web app (one user, me, no login). I paste a story. The app turns it into a production plan for an AI video model, then gives me, for every 8-10 second scene:

- a master prompt (plain text) that I copy into Google Flow myself,
- a keyframe image for that scene,
- continuity tools so scene N matches scene N+1.

The app does NOT generate video and does NOT control Google Flow. I generate each clip in Flow by hand, upload it back, and the app helps me keep the next scene consistent.

### The real problem this app exists to solve

Flow/Veo generates every clip independently, so across scenes it changes: (1) the character's face, (2) the character's dress, (3) the character's voice, (4) the location/lighting, and the end of one clip does not match the start of the next. Every design decision below serves consistency. Treat the "locks" and the "chaining" as the core of the product, not the UI.

## 2. Stack

- Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui. Backend = Next.js route handlers (no separate server).
- Storage: SQLite via better-sqlite3, DB file in ./data. If better-sqlite3 fails to install on Windows, fall back to a JSON-file store behind the same repository interface.
- Uploaded/generated files live in ./data/files (served through a route handler, not public/).
- zod for every LLM output and every API body.
- No auth, no Redis, no queue system, no Docker. Long jobs run in the route handler and write progress to the DB; the UI polls.
- Must work on Windows (use path.join, no bash-only scripts). Bangla must be stored and rendered as UTF-8 everywhere.

## 3. LLM access (OmniRoute)

All LLM calls go through my local OmniRoute gateway, OpenAI-compatible. Server-side only. Never expose the key to the browser.

.env.local:

```
OMNIROUTE_BASE_URL=http://localhost:20128/v1
OMNIROUTE_API_KEY=
MODEL_PLANNER=agy/gemini-3.8-flash-high
MODEL_VALIDATOR=agy/gemini-3.8-flash-low
MODEL_FALLBACK=ollamacloud/gemma4:31b
MODEL_IMAGE=agy/gemini-3.8-flash-high
```

Rules:

- Chat: `POST {OMNIROUTE_BASE_URL}/chat/completions` with `Authorization: Bearer <key>`. The base URL already ends in /v1. Never append /v1 again (that gives a 404).
- Model IDs include the provider prefix, exactly as above.
- Write one module `lib/llm.ts` with `chat({role, messages, json?})`. Roles map to env models. On network error, 5xx, 429 or invalid JSON, retry once on the same model, then once on MODEL_FALLBACK.
- Do not assume `response_format` is supported. Try it; if the gateway rejects it, drop it and just instruct "return JSON only". Always strip code fences, JSON.parse, validate with zod, and on failure do ONE repair call ("your JSON failed validation: <errors>, return corrected JSON only").
- Use low temperature (0.1 to 0.2) for validator and for any structured output, around 0.7 only for the first bible pass.
- Show clear errors in the UI (401 = bad key, connection refused = OmniRoute not running).

### Image generation: do NOT assume it works

I want to use the same Gemini flash model for images. But the models in my OmniRoute are tagged "chat", and a text model may not be able to output images. So:

1. Define an `ImageProvider` interface with two implementations:
   - `omniroute`: try `POST {base}/images/generations` with MODEL_IMAGE; if that fails, try a chat completion with MODEL_IMAGE and look for an image part (base64 or URL) in the response.
   - `manual`: the app produces the image prompt, I generate the image elsewhere (for example inside Flow) and upload it.
2. Build `scripts/test-omniroute.ts` FIRST (task T0). It tests: each text model with a one-line Bangla reply, JSON-only output, and the image attempt above. It prints a table: model, ok/fail, latency, notes (including whether an image actually came back).
3. Pick the default provider from that result: `omniroute` only if an image really came back, otherwise `manual`. Make it switchable in settings. The rest of the app must work fully with `manual`.

## 4. Settings (all dynamic)

Project-level:

- Dialogue language: Bangla or English. Per-character override allowed. Free-text accent note.
- Total length (minutes), clip length (8 or 10 sec), scene count = ceil(total seconds / clip seconds).
- Aspect ratio (16:9, 9:16), visual style preset plus free text.
- Max people per scene (default 2), dialogue on/off, max dialogue words (default 15), ambient sound on/off.
- Frame chaining on/off, negative list, validator strictness, which model per role, image provider.

Characters are NOT a fixed number. They are detected from the story (3 characters in the story = 3, 7 = 7). I can add, remove, merge, rename and edit them. The number of characters visible in one scene is a separate setting (max people per scene).

## 5. The pipeline

### Step A: Story Bible (planner model, one call)

Output JSON (zod-validated):

```
{
  "title": "",
  "style_lock": "one fixed line: look, lens, light, color grade, mood",
  "characters": [{
    "id": "rina", "name": "Rina",
    "visual_lock": "40-60 words: age, face, hair, skin tone, DRESS, accessories. Visual facts only.",
    "voice_lock": "age, pitch, speed, accent, mood. Concrete.",
    "language": "bn" | "en",
    "outfit_changes": false
  }],
  "locations": [{ "id": "ghat", "visual_lock": "architecture, objects, time of day, light, colors" }]
}
```

Rules for the planner: no personality or backstory inside visual_lock, no invented characters or locations, pick the simplest visual reading of ambiguous text. Merge a character who appears under several names (for example "Ma" and "Rina's mother").

### Step B: Scene plan (planner model, in batches of ~10 scenes)

Give each batch the full bible plus the last 2 scenes of the previous batch so continuity carries across batches. Each scene:

```
{
  "n": 7, "location_id": "ghat", "characters": ["rina","karim"],
  "is_establishing": false,
  "chain_from_previous": true,
  "action": "max 25 words, ONE action",
  "camera": { "shot": "", "angle": "", "movement": "" },
  "start_state": "where each character is, facing, holding, light",
  "end_state": "same, at the last frame",
  "dialogue": { "speaker": "rina", "line": "..." } | null,
  "sound": ""
}
```

Planning rules (put these in the planner system prompt):

1. One shot, one main action per scene. Never cut in the middle of an action; end scenes when an action finishes.
2. Group scenes of the same location together. Before every location change insert an establishing shot (`is_establishing: true`, no dialogue) and set `chain_from_previous: false` for it.
3. `start_state` of scene N must equal `end_state` of scene N-1 whenever `chain_from_previous` is true.
4. Never use pronouns or nicknames for characters in scene fields. Use ids only; code substitutes the locks.
5. Respect max people per scene and max dialogue words. Dialogue is written in the character's language, in native script (Bangla script for Bangla, never romanized).
6. Dress and voice never change unless the character has `outfit_changes: true` and the scene says so explicitly.

### Step C: Prompt assembly is done by CODE, never by the LLM

`lib/assemble.ts` fills this template deterministically, inserting each lock verbatim (word for word, every scene):

```
{style_lock}

LOCATION: {location.visual_lock}

CHARACTERS:
{for each visible character:}
- {name}: {visual_lock} Voice: {voice_lock}.

SHOT: {shot}, {angle}, {movement}.
START: {start_state}
ACTION: {action}
END: {end_state}
{dialogue ? 'DIALOGUE: {name} says in {Bangla|English}, "{line}". Same voice as in every other scene.' : 'No dialogue.'}
AUDIO: {sound}. {ambient off ? 'No background music.' : ''}

MUST: {custom rules + per-scene reinforcements}
AVOID: {negative list}
```

Output is one plain-text block (no markdown), instructions in English, dialogue line in native script. This is what the Copy button copies for Flow. Keep prompt versions per scene.

### Step D: Validation (code first, then LLM)

1. Deterministic checks in code: every visible character's visual_lock and voice_lock present verbatim, style_lock and location lock present, people count within limit, dialogue word count within limit, start_state equals previous end_state when chained, no empty fields.
2. LLM validator (validator model) checks semantic issues: more than one main action, contradiction between action and start/end state, continuity with the previous scene, a location jump without an establishing shot.
3. The validator returns fixes as STRUCTURED FIELD EDITS (never a free-form prompt); code re-assembles. Max 2 auto-fix rounds, then mark the scene "needs attention" with the reasons shown to me.

### Step E: Keyframes

For every scene build an image prompt: style_lock + location lock + visible character locks + the `start_state` moment, in the project's aspect ratio. Use the ImageProvider. Also support one reference image per character and per location (generate or upload) and show them in the right-hand panel. With the `manual` provider, show the image prompt with a Copy button and an Upload button.

### Step F: Clip review loop (the key feature)

Per scene I can upload the clip I made in Flow.

- Extract the LAST FRAME in the browser (hidden video element + canvas, seek to duration minus a small epsilon), upload it as PNG, store it as the scene's `last_frame`. A "Send to next scene" button sets it as the next scene's start frame and shows a "Chained" badge. I download it and use it in Flow as the first frame of the next clip.
- "What went wrong?" checkboxes: face changed, dress changed, location changed, voice changed, continuity broken (plus a free note).
- "Regenerate prompt" calls the validator model with the scene, the previous prompt version and the checked problems, and gets back (a) 1-3 short reinforcement lines for the MUST section and (b) an optional proposed custom rule. If I tick "save as custom rule for all scenes", the rule is stored and applied to all scenes, and all prompts re-assemble. Show what was added (green diff) before saving the new version.

### Step G: Chat editing

A chat panel where I talk to the planner, for example "Rina's saree should be blue from now on" or "split scene 12 into two".

- The model returns a JSON list of operations (set_character_field, update_scene, split_scene, merge_scenes, delete_scene, add_rule, set_setting), validated by zod.
- Show a diff and apply only after I confirm.
- Because prompts are assembled from locks, changing a lock automatically re-assembles every affected scene. Never regenerate the whole plan for a small edit.

### Step H: Export

All prompts as .txt and as JSON; scene images as a zip if easy.

## 6. UI (shadcn + Tailwind)

Light theme. Tokens: accent #0F766E, background #F3F5F7, ink #14202B, border #DDE3E8, card radius 12px, font Inter plus Hind Siliguri (for Bangla). Buttons and inputs at least 44px tall, real <button>, <label>, <input>, visible focus, text contrast 4.5:1.

Screen 1, Workspace (three columns, max width 1440):

- Top bar: app name, project name, "12 of 38 clips done", Export button.
- Left (300px): Story box with "Re-plan scenes", and the project settings list.
- Center: "Scenes (N)" list. Collapsed scene card = number, one-line summary, status chip (Waiting, Ready for Flow, Done, Needs attention). The open card shows: keyframe image box, "Chained from Scene N-1" badge, start/end state, the assembled prompt, and buttons Copy prompt, Download keyframe, Upload clip, Mark done.
- Right (300px): Characters list (name, dress, voice, add or merge), Custom rules list with Add a rule.

Screen 2, Clip review for one scene: video player, last-frame card with "Send to next scene", the "What went wrong?" checkboxes, the green diff of added reinforcement lines, "Regenerate prompt for Scene N".

## 7. Hard rules (do not do these)

- Do not call Google Flow or Veo, do not automate a browser, do not add TTS or any separate voice step. Flow generates the voice inside the clip.
- Do not put prompts together with the LLM; the assembler is code.
- Do not hardcode a character count, language or clip length.
- Do not expose OMNIROUTE_API_KEY to the client or commit .env.local.
- Do not invent OmniRoute behavior; if a response shape surprises you, log it, adapt `lib/llm.ts` defensively, and note it in `tasks/plan.md`.
- Do not add login, payments, Redis, or any hosted service.

## 8. Plan first, then build everything (one run)

### 8.1 Planning (before any app code)

1. Create `tasks/plan.md` and `tasks/todo.md`. If they already exist with unchecked tasks for different work, do NOT overwrite or delete them; use `tasks/story-to-flow/plan.md` and `tasks/story-to-flow/todo.md` instead. Do not wait for me to approve the plan; write it and proceed.
2. `plan.md` contains: overview, architecture decisions, dependency order, risks (with mitigations), open questions/assumptions.
3. `todo.md` contains the tasks below as a checklist. Each task has: description, acceptance criteria (specific, testable), verification, dependencies, files likely touched. Tick tasks off as you finish them.
4. Slice VERTICALLY: every task delivers one working path through schema + API + UI, never "all DB first, then all API, then all UI". Keep tasks small (S or M, roughly 5 files or fewer). If a task grows beyond that, split it in `todo.md` and continue.

### 8.2 Tasks (do them in this order, without pausing between them)

- **T0, Scaffold and OmniRoute test.** Create the Next.js project, `.env.local.example`, and `scripts/test-omniroute.ts` (section 3). Run it, save the results table in `plan.md`, and set the default image provider from the result. Acceptance: script runs and prints the table; image provider default is decided from evidence. If OmniRoute is unreachable, record that, use mocked LLM responses for the tests, and continue.
- **T1, Story to Bible.** I paste a story on the Workspace page, click a button, and see the detected characters and locations with their locks (Step A), saved in the DB. Acceptance: the test story gives 3 characters and 2 locations; invalid LLM JSON triggers one repair call.
- **T2, Settings and scene plan.** Settings page (section 4) plus Step B in batches; the scene list shows N scenes with status chips. Acceptance: scene count matches total length divided by clip length; an establishing shot precedes every location change; start_state equals previous end_state where chained.
- **T3, Assembler and Copy prompt.** Step C, with the open scene card showing the prompt and a working Copy button. Acceptance: unit tests prove each character's visual_lock and voice_lock appear verbatim in every scene's prompt that includes that character, and that the output is plain text.
- **T4, Validation.** Step D, with deterministic checks and the LLM validator, and a "Needs attention" status with reasons. Acceptance: unit tests for each deterministic check; max 2 auto-fix rounds.
- **T5, Keyframes.** Step E with the ImageProvider interface (manual and omniroute), reference images for characters and locations, Copy image prompt, Upload and Download. Acceptance: the app is fully usable with the manual provider.
- **T6, Clip upload, last frame and chaining.** First half of Step F: upload clip, in-browser last-frame extraction, "Send to next scene", Chained badge, Download frame. Acceptance: a test video yields a PNG last frame that is stored and attached to the next scene.
- **T7, Review and regenerate.** Second half of Step F: the review screen, "What went wrong?" checkboxes, reinforcement lines with green diff, versioned prompts, save-as-custom-rule that re-assembles all prompts. Acceptance: ticking "dress changed" produces a new prompt version with an added MUST line; a saved rule appears in every scene's prompt.
- **T8, Chat editing.** Step G with zod-validated operations, diff, and confirm-before-apply. Acceptance: changing a character's dress via chat re-assembles all affected scenes without re-planning.
- **T9, Export and finish.** Step H, loading/error/empty states on every screen, and a README with run instructions for Windows. Acceptance: export downloads all prompts as .txt and .json.

### 8.3 Verification (do it yourself, I will not review between tasks)

After EACH task run `npx tsc --noEmit`, the lint command, `npm test` (use Vitest for the assembler and deterministic checks), and `npm run build`. Fix failures before moving on. Do not skip a task because a check is annoying; if something cannot be verified (needs a real OmniRoute key, a real Flow clip), say so explicitly in the report instead of claiming it works.

### 8.4 Final report

When all tasks are done, write `tasks/REPORT.md`: what works (verified), what is implemented but untested and why, assumptions made, known limits, and exact steps for me to run it (install, .env.local, `npm run dev`, the first thing to click). Then give me a short summary of the same.

## 9. Test story (for T1 and T2)

রিনা ভোরে নদীর ঘাটে যায়। সেখানে করিমের সঙ্গে তার দেখা হয়, যে অনেক বছর পর শহর থেকে ফিরেছে। দুজনে পুরোনো কথা বলে। রিনার মা বাড়ির উঠোন থেকে ডাক দেন। রিনা মাকে করিমের কথা বলে। মা প্রথমে চুপ থাকেন, তারপর করিমকে চায়ের দাওয়াত দেন।

Expected: 3 characters (Rina, Karim, Ma), 2 locations (ghat, courtyard). Use a short total length (for example 1 minute) while testing so it stays cheap.