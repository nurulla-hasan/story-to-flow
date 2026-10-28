# Story to Flow

Story to Flow turns a story into a voiceover-first production package for Google Flow/Veo and includes a timeline editor for assembling generated images, video clips, and audio.

## Current workflow

1. Enter or paste the source story in Studio.
2. Generate the complete Bengali voiceover script.
3. Review and edit the script. Editing it invalidates the old measured duration and scene plan.
4. Copy the script to Cartesia (outside this app), synthesize the narration, and measure the actual audio duration.
5. Enter the measured duration and select visual style, aspect ratio, image pacing, video source duration, visual asset mode, and sound instructions.
6. Generate scene-by-scene prompts. The full voiceover remains the source of truth; scene voiceover excerpts should remain ordered and reconstruct the master script.
7. Generate the assets in Google Flow/Veo, import them into the editor, arrange clips, add transitions, adjust audio, and export an MP4 where the browser supports WebCodecs.

## Highlights

- **Voiceover-first staged workflow:** Story, voiceover, measured duration/settings, then scene generation.
- **Prompt assembly:** Code inserts selected production settings into the active Master Prompt.
- **Visual asset modes:** Hybrid, All Images, and All Videos.
- **Timeline editor:** Arrange visual and audio clips, trim, reorder, insert, and add transitions.
- **Browser MP4 export:** Frame-by-frame rendering and audio-track mixing using WebCodecs where available. The current in-browser export limit is 5 minutes; longer voiceovers need a shorter timeline or a different export workflow.
- **Local project state:** Studio state and imported media are stored in the browser, not in a hosted project database.

## Requirements

- Node.js compatible with the installed Next.js version (Node.js 20.9+ recommended)
- pnpm (the package manager version is declared in `package.json`)
- Windows, macOS, or Linux
- OmniRoute gateway/API configuration for AI generation

## Setup

1. Install dependencies:

   ```powershell
   pnpm install
   ```

2. Configure `.env.local` using `.env.local.example` and set the required OmniRoute values.

3. Run checks:

   ```powershell
   pnpm test
   pnpm typecheck
   pnpm lint
   ```

4. Start the development server:

   ```powershell
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Notes

- Cartesia synthesis and Google Flow/Veo asset generation are external steps; this app prepares scripts and prompts rather than generating those assets itself.
- A measured total narration duration sets overall coverage, but it cannot determine exact internal scene cut points without sentence/scene timestamps.
- For browser MP4 export, use a browser with WebCodecs support and test the result, especially when using embedded video audio, transitions, or long timelines.