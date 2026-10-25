# Premium SFX Pack — Drop-in Cheat Sheet

The editor plays real audio from this folder first:

```
/sfx/<type>.mp3
```

For example, selecting **Whoosh / Fly** in the SFX transform modal requests
`/sfx/whoosh.mp3`. The file is fetched and decoded once per session and then
cached in memory.

If a file is not here yet, playback automatically falls back to the built-in
procedural synthesizer. Nothing breaks, but the premium clips sound much better.

> After adding or replacing files, refresh the editor page once so the browser
> picks up the new audio.

## Files to add

| Filename | Group | Best used for | Search keywords for 1–2s clips | Suggested length |
| --- | --- | --- | --- | --- |
| `whoosh.mp3` | Action & Impact | Fast movement, flying, quick camera pan | `cinematic whoosh transition`, `fast swoosh`, `fly by whoosh` | 0.8–1.5s |
| `heavy-thud.mp3` | Action & Impact | Body fall, crash landing, heavy impact | `heavy body fall thud`, `cinematic impact`, `crash landing` | 1–2s |
| `bonk.mp3` | Action & Impact | Head hit, coconut bonk, wooden knock | `cartoon bonk`, `coconut hit`, `wood knock` | 0.4–1s |
| `glass-shatter.mp3` | Action & Impact | Cup, bottle or window breaking | `glass shatter`, `cup break`, `window smash` | 1–2s |
| `water-splash.mp3` | Action & Impact | Splash in water, curd, pond or mud | `water splash`, `small splash`, `mud splash` | 1–2s |
| `door-slam.mp3` | Action & Impact | Heavy door slamming shut | `heavy door slam`, `wooden door shut`, `door bang` | 1–1.5s |
| `cartoon-pop.mp3` | Cartoon & Comedy | Bubble burst, pop, sudden snap | `cartoon bubble pop`, `bubble burst`, `cork pop` | 0.4–1s |
| `cartoon-slip.mp3` | Cartoon & Comedy | Banana peel, mud slip, comic tumble | `cartoon slip`, `banana peel slip`, `slide whistle fall` | 1–2s |
| `boing.mp3` | Cartoon & Comedy | Spring jump, bounce, funny recoil | `cartoon boing`, `spring bounce`, `comedy boing` | 0.6–1.2s |
| `vine-boom.mp3` | Cartoon & Comedy | Dramatic shock, twist reveal, meme boom | `vine boom`, `dramatic boom`, `shock twist sound` | 1–1.5s |
| `sad-trombone.mp3` | Cartoon & Comedy | Comedy fail, defeat, wah-wah-wah | `sad trombone`, `wah wah fail`, `comedy fail` | 1.5–2.5s |
| `magic-chime.mp3` | Magic | Spell, sparkle, transformation, time freeze | `magic sparkle chime`, `fairy dust`, `transformation shimmer` | 1–2s |
| `thunder.mp3` | Ghost & Horror | Lightning strike, storm rumble | `thunder clap`, `lightning crack`, `storm rumble` | 1.5–2.5s |
| `door-creak.mp3` | Ghost & Horror | Spooky door, slow hinge, clock opening | `creaky door open`, `haunted door creak`, `old hinge` | 1–2.5s |
| `evil-laugh.mp3` | Ghost & Horror | Ghost laugh, villain chuckle, mischief | `evil laugh`, `ghost laugh`, `villain chuckle` | 1.5–2.5s |
| `crow-caw.mp3` | Ghost & Horror | Crow or raven call in the air | `crow caw`, `raven call`, `crow sound effect` | 1–2s |
| `coin-clink.mp3` | Story Detail | Coins, gold treasure, small metal jingle | `coins clink`, `gold coins jingle`, `treasure coins` | 0.8–1.5s |
| `clock-tick.mp3` | Story Detail | Antique watch, wall clock, mechanical tick | `clock ticking`, `pocket watch tick`, `mechanical clock` | 1–2s |

## Audio guidelines

- Use **MP3** files with the exact lowercase filenames above.
- Keep clips short: **1–2 seconds** is ideal, and never longer than the scene
  where they play.
- Prefer clean, dry effects with no music bed or voice in the background.
- Normalize clips to roughly **-3 dB to -6 dB peak** so the editor's volume
  slider has useful range.
- 44.1 kHz or 48 kHz, mono or stereo, 128–192 kbps is plenty.
- Trim silence at the start. The timing offset in the modal is measured from the
  clip start, so leading silence makes hits feel late.
- For `clock-tick.mp3`, a short loopable tick is fine; the editor plays one
  instance at the configured offset.

## Licensing

Only add audio you have the right to use in your videos. Good sources include
royalty-free libraries such as Pixabay Audio, Freesound (check each clip's
license), Mixkit, and Zapsplat. Avoid ripping audio from YouTube, TikTok, games,
or films unless you have an explicit license.

## How playback works

1. **Premium path:** fetch `/sfx/<type>.mp3`, decode it once, cache the
   `AudioBuffer`, and play it through the current `AudioContext`.
2. **Fallback path:** if the file is missing (404) or cannot be decoded, the
   procedural Web Audio synthesizer plays instead.
3. **Live Preview and MP4 export:** both use the same playback function and the
   same destination node, so volume, timing offset, and speed/pitch transforms
   match in the exported video.
