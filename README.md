# Story to Flow

A personal, local-only web application that turns any story into a production plan for Google Flow / Veo with strict character, dress, voice, and location consistency.

## Highlights

- **Story Bible with Visual & Voice Locks:** Detects characters and locations, locking exact visual facts and voice attributes.
- **Code-Assembled Prompts:** Prompts are assembled deterministically by code (never hallucinated by the model), inserting locks verbatim.
- **Batched Scene Planner:** Plans 8–10 second clips in batches, preserving continuity from scene $N$ to $N+1$, inserting establishing shots on location transitions.
- **Consistency Chaining:** Extract the last frame of a generated clip directly in the browser and send it to the next scene as its starting reference.
- **Review & Feedback Loop:** Report drifted elements (face, dress, lighting, voice) to get tailored reinforcement lines in the `MUST` prompt section with green diff preview.
- **Chat Editing:** Natural language planning (e.g., "Change Rina's saree to green from now on") translates into validated diff operations and updates all affected prompts automatically.
- **Flexible Export:** Download prompts as formatted `.txt`, full plan as `.json`, or a `.zip` archive with all prompts and media assets.
- **Strict Semantic Design:** Clean, accessible light theme using semantic tokens and modern Tailwind linear numeric scaling.

## Requirements

- Node.js 18+ (tested on v24.22.0)
- pnpm 9+
- Windows, macOS, or Linux
- OmniRoute local gateway running on `http://localhost:20128/v1`

## Setup & Running on Windows

1. **Install dependencies:**
   ```powershell
   pnpm install
   ```

2. **Configure `.env.local`:**
   Copy `.env.local.example` to `.env.local`:
   ```powershell
   copy .env.local.example .env.local
   ```
   Verify `OMNIROUTE_BASE_URL` and `OMNIROUTE_API_KEY`.

3. **Run tests:**
   ```powershell
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

4. **Start the development server:**
   ```powershell
   pnpm dev
   ```
   Visit [http://localhost:3000](http://localhost:3000).

5. **First Steps in the App:**
   - Paste your story in the left sidebar.
   - Click **Create story bible** to lock characters and locations.
   - Click **Re-plan scenes** to generate your clips.
   - Expand a scene card and click **Copy prompt** to paste into Flow!
