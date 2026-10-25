/**
 * SFX (Foley) engine.
 *
 * Premium playback path: `/sfx/{type}.mp3` is fetched once, decoded once and
 * cached in `sfxPresetBufferCache`. If the file has not been added yet, or the
 * browser cannot decode it, the procedural Web Audio synthesizer below is used
 * as a graceful fallback so playback never breaks.
 *
 * Both paths connect to the caller-provided destination node. That is the
 * speaker destination in Live Preview and the MediaStream destination in MP4
 * export, so the same timing / volume / speed transforms apply in both.
 */

import type { ClipSfxConfig, SfxType } from "@/components/studio/types";

export const sfxAudioBufferCache = new Map<string, AudioBuffer>();
export const sfxPresetBufferCache = new Map<SfxType, AudioBuffer>();

const sfxPresetLoadPromises = new Map<SfxType, Promise<AudioBuffer | null>>();
const missingPresetFiles = new Set<SfxType>();

function clampPlaybackRate(value: number): number {
  return Math.max(0.2, Math.min(3.0, Number.isFinite(value) ? value : 1));
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? value : 1));
}

function presetUrl(type: SfxType): string {
  return `/sfx/${type}.mp3`;
}

function createNoiseBuffer(
  audioCtx: AudioContext,
  seconds: number,
): AudioBuffer {
  const length = Math.max(1, Math.floor(audioCtx.sampleRate * seconds));
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export async function loadAudioBuffer(
  audioCtx: AudioContext,
  url: string,
): Promise<AudioBuffer | null> {
  const cached = sfxAudioBufferCache.get(url);
  if (cached) return cached;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(buf);
    sfxAudioBufferCache.set(url, decoded);
    return decoded;
  } catch (err) {
    console.warn("[sfx] Failed to load audio buffer:", err);
    return null;
  }
}

/**
 * Load a bundled premium effect exactly once. A 404 is expected until the
 * matching file is dropped into `public/sfx/`, so it deliberately does not
 * warn or retry on every playback.
 */
export async function loadPresetSfxBuffer(
  audioCtx: AudioContext,
  type: SfxType,
): Promise<AudioBuffer | null> {
  if (type === "none") return null;

  const cached = sfxPresetBufferCache.get(type);
  if (cached) return cached;
  if (missingPresetFiles.has(type)) return null;

  const pending = sfxPresetLoadPromises.get(type);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const res = await fetch(presetUrl(type));
      if (!res.ok) {
        // 404 until the user adds the file. Remember the miss for this session.
        missingPresetFiles.add(type);
        return null;
      }

      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        missingPresetFiles.add(type);
        return null;
      }

      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      sfxPresetBufferCache.set(type, decoded);
      sfxAudioBufferCache.set(presetUrl(type), decoded);
      return decoded;
    } catch (err) {
      // A transient fetch/decode error should not permanently disable the
      // fallback path; retry on the next trigger.
      console.warn(
        `[sfx] Could not load ${presetUrl(type)}; using synth fallback.`,
        err,
      );
      return null;
    } finally {
      sfxPresetLoadPromises.delete(type);
    }
  })();

  sfxPresetLoadPromises.set(type, promise);
  return promise;
}

function playDecodedBuffer(
  audioCtx: AudioContext,
  buffer: AudioBuffer,
  destination: AudioNode,
  volume: number,
  speed: number,
): void {
  const now = audioCtx.currentTime;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.setValueAtTime(clampPlaybackRate(speed), now);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(clampVolume(volume), now);

  source.connect(gain);
  gain.connect(destination);
  source.start(now);
}

/**
 * Premium-first playback for a bundled preset. Falls back to the procedural
 * synthesizer when its `.mp3` is missing.
 */
export async function playBundledOrProceduralSfx(
  audioCtx: AudioContext,
  type: SfxType,
  destination: AudioNode = audioCtx.destination,
  volume = 0.8,
  speed = 1.0,
): Promise<void> {
  if (!type || type === "none" || !audioCtx) return;

  const buffer = await loadPresetSfxBuffer(audioCtx, type);
  if (buffer) {
    playDecodedBuffer(audioCtx, buffer, destination, volume, speed);
    return;
  }

  playProceduralSfx(audioCtx, type, destination, volume, speed);
}

export function playProceduralSfx(
  audioCtx: AudioContext,
  type: SfxType,
  destination: AudioNode = audioCtx.destination,
  volume = 0.8,
  speed = 1.0,
): void {
  if (!type || type === "none" || !audioCtx) return;

  const now = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.gain.setValueAtTime(clampVolume(volume), now);
  master.connect(destination);

  const spd = clampPlaybackRate(speed);
  const durScale = 1 / spd;
  const pitchScale = spd;

  if (type === "cartoon-pop") {
    // 1400Hz -> 350Hz rapid pitch drop
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1400 * pitchScale, now);
    osc.frequency.exponentialRampToValueAtTime(350 * pitchScale, now + 0.07 * durScale);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08 * durScale);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.09 * durScale);
  } else if (type === "heavy-thud") {
    // 120Hz -> 32Hz deep bass impact drop layered with low-pass filtered noise punch
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120 * pitchScale, now);
    osc.frequency.exponentialRampToValueAtTime(32 * pitchScale, now + 0.35 * durScale);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38 * durScale);

    const bufferSize = Math.floor(audioCtx.sampleRate * 0.15 * durScale);
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.sampleRate * 0.03 * durScale));
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(180 * pitchScale, now);

    noise.connect(filter);
    filter.connect(gain);
    noise.start(now);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.4 * durScale);
  } else if (type === "whoosh") {
    // 250Hz -> 2200Hz -> 300Hz bandpass filtered noise sweep
    const bufferSize = Math.floor(audioCtx.sampleRate * 0.35 * durScale);
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(3.0, now);
    filter.frequency.setValueAtTime(250 * pitchScale, now);
    filter.frequency.exponentialRampToValueAtTime(2200 * pitchScale, now + 0.18 * durScale);
    filter.frequency.exponentialRampToValueAtTime(300 * pitchScale, now + 0.35 * durScale);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.7, now + 0.18 * durScale);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.35 * durScale);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
  } else if (type === "magic-chime") {
    // Ascending arpeggio on triangle wave frequencies
    const freqs = [1046.5, 1318.5, 1567.98, 2093.0, 2637.0];
    freqs.forEach((freq, idx) => {
      const t = now + idx * 0.05 * durScale;
      const osc = audioCtx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq * pitchScale, t);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8 * durScale);

      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.85 * durScale);
    });
  } else if (type === "glass-shatter") {
    // Multi-frequency high-pitch metallic clinks
    const clinks = [2200, 3100, 4400, 5800];
    clinks.forEach((freq, idx) => {
      const t = now + idx * 0.03 * durScale;
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * pitchScale, t);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22 * durScale);

      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.25 * durScale);
    });
  } else if (type === "boing") {
    // Cartoon pitch-bending upward & downward ramp
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140 * pitchScale, now);
    osc.frequency.linearRampToValueAtTime(420 * pitchScale, now + 0.18 * durScale);
    osc.frequency.linearRampToValueAtTime(260 * pitchScale, now + 0.35 * durScale);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38 * durScale);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.4 * durScale);
  } else if (type === "crow-caw") {
    // Dual-burst bandpass filtered sawtooth wave
    [0, 0.24 * durScale].forEach((offset) => {
      const t = now + offset;
      const osc = audioCtx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(750 * pitchScale, t);
      osc.frequency.linearRampToValueAtTime(580 * pitchScale, t + 0.18 * durScale);

      const filter = audioCtx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(950 * pitchScale, t);
      filter.Q.setValueAtTime(4.0, t);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19 * durScale);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.2 * durScale);
    });
  } else if (type === "clock-tick") {
    // Ultra-short sharp sine click
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1600 * pitchScale, now);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04 * durScale);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.05 * durScale);
  } else if (type === "bonk") {
    // Hollow coconut knock: fast low sine drop plus a tiny wooden click.
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220 * pitchScale, now);
    osc.frequency.exponentialRampToValueAtTime(72 * pitchScale, now + 0.14 * durScale);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2 * durScale);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.22 * durScale);
  } else if (type === "cartoon-slip") {
    // Descending slide whistle followed by a soft comic landing.
    const whistle = audioCtx.createOscillator();
    whistle.type = "sine";
    whistle.frequency.setValueAtTime(1150 * pitchScale, now);
    whistle.frequency.exponentialRampToValueAtTime(210 * pitchScale, now + 0.4 * durScale);

    const whistleGain = audioCtx.createGain();
    whistleGain.gain.setValueAtTime(0.35, now);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44 * durScale);

    whistle.connect(whistleGain);
    whistleGain.connect(master);
    whistle.start(now);
    whistle.stop(now + 0.46 * durScale);

    const thud = audioCtx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(95 * pitchScale, now + 0.38 * durScale);
    thud.frequency.exponentialRampToValueAtTime(52 * pitchScale, now + 0.5 * durScale);

    const thudGain = audioCtx.createGain();
    thudGain.gain.setValueAtTime(0.5, now + 0.38 * durScale);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.56 * durScale);

    thud.connect(thudGain);
    thudGain.connect(master);
    thud.start(now + 0.38 * durScale);
    thud.stop(now + 0.58 * durScale);
  } else if (type === "water-splash") {
    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(audioCtx, 0.5 * durScale);

    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800 * pitchScale, now);
    filter.Q.setValueAtTime(1.2, now);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.7, now + 0.02 * durScale);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45 * durScale);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
  } else if (type === "vine-boom") {
    // Deep meme boom with a short low-frequency noise tail.
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95 * pitchScale, now);
    osc.frequency.exponentialRampToValueAtTime(34 * pitchScale, now + 0.5 * durScale);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55 * durScale);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.58 * durScale);
  } else if (type === "thunder") {
    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(audioCtx, 1.2 * durScale);

    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(320 * pitchScale, now);
    filter.frequency.exponentialRampToValueAtTime(80 * pitchScale, now + 1.1 * durScale);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.9, now + 0.04 * durScale);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15 * durScale);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
  } else if (type === "door-creak") {
    // Slow, unstable hinge squeal.
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(190 * pitchScale, now);
    osc.frequency.linearRampToValueAtTime(320 * pitchScale, now + 0.28 * durScale);
    osc.frequency.linearRampToValueAtTime(150 * pitchScale, now + 0.65 * durScale);

    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(800 * pitchScale, now);
    filter.Q.setValueAtTime(5.0, now);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.08 * durScale);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68 * durScale);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.7 * durScale);
  } else if (type === "door-slam") {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(105 * pitchScale, now);
    osc.frequency.exponentialRampToValueAtTime(45 * pitchScale, now + 0.18 * durScale);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24 * durScale);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.26 * durScale);

    const noise = audioCtx.createBufferSource();
    noise.buffer = createNoiseBuffer(audioCtx, 0.14 * durScale);
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500 * pitchScale, now);
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14 * durScale);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);
  } else if (type === "coin-clink") {
    [2800, 3600, 4400].forEach((freq, idx) => {
      const t = now + idx * 0.045 * durScale;
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * pitchScale, t);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18 * durScale);

      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.2 * durScale);
    });
  } else if (type === "evil-laugh") {
    [0, 0.14, 0.28, 0.42].forEach((offset) => {
      const t = now + offset * durScale;
      const osc = audioCtx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(520 * pitchScale, t);
      osc.frequency.linearRampToValueAtTime(340 * pitchScale, t + 0.11 * durScale);

      const filter = audioCtx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(760 * pitchScale, t);
      filter.Q.setValueAtTime(3.5, t);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.28, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13 * durScale);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + 0.15 * durScale);
    });
  } else if (type === "sad-trombone") {
    const notes = [392, 349, 311];
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.28 * durScale;
      const length = idx === notes.length - 1 ? 0.55 : 0.24;
      const osc = audioCtx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq * pitchScale, t);
      osc.frequency.linearRampToValueAtTime(
        freq * 0.94 * pitchScale,
        t + length * durScale,
      );

      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400 * pitchScale, t);
      filter.frequency.exponentialRampToValueAtTime(600 * pitchScale, t + length * durScale);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.32, t + 0.03 * durScale);
      gain.gain.exponentialRampToValueAtTime(0.001, t + length * durScale);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + length * durScale + 0.02);
    });
  }
}

export async function playCustomSfx(
  audioCtx: AudioContext,
  url: string,
  destination: AudioNode = audioCtx.destination,
  volume = 1.0,
  speed = 1.0,
): Promise<void> {
  if (!url || !audioCtx) return;
  const buffer = await loadAudioBuffer(audioCtx, url);
  if (!buffer) return;
  playDecodedBuffer(audioCtx, buffer, destination, volume, speed);
}

export async function playUniversalSfx(
  audioCtx: AudioContext,
  config: ClipSfxConfig | SfxType,
  destination: AudioNode = audioCtx.destination,
): Promise<void> {
  if (!config) return;

  if (typeof config === "string") {
    await playBundledOrProceduralSfx(audioCtx, config, destination, 0.8, 1.0);
    return;
  }

  const vol = config.volume ?? 1.0;
  const spd = config.speed ?? 1.0;

  if (config.type === "custom" && config.customUrl) {
    await playCustomSfx(audioCtx, config.customUrl, destination, vol, spd);
  } else if (config.type !== "custom" && config.type !== "none") {
    await playBundledOrProceduralSfx(
      audioCtx,
      config.type,
      destination,
      vol,
      spd,
    );
  }
}
