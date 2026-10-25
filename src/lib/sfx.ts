/**
 * Procedural SFX (Foley / Sound Effects) Engine
 * Synthesizes high-impact royalty-free sound effects on-demand via Web Audio API.
 */

import type { ClipSfxConfig, SfxType } from "@/components/studio/types";

export const sfxAudioBufferCache = new Map<string, AudioBuffer>();

export async function loadAudioBuffer(
  audioCtx: AudioContext,
  url: string,
): Promise<AudioBuffer | null> {
  if (sfxAudioBufferCache.has(url)) return sfxAudioBufferCache.get(url)!;
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(buf);
    sfxAudioBufferCache.set(url, decoded);
    return decoded;
  } catch (err) {
    console.warn("[sfx] Failed to load audio buffer:", err);
    return null;
  }
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
  master.gain.setValueAtTime(Math.max(0, volume), now);
  master.connect(destination);

  const spd = Math.max(0.2, Math.min(3.0, speed));
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

  const now = audioCtx.currentTime;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = Math.max(0.2, Math.min(3.0, speed));

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(Math.max(0, volume), now);

  source.connect(gain);
  gain.connect(destination);
  source.start(now);
}

export async function playUniversalSfx(
  audioCtx: AudioContext,
  config: ClipSfxConfig | SfxType,
  destination: AudioNode = audioCtx.destination,
): Promise<void> {
  if (!config) return;

  if (typeof config === "string") {
    playProceduralSfx(audioCtx, config, destination);
    return;
  }

  const vol = config.volume ?? 1.0;
  const spd = config.speed ?? 1.0;

  if (config.type === "custom" && config.customUrl) {
    await playCustomSfx(audioCtx, config.customUrl, destination, vol, spd);
  } else if (config.type !== "custom" && config.type !== "none") {
    playProceduralSfx(audioCtx, config.type, destination, vol, spd);
  }
}

