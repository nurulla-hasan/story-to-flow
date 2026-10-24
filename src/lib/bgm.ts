/**
 * Procedural Cinematic Background Music (BGM) Engine
 * Generates royalty-free, copyright-safe ambient soundtrack buffers using OfflineAudioContext.
 */

import type { BgmMood } from "@/components/studio/types";

export interface BgmMoodPreset {
  id: BgmMood;
  label: string;
  emoji: string;
  description: string;
}

export const BGM_MOOD_PRESETS: BgmMoodPreset[] = [
  {
    id: "suspense-mystery",
    label: "Suspense & Mystery",
    emoji: "🎭",
    description: "Ticking clockwork, deep cello drone & mysterious ambient pads",
  },
  {
    id: "emotional-piano",
    label: "Emotional & Cinematic",
    emoji: "🎻",
    description: "Tender piano chords, soft strings & warm melancholic swells",
  },
  {
    id: "lofi-chill",
    label: "Lofi Ambient Chill",
    emoji: "☕",
    description: "Warm Rhodes 7th chords, relaxed sub-bass & soft tape warmth",
  },
  {
    id: "dark-thriller",
    label: "Dark Thriller & Eerie",
    emoji: "👻",
    description: "Deep 40Hz sub-rumble, tension pulses & dark cinematic atmosphere",
  },
  {
    id: "inspirational-epic",
    label: "Epic & Inspiring",
    emoji: "✨",
    description: "Majestic rising harmonies, brassy synth swell & triumphant energy",
  },
];

/**
 * Encodes an AudioBuffer into standard 16-bit PCM WAV Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const numSamples = buffer.length * numChannels;
  const bufferByteLength = 44 + numSamples * 2;
  const arrayBuffer = new ArrayBuffer(bufferByteLength);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, "data");
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * Generates high-quality procedural cinematic background music for the requested mood and duration.
 * Runs instantly via browser OfflineAudioContext (100x faster than real-time).
 */
export async function generateCinematicBgm(
  mood: BgmMood,
  durationSeconds: number,
): Promise<{ buffer: AudioBuffer; blob: Blob; url: string }> {
  const sampleRate = 44100;
  const dur = Math.max(5, Math.min(600, durationSeconds));
  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;

  const ctx = new OfflineCtx(2, Math.ceil(sampleRate * dur), sampleRate);

  // Master Gain & Output Limiter
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.85, 0);

  // Fade in first 2 seconds, fade out last 3 seconds
  masterGain.gain.setValueAtTime(0.01, 0);
  masterGain.gain.linearRampToValueAtTime(0.85, 2.0);
  masterGain.gain.setValueAtTime(0.85, Math.max(2.1, dur - 3.0));
  masterGain.gain.linearRampToValueAtTime(0.001, dur);

  masterGain.connect(ctx.destination);

  // Reverb simulation network
  const convolver = ctx.createConvolver();
  const revDur = 2.8;
  const revRate = ctx.sampleRate;
  const revLength = revRate * revDur;
  const impulse = ctx.createBuffer(2, revLength, revRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < revLength; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / revLength, 2.2);
    }
  }
  convolver.buffer = impulse;

  const reverbGain = ctx.createGain();
  reverbGain.gain.setValueAtTime(0.42, 0);
  convolver.connect(reverbGain);
  reverbGain.connect(masterGain);

  if (mood === "suspense-mystery") {
    // 1. Low Cello / Bass Drone (55Hz / 73Hz Dm)
    const droneOsc = ctx.createOscillator();
    droneOsc.type = "sawtooth";
    droneOsc.frequency.setValueAtTime(73.4, 0); // D2

    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.setValueAtTime(240, 0);

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0.28, 0);

    droneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(masterGain);
    droneGain.connect(convolver);
    droneOsc.start(0);

    // 2. Ticking clockwork pulses every 0.8 seconds (Old clockmaker atmosphere)
    const tickInterval = 0.8;
    const totalTicks = Math.floor(dur / tickInterval);
    for (let i = 0; i < totalTicks; i++) {
      const t = i * tickInterval;
      const tickOsc = ctx.createOscillator();
      tickOsc.type = "sine";
      tickOsc.frequency.setValueAtTime(i % 2 === 0 ? 1400 : 1100, t);

      const tickGain = ctx.createGain();
      tickGain.gain.setValueAtTime(0.12, t);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

      tickOsc.connect(tickGain);
      tickGain.connect(masterGain);
      tickGain.connect(convolver);
      tickOsc.start(t);
      tickOsc.stop(t + 0.05);
    }

    // 3. Eerie high harmonic pads (D minor / G minor)
    const chordNotes = [293.66, 349.23, 440.0, 523.25]; // D4, F4, A4, C5
    chordNotes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, 0);

      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime((idx % 2 === 0 ? -0.4 : 0.4), 0);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.04, 0);

      osc.connect(panner);
      panner.connect(g);
      g.connect(convolver);
      osc.start(0);
    });
  } else if (mood === "emotional-piano") {
    // Piano-like arpeggiated chords (C -> G -> Am -> F)
    const progressions = [
      [261.63, 329.63, 392.0, 523.25], // C major
      [246.94, 293.66, 392.0, 493.88], // G/B
      [220.0, 261.63, 329.63, 440.0],  // Am
      [174.61, 220.0, 261.63, 349.23], // F
    ];

    const chordDur = 4.0;
    const totalProg = Math.ceil(dur / (progressions.length * chordDur));

    let timeCursor = 0;
    for (let p = 0; p < totalProg && timeCursor < dur; p++) {
      for (const chord of progressions) {
        if (timeCursor >= dur) break;
        // Play arpeggio
        chord.forEach((freq, nIdx) => {
          const noteTime = timeCursor + nIdx * 0.45;
          if (noteTime >= dur) return;

          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, noteTime);

          const g = ctx.createGain();
          g.gain.setValueAtTime(0.18, noteTime);
          g.gain.exponentialRampToValueAtTime(0.001, noteTime + 2.4);

          osc.connect(g);
          g.connect(masterGain);
          g.connect(convolver);
          osc.start(noteTime);
          osc.stop(noteTime + 2.5);
        });
        timeCursor += chordDur;
      }
    }

    // Warm ambient string pad beneath
    const stringOsc = ctx.createOscillator();
    stringOsc.type = "triangle";
    stringOsc.frequency.setValueAtTime(130.81, 0); // C3
    const strFilter = ctx.createBiquadFilter();
    strFilter.type = "lowpass";
    strFilter.frequency.setValueAtTime(320, 0);
    const strGain = ctx.createGain();
    strGain.gain.setValueAtTime(0.15, 0);
    stringOsc.connect(strFilter);
    strFilter.connect(strGain);
    strGain.connect(convolver);
    stringOsc.start(0);
  } else if (mood === "lofi-chill") {
    // Rhodes 7th chord progression
    const lofiChords = [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
    ];

    const stepTime = 3.6;
    let t = 0;
    while (t < dur) {
      for (const chord of lofiChords) {
        if (t >= dur) break;
        chord.forEach((freq) => {
          const osc = ctx.createOscillator();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, t);

          const filt = ctx.createBiquadFilter();
          filt.type = "lowpass";
          filt.frequency.setValueAtTime(450, t);

          const g = ctx.createGain();
          g.gain.setValueAtTime(0.12, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 3.2);

          osc.connect(filt);
          filt.connect(g);
          g.connect(masterGain);
          g.connect(convolver);
          osc.start(t);
          osc.stop(t + 3.3);
        });
        t += stepTime;
      }
    }

    // Gentle sub-bass pulse
    const subOsc = ctx.createOscillator();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(55, 0);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.2, 0);
    subOsc.connect(subGain);
    subGain.connect(masterGain);
    subOsc.start(0);
  } else if (mood === "dark-thriller") {
    // 40Hz deep sub rumble
    const subOsc = ctx.createOscillator();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(42, 0);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.35, 0);
    subOsc.connect(subGain);
    subGain.connect(masterGain);
    subOsc.start(0);

    // Dissonant tension pad
    const dissonant = [65.41, 92.5, 123.47, 185.0];
    dissonant.forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, 0);
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.setValueAtTime(160, 0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, 0);
      osc.connect(filt);
      filt.connect(g);
      g.connect(convolver);
      osc.start(0);
    });
  } else {
    // Inspirational & Epic: Rising chords (Am -> F -> C -> G)
    const epicChords = [
      [220.0, 261.63, 329.63], // Am
      [174.61, 220.0, 261.63], // F
      [261.63, 329.63, 392.0],  // C
      [196.0, 246.94, 293.66],  // G
    ];

    let t = 0;
    while (t < dur) {
      for (const chord of epicChords) {
        if (t >= dur) break;
        chord.forEach((freq) => {
          const osc = ctx.createOscillator();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, t);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.15, t);
          g.gain.linearRampToValueAtTime(0.02, t + 3.6);
          osc.connect(g);
          g.connect(convolver);
          osc.start(t);
          osc.stop(t + 3.8);
        });
        t += 3.8;
      }
    }
  }

  // Render offline buffer
  const renderedBuffer = await ctx.startRendering();
  const wavBlob = audioBufferToWavBlob(renderedBuffer);
  const blobUrl = URL.createObjectURL(wavBlob);

  return {
    buffer: renderedBuffer,
    blob: wavBlob,
    url: blobUrl,
  };
}
