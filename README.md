# Story-to-Flow

A local-first studio application that turns any story into a calibrated production package and timeline project for AI video generation (Google Flow, Veo, Midjourney) with strict visual continuity and authentic Bengali voiceover.

---

## 🎬 Production Workflow (Voiceover-First)

Story-to-Flow operates on an engineered 4-stage pipeline that ensures visual pacing matches actual narration length rather than uncalibrated guesswork:

```
[1. Story Input]
       │
       ▼ (Generate Voiceover Script)
[2. Master Voiceover Script] ──(Copy for Cartesia)──> [User Synthesizes Audio in Cartesia Externally]
       │                                                                  │
       ▼ (Proceed to Duration Entry)                                      │
[3. Cartesia Duration & Visual Settings] <───(Enter Measured Mins & Secs)─┘
       │
       ▼ (Generate Scene & Shot Prompts)
[4. Scene & Shot Prompts] ──(Copy Prompts)──> [Generate Visuals in Google Flow / Veo]
       │                                                         │
       ▼                                                         ▼
[5. Timeline Editor & In-Browser MP4 Export] <───────────────────┘
```

1. **Stage 1 — Story Input:** Enter your original story or narrative outline in English or Bengali.
2. **Stage 2 — Master Voiceover Script:** Generates an expressive, continuous Bangladeshi Bengali storytelling narration with early audience-retention hooks and emotional cadence. Edit or polish wording as desired, then click **Copy Script for Cartesia**.
3. **Stage 3 — Cartesia Audio Synthesis & Duration:** Synthesize audio in Cartesia externally. Enter the actual measured audio duration (minutes and seconds) into the application. Select your **Visual Asset Mode** (`Hybrid`, `All Images`, `All Videos`), **Video Source Asset Duration** (`4s`, `6s`, `8s`), **Static Frame Pacing**, and **Video Sound Mode**.
4. **Stage 4 — Scene & Shot Prompt Generation:** The AI plans complete Story Scenes containing sequential Visual Shots calibrated to cover the exact measured audio duration.
5. **Stage 5 — External Generation & Editing:** Paste generated image/video prompts into external AI generators (e.g. Google Flow). Import generated assets and the Cartesia voiceover audio file into the local timeline editor to assemble transitions, cuts, zooms, and audio levels.
6. **Stage 6 — In-Browser MP4 Export:** Render the finished composition directly in your browser using hardware-accelerated WebCodecs.

---

## ⚡ What the App Does and Does Not Do

### What it DOES:
- Engineers continuous Bangladeshi Bengali narrator voiceover scripts optimized for speech synthesis.
- Plans structured Story Scenes where each scene contains sequential Visual Shots with timecodes, camera movements, text overlays, and complete English image/video prompts.
- Provides dynamic prompt locks matching the selected video source duration (4.0s, 6.0s, or 8.0s).
- Provides a full-featured local timeline editor with multi-track visual/audio layers, ripple editing, cross-dissolve/fade transitions, Ken Burns zoom effects, and audio mixing.
- Renders and exports MP4 video files directly in the browser via WebCodecs and WebAudio without requiring a server-side render farm.

### What it DOES NOT do:
- **No Direct Video Generation API:** The application does not automatically render video or image files via third-party APIs. It produces structured text prompts that the user runs externally in Google Flow or other tools.
- **No Automatic Flow Model Detection:** The application does not detect or change the model, resolution, or settings active in external Google Flow browser tabs. The user selects a matching duration in Flow and in Studio settings.
- **External Voiceover Synthesis:** Audio synthesis is performed by the user in Cartesia; the user supplies the measured duration to the Studio.
- **Prompt-Only Sound Directives:** Video Sound settings (`Silent Video`, `Ambient Sound & SFX`, `Full Generated Audio`) control prompt instructions for external generators; the app does not synthesize standalone environmental SFX.

---

## 🖥️ System & Browser Requirements

- **Runtime:** Node.js 18+ (tested on v24.x), pnpm 9+
- **Browser:** Modern Chromium-based browser (Google Chrome, Microsoft Edge, Brave) or modern Safari/Firefox with support for:
  - [WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) (`VideoEncoder`, `VideoFrame`, `AudioEncoder`)
  - [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) (`OfflineAudioContext`)
- **Export Duration Limit:**
  - **In-Browser MP4 Export:** The safe tested limit for direct in-browser MP4 export is **5 minutes (300 seconds)** due to browser memory limits when encoding frames and muxing audio.
  - **Prompts:** Voiceovers and prompt plans longer than 5 minutes can be generated in the Studio, but timelines exceeding 5 minutes cannot be exported in-browser without trimming or external rendering.

---

## 🛠️ Setup & Running Locally

1. **Install dependencies:**
   ```powershell
   pnpm install
   ```

2. **Configure environment:**
   Copy `.env.local.example` to `.env.local`:
   ```powershell
   copy .env.local.example .env.local
   ```
   Configure your local LLM gateway (`OMNIROUTE_BASE_URL` and `OMNIROUTE_API_KEY`).

3. **Run automated verification:**
   ```powershell
   pnpm test
   pnpm typecheck
   pnpm lint
   pnpm build
   ```

4. **Start the local development server:**
   ```powershell
   pnpm dev
   ```
   Open [http://localhost:3000/studio](http://localhost:3000/studio).
