"use client";

import * as React from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Clock,
  Copy,
  Download,
  FastForward,
  Film,
  Headphones,
  ImagePlus,
  Loader2,
  Music,
  Palette,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Sparkles,
  Subtitles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import type { BgmMood, ClipMotion, StudioClip, StudioProject } from "./types";
import { api } from "@/lib/apiClient";
import { BGM_MOOD_PRESETS, generateCinematicBgm } from "@/lib/bgm";

function generateClipId(): string {
  return `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

interface VideoEditorProps {
  project: StudioProject;
  onUpdateProject: (patch: Partial<StudioProject>) => void;
  onUpdateClip: (clipId: string, patch: Partial<StudioClip>) => void;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
  onImportImagesClick: () => void;
}

export function VideoEditor({
  project,
  onUpdateProject,
  onUpdateClip,
  notify,
  onImportImagesClick,
}: VideoEditorProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [isMuted, setIsMuted] = React.useState(false);
  const [showSubtitles, setShowSubtitles] = React.useState(true);
  const [selectedClipId, setSelectedClipId] = React.useState<string | null>(null);

  // Timeline scale & waveform
  const [pxPerSec, setPxPerSec] = React.useState(50);
  const [audioPeaks, setAudioPeaks] = React.useState<number[] | null>(null);
  const [resizingClip, setResizingClip] = React.useState<{ id: string; duration: number } | null>(null);
  const resizingRef = React.useRef<{ clipId: string; edge: "left" | "right"; startX: number; initialDur: number } | null>(null);

  // Audio & Export state
  const [uploadingAudio, setUploadingAudio] = React.useState(false);
  const [generatingBgm, setGeneratingBgm] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportProgress, setExportProgress] = React.useState(0);
  const [isGeneratingMore, setIsGeneratingMore] = React.useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const bgmRef = React.useRef<HTMLAudioElement | null>(null);
  const audioInputRef = React.useRef<HTMLInputElement>(null);
  const bgmInputRef = React.useRef<HTMLInputElement>(null);
  const singleImageInputRef = React.useRef<HTMLInputElement>(null);
  const targetClipForImageRef = React.useRef<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const waveformCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const animFrameRef = React.useRef<number | null>(null);
  const timelineScrollRef = React.useRef<HTMLDivElement>(null);

  // Preloaded image elements cache for smooth real-time rendering
  const imageCacheRef = React.useRef<Map<string, HTMLImageElement>>(new Map());

  const totalDuration = React.useMemo(() => {
    return Math.max(
      1,
      project.clips.reduce((acc, c) => acc + (c.duration || 3), 0),
    );
  }, [project.clips]);

  const currentSpeed = project.audioSpeed || 1.0;
  const [customDuration, setCustomDuration] = React.useState("5.0");

  const effectiveAudioDuration = React.useMemo(() => {
    return project.audioDuration > 0 ? project.audioDuration / currentSpeed : 0;
  }, [project.audioDuration, currentSpeed]);

  const durationDeficit = React.useMemo(() => {
    return effectiveAudioDuration > 0 ? effectiveAudioDuration - totalDuration : 0;
  }, [effectiveAudioDuration, totalDuration]);

  const clipsNeeded = React.useMemo(() => {
    const baseDur = project.defaultClipDuration || 3;
    return Math.max(1, Math.ceil(durationDeficit / baseDur));
  }, [durationDeficit, project.defaultClipDuration]);

  const isAllSameDuration = (d: number) => {
    return (
      project.clips.length > 0 &&
      project.clips.every((c) => Math.abs((c.duration || 3) - d) < 0.05)
    );
  };

  // Compute timing for each clip: { clip, start, end }
  const clipTimings = React.useMemo(() => {
    let cur = 0;
    const timings: { clip: StudioClip; start: number; end: number }[] = [];
    for (const clip of project.clips) {
      const dur = clip.duration || 3;
      const start = cur;
      const end = cur + dur;
      cur = end;
      timings.push({ clip, start, end });
    }
    return timings;
  }, [project.clips]);

  // Find active clip at currentTime
  const activeClipIndex = React.useMemo(() => {
    const idx = clipTimings.findIndex(
      (t) => currentTime >= t.start && currentTime < t.end,
    );
    return idx === -1 ? Math.max(0, clipTimings.length - 1) : idx;
  }, [clipTimings, currentTime]);

  const activeTiming = clipTimings[activeClipIndex] || null;

  // Preload attached images
  React.useEffect(() => {
    project.clips.forEach((clip) => {
      if (clip.imageUrl && !imageCacheRef.current.has(clip.imageUrl)) {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = clip.imageUrl;
        img.onload = () => {
          imageCacheRef.current.set(clip.imageUrl!, img);
        };
      }
    });
  }, [project.clips]);

  const voiceVolume = project.voiceVolume ?? 1.0;
  const bgmVolume = project.bgmVolume ?? 0.20;
  const saturation = project.saturation ?? 100;

  // Handle Voiceover & BGM play/pause (runs ONLY when isPlaying state toggles, not on every tick!)
  React.useEffect(() => {
    const audio = audioRef.current;
    const bgm = bgmRef.current;

    if (isPlaying) {
      if (audio) {
        audio.currentTime = currentTime;
        audio.playbackRate = currentSpeed;
        audio.volume = isMuted ? 0 : voiceVolume;
        audio.play().catch(() => {});
      }
      if (bgm) {
        bgm.currentTime = currentTime % (bgm.duration || totalDuration);
        bgm.volume = isMuted ? 0 : bgmVolume;
        bgm.play().catch(() => {});
      }
    } else {
      if (audio) audio.pause();
      if (bgm) bgm.pause();
    }
  }, [isPlaying]);

  // Update audio playback rate when speed setting changes
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = currentSpeed;
    }
  }, [currentSpeed]);

  // Update Voiceover volume/mute dynamically without restarting audio
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : voiceVolume;
    }
  }, [voiceVolume, isMuted]);

  // Update BGM volume/mute dynamically without restarting audio
  React.useEffect(() => {
    if (bgmRef.current) {
      bgmRef.current.volume = isMuted ? 0 : bgmVolume;
    }
  }, [bgmVolume, isMuted]);

  // Sync audio time ONLY when user manually seeks (dragging playhead / clicking timeline)
  const seekTo = React.useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(time, totalDuration));
      setCurrentTime(clamped);
      if (audioRef.current) {
        audioRef.current.currentTime = clamped;
        audioRef.current.playbackRate = currentSpeed;
      }
      if (bgmRef.current) {
        bgmRef.current.currentTime = clamped % (bgmRef.current.duration || totalDuration);
      }
    },
    [totalDuration, currentSpeed],
  );

  // Playback animation loop: Uses audio hardware clock as master clock when audio is present
  React.useEffect(() => {
    let lastStamp = performance.now();

    const loop = (stamp: number) => {
      if (isPlaying) {
        const audio = audioRef.current;
        // When voiceover audio is loaded and playing, sync canvas time directly to audio clock
        if (audio && !audio.paused && !audio.ended && Number.isFinite(audio.currentTime)) {
          setCurrentTime(audio.currentTime);
          if (audio.currentTime >= totalDuration) {
            setIsPlaying(false);
            seekTo(0);
            return;
          }
        } else {
          // Fallback animation clock when audio is not yet attached
          const delta = (stamp - lastStamp) / 1000;
          setCurrentTime((prev) => {
            const next = prev + delta * currentSpeed;
            if (next >= totalDuration) {
              setIsPlaying(false);
              seekTo(0);
              return 0;
            }
            return next;
          });
        }
      }
      lastStamp = stamp;
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, totalDuration, currentSpeed, seekTo]);

  const timelineWidth = React.useMemo(() => {
    return Math.max(800, totalDuration * pxPerSec);
  }, [totalDuration, pxPerSec]);

  // Decode Voiceover Audio Waveform Peaks
  React.useEffect(() => {
    if (!project.audioUrl) {
      setAudioPeaks(null);
      return;
    }

    let canceled = false;
    (async () => {
      try {
        const audioCtx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const res = await fetch(project.audioUrl!);
        const arrayBuf = await res.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        if (canceled) return;

        const channelData = decoded.getChannelData(0);
        const sampleCount = 1000;
        const blockSize = Math.floor(channelData.length / sampleCount);
        const peaks: number[] = [];

        for (let i = 0; i < sampleCount; i++) {
          let max = 0;
          const start = i * blockSize;
          const end = Math.min(channelData.length, start + blockSize);
          for (let j = start; j < end; j += 4) {
            const val = Math.abs(channelData[j]);
            if (val > max) max = val;
          }
          peaks.push(max);
        }

        setAudioPeaks(peaks);
        if (audioCtx.state !== "closed") audioCtx.close();
      } catch (err) {
        console.warn("[editor] Could not decode audio waveform:", err);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [project.audioUrl]);

  // Render Cyan Waveform onto waveformCanvas
  React.useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = Math.ceil(timelineWidth);
    const height = 54;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    if (!audioPeaks || audioPeaks.length === 0 || !project.audioDuration) {
      return;
    }

    const audioPixels = (project.audioDuration / currentSpeed) * pxPerSec;
    const barWidth = 2;
    const gap = 1;
    const totalBars = Math.floor(audioPixels / (barWidth + gap));

    ctx.fillStyle = "#06b6d4"; // CapCut cyan waveform

    for (let i = 0; i < totalBars; i++) {
      const peakIdx = Math.floor((i / totalBars) * audioPeaks.length);
      const amp = audioPeaks[peakIdx] || 0;
      const barH = Math.max(2, Math.min(height - 6, amp * (height - 8)));
      const x = i * (barWidth + gap);
      const y = (height - barH) / 2;
      ctx.fillRect(x, y, barWidth, barH);
    }
  }, [audioPeaks, timelineWidth, pxPerSec, project.audioDuration, currentSpeed]);

  // CapCut-style drag handles to stretch / shrink images
  const startResizing = React.useCallback(
    (e: React.MouseEvent, clipId: string, edge: "left" | "right") => {
      e.stopPropagation();
      e.preventDefault();
      const clip = project.clips.find((c) => c.id === clipId);
      if (!clip) return;

      resizingRef.current = {
        clipId,
        edge,
        startX: e.clientX,
        initialDur: clip.duration || 3.0,
      };
      setResizingClip({ id: clipId, duration: clip.duration || 3.0 });

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizingRef.current) return;
        const { clipId: id, startX, initialDur } = resizingRef.current;
        const deltaX = moveEvent.clientX - startX;
        const deltaSec = deltaX / pxPerSec;
        const newDur = Math.max(0.5, Math.min(30, Number((initialDur + deltaSec).toFixed(1))));

        setResizingClip({ id, duration: newDur });
        onUpdateClip(id, { duration: newDur });
      };

      const handleMouseUp = () => {
        resizingRef.current = null;
        setResizingClip(null);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [project.clips, pxPerSec, onUpdateClip],
  );

  // Draw a single frame at the given timestamp with frame-accurate custom clip durations
  const drawFrame = React.useCallback(
    (time: number, ctx: CanvasRenderingContext2D, width: number, height: number) => {
      // 1. Fill background
      ctx.fillStyle = "#0c131a";
      ctx.fillRect(0, 0, width, height);

      // 2. Find exact clip active at this timestamp in clipTimings
      let timing = clipTimings.find((t) => time >= t.start && time < t.end);
      if (!timing && clipTimings.length > 0) {
        timing = time >= totalDuration ? clipTimings[clipTimings.length - 1] : clipTimings[0];
      }
      if (!timing) return;

      const { clip, start, end } = timing;
      const clipDur = Math.max(0.1, end - start);
      const progress = Math.max(0, Math.min(1, (time - start) / clipDur));

      // 3. Draw Image with Ken Burns Motion and Saturation
      const cachedImg = clip.imageUrl ? imageCacheRef.current.get(clip.imageUrl) : null;

      if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
        ctx.save();

        if (saturation !== 100) {
          ctx.filter = `saturate(${saturation}%)`;
        }

        let scale = 1.0;
        let offsetX = 0;
        const offsetY = 0;

        const motion: ClipMotion = clip.motion || "zoom-in";
        if (motion === "zoom-in") {
          scale = 1.0 + progress * 0.12;
        } else if (motion === "zoom-out") {
          scale = 1.12 - progress * 0.12;
        } else if (motion === "pan-left") {
          scale = 1.08;
          offsetX = (progress - 0.5) * 36;
        } else if (motion === "pan-right") {
          scale = 1.08;
          offsetX = (0.5 - progress) * 36;
        }

        ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
        ctx.scale(scale, scale);

        // Fit aspect cover
        const imgRatio = cachedImg.naturalWidth / cachedImg.naturalHeight;
        const canvasRatio = width / height;
        let renderW = width;
        let renderH = height;

        if (imgRatio > canvasRatio) {
          renderH = height;
          renderW = height * imgRatio;
        } else {
          renderW = width;
          renderH = width / imgRatio;
        }

        ctx.drawImage(cachedImg, -renderW / 2, -renderH / 2, renderW, renderH);
        ctx.restore();
      } else {
        // Placeholder when no image is attached yet
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`Image #${clip.index}`, width / 2, height / 2 - 20);
        ctx.font = "20px sans-serif";
        ctx.fillText("Attach or import image to view", width / 2, height / 2 + 25);
      }

      // 4. Draw Subtitles Overlay (Bengali Narration)
      if (showSubtitles && clip.narration) {
        const text = clip.narration;
        const fontSize = project.aspectRatio === "9:16" ? 34 : 38;
        ctx.font = `600 ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const maxLineWidth = width * 0.86;
        const words = text.split(" ");
        const lines: string[] = [];
        let currentLine = "";

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(testLine).width > maxLineWidth) {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        const lineHeight = fontSize * 1.35;
        const totalTextH = lines.length * lineHeight;
        const posY = height * 0.82;

        const padX = 28;
        const padY = 16;
        let maxW = 0;
        lines.forEach((l) => {
          maxW = Math.max(maxW, ctx.measureText(l).width);
        });

        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.beginPath();
        const rx = width / 2 - maxW / 2 - padX;
        const ry = posY - totalTextH / 2 - padY;
        const rw = maxW + padX * 2;
        const rh = totalTextH + padY * 2;
        ctx.roundRect(rx, ry, rw, rh, 16);
        ctx.fill();

        ctx.fillStyle = "#fef08a";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 6;

        lines.forEach((line, idx) => {
          const lineY = posY - totalTextH / 2 + idx * lineHeight + lineHeight / 2;
          ctx.fillText(line, width / 2, lineY);
        });

        ctx.restore();
      }
    },
    [clipTimings, totalDuration, saturation, showSubtitles, project.aspectRatio],
  );

  // Canvas Real-Time Render (Draws Active Frame in live editor preview)
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = project.aspectRatio === "9:16" ? 720 : 1280;
    const height = project.aspectRatio === "9:16" ? 1280 : 720;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    drawFrame(currentTime, ctx, width, height);
  }, [currentTime, drawFrame, project.aspectRatio]);

  // Audio Upload Handler
  const handleAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAudio(true);
    notify("Uploading and analyzing voiceover audio…", "info");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api<{
        success: boolean;
        files: { name: string; url: string; kind: string }[];
      }>("/api/studio/upload", {
        method: "POST",
        body: formData,
      });

      const uploaded = res.files?.[0];
      if (uploaded?.url) {
        // Measure audio duration
        const tempAudio = new Audio(uploaded.url);
        tempAudio.onloadedmetadata = () => {
          const dur = Math.round(tempAudio.duration);
          onUpdateProject({
            audioUrl: uploaded.url,
            audioDuration: dur || 0,
          });
          notify(`Voiceover audio loaded (${dur}s duration)!`, "success");
        };
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to upload audio", "error");
    } finally {
      setUploadingAudio(false);
      if (audioInputRef.current) audioInputRef.current.value = "";
    }
  };

  // Generate Procedural Cinematic BGM
  const handleGenerateBgm = async (mood: BgmMood) => {
    setGeneratingBgm(true);
    notify(`Synthesizing ${mood} background music for ${totalDuration.toFixed(0)}s…`, "info");

    try {
      const result = await generateCinematicBgm(mood, totalDuration);
      onUpdateProject({
        bgmUrl: result.url,
        bgmMood: mood,
        bgmVolume: 0.18,
      });

      if (bgmRef.current) {
        bgmRef.current.src = result.url;
        bgmRef.current.volume = isMuted ? 0 : 0.18;
        if (isPlaying) {
          bgmRef.current.currentTime = currentTime;
          bgmRef.current.play().catch(() => {});
        }
      }

      notify(`Background music (${mood}) generated & mixed!`, "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to generate BGM", "error");
    } finally {
      setGeneratingBgm(false);
    }
  };

  // Upload Custom BGM Track
  const handleCustomBgmUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    notify("Uploading custom background music…", "info");
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api<{
        success: boolean;
        files: { name: string; url: string; kind: string }[];
      }>("/api/studio/upload", {
        method: "POST",
        body: formData,
      });

      const uploaded = res.files?.[0];
      if (uploaded?.url) {
        onUpdateProject({
          bgmUrl: uploaded.url,
          bgmMood: "custom",
          bgmVolume: 0.18,
        });
        notify("Custom background music loaded and mixed!", "success");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to upload BGM", "error");
    } finally {
      if (bgmInputRef.current) bgmInputRef.current.value = "";
    }
  };

  // Auto-sync clips duration with audio length and speed
  const handleAutoSyncAudio = () => {
    if (!project.audioDuration || project.audioDuration <= 0) {
      notify("Please import a voiceover audio track first.", "error");
      return;
    }
    if (project.clips.length === 0) return;

    const speed = project.audioSpeed || 1.0;
    const effectiveAudioDur = project.audioDuration / speed;
    const perClip = Number((effectiveAudioDur / project.clips.length).toFixed(1));
    const safeDur = Math.max(0.5, perClip);

    const updatedClips = project.clips.map((clip) => ({
      ...clip,
      duration: safeDur,
    }));

    onUpdateProject({
      defaultClipDuration: safeDur,
      clips: updatedClips,
    });

    notify(
      `Synchronized ${project.clips.length} clips to ${safeDur}s each (${effectiveAudioDur.toFixed(1)}s at ${speed}x)!`,
      "success",
    );
  };

  // Set All Clips Duration simultaneously (e.g. 5.0s, 3.0s, or any custom)
  const handleSetAllClipsDuration = (dur: number) => {
    if (project.clips.length === 0) return;
    const safeDur = Math.max(0.5, Math.min(60, Number(dur.toFixed(1))));
    const updatedClips = project.clips.map((clip) => ({
      ...clip,
      duration: safeDur,
    }));

    onUpdateProject({
      defaultClipDuration: safeDur,
      clips: updatedClips,
    });

    notify(`Set all ${project.clips.length} clips to ${safeDur}s each!`, "success");
  };

  // Change voiceover speed (e.g. 0.8x, 1.0x, 1.2x, 1.5x)
  const handleUpdateSpeed = (spd: number) => {
    onUpdateProject({ audioSpeed: spd });
    if (audioRef.current) {
      audioRef.current.playbackRate = spd;
    }
    notify(`Voiceover audio speed set to ${spd}x!`, "info");
  };

  // Split Active Clip at Playhead
  const handleSplitAtPlayhead = () => {
    if (!activeTiming) return;
    const { clip, start, end } = activeTiming;
    const offsetInClip = currentTime - start;

    if (offsetInClip < 0.4 || end - currentTime < 0.4) {
      notify("Move playhead inside the clip (at least 0.4s from ends) to split.", "info");
      return;
    }

    const part1Dur = Number(offsetInClip.toFixed(1));
    const part2Dur = Number((clip.duration - offsetInClip).toFixed(1));

    const clip1: StudioClip = {
      ...clip,
      duration: Math.max(0.4, part1Dur),
    };

    const clip2: StudioClip = {
      ...clip,
      id: generateClipId(),
      duration: Math.max(0.4, part2Dur),
    };

    const targetIdx = project.clips.findIndex((c) => c.id === clip.id);
    if (targetIdx === -1) return;

    const newClips = [...project.clips];
    newClips.splice(targetIdx, 1, clip1, clip2);
    const reindexed = newClips.map((c, i) => ({ ...c, index: i + 1 }));

    onUpdateProject({ clips: reindexed });
    notify(`Split Clip #${clip.index} into two at ${formatSec(currentTime)}!`, "success");
  };

  // Delete Active Clip
  const handleDeleteActiveClip = () => {
    if (!activeTiming || project.clips.length <= 1) {
      notify("Cannot delete the only remaining clip.", "info");
      return;
    }
    const clipIndex = activeTiming.clip.index;
    const newClips = project.clips
      .filter((c) => c.id !== activeTiming.clip.id)
      .map((c, i) => ({ ...c, index: i + 1 }));

    onUpdateProject({ clips: newClips });
    notify(`Deleted Clip #${clipIndex}.`, "info");
  };

  // Duplicate Active Clip
  const handleDuplicateActiveClip = () => {
    if (!activeTiming) return;
    const targetIdx = project.clips.findIndex((c) => c.id === activeTiming.clip.id);
    if (targetIdx === -1) return;

    const clone: StudioClip = {
      ...activeTiming.clip,
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };

    const newClips = [...project.clips];
    newClips.splice(targetIdx + 1, 0, clone);
    const reindexed = newClips.map((c, i) => ({ ...c, index: i + 1 }));

    onUpdateProject({ clips: reindexed });
    notify(`Duplicated Clip #${activeTiming.clip.index}!`, "success");
  };

  // Generate More Scenes to fill audio gap (AI)
  const handleGenerateMoreScenes = async () => {
    if (!project.characterVisualLock) {
      handleAutoFillClips();
      return;
    }

    setIsGeneratingMore(true);
    notify(`Generating ${clipsNeeded} additional scenes with locked character…`, "info");

    try {
      const res = await api<{ success: boolean; clips: StudioClip[] }>("/api/studio/more-scenes", {
        method: "POST",
        body: JSON.stringify({
          story: project.story,
          characterVisualLock: project.characterVisualLock,
          environmentVisualLock: project.environmentVisualLock,
          stylePreset: project.stylePreset,
          aspectRatio: project.aspectRatio,
          clipDuration: project.defaultClipDuration || 3,
          countNeeded: clipsNeeded,
          existingCount: project.clips.length,
          voiceoverContext: project.continuousVoiceover,
        }),
      });

      if (res.clips?.length) {
        const combined = [...project.clips, ...res.clips];
        onUpdateProject({ clips: combined });
        notify(`Added ${res.clips.length} new scenes! Images now match voiceover.`, "success");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to generate more scenes", "error");
    } finally {
      setIsGeneratingMore(false);
    }
  };

  // Auto-Fill Clips by duplicating existing frames with alternative camera motion
  const handleAutoFillClips = () => {
    if (project.clips.length === 0) return;
    const clipDur = project.defaultClipDuration || 3;
    const count = clipsNeeded;
    const newClips: StudioClip[] = [];

    for (let i = 0; i < count; i++) {
      const source = project.clips[i % project.clips.length];
      newClips.push({
        ...source,
        id: `clip_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        index: project.clips.length + i + 1,
        duration: clipDur,
        motion: i % 2 === 0 ? "zoom-out" : "pan-right",
      });
    }

    onUpdateProject({ clips: [...project.clips, ...newClips] });
    notify(`Auto-filled ${count} clips to match voiceover duration!`, "success");
  };

  // Add a single new clip at the end of the timeline
  const handleAddNewEmptyClip = () => {
    const clipDur = project.defaultClipDuration || 3;
    const newClip: StudioClip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      index: project.clips.length + 1,
      duration: clipDur,
      imageUrl: null,
      imagePrompt: project.characterVisualLock
        ? `${project.stylePreset}. ${project.characterVisualLock}. In this shot: cinematic continuation.`
        : "Cinematic shot",
      narration: "",
      motion: "zoom-in",
    };

    onUpdateProject({ clips: [...project.clips, newClip] });
    notify(`Added Clip #${newClip.index} to timeline!`, "success");
  };

  // Single clip image replacement inside timeline
  const handleSingleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const clipId = targetClipForImageRef.current;
    if (!file || !clipId) return;

    const localUrl = URL.createObjectURL(file);
    onUpdateClip(clipId, { imageUrl: localUrl });

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api<{ success: boolean; files: { url: string }[] }>("/api/studio/upload", {
        method: "POST",
        body: formData,
      });
      if (res.files?.[0]?.url) {
        onUpdateClip(clipId, { imageUrl: res.files[0].url });
      }
      notify("Clip image updated and saved!", "success");
    } catch {
      notify("Clip image updated locally.", "info");
    } finally {
      if (singleImageInputRef.current) singleImageInputRef.current.value = "";
    }
  };

  // Change motion preset for a clip
  const handleCycleMotion = (clip: StudioClip) => {
    const motions: ClipMotion[] = ["zoom-in", "pan-left", "zoom-out", "pan-right", "static"];
    const curIdx = motions.indexOf(clip.motion || "zoom-in");
    const nextMotion = motions[(curIdx + 1) % motions.length];

    onUpdateClip(clip.id, { motion: nextMotion });
    notify(`Clip #${clip.index} camera motion set to ${nextMotion}!`, "info");
  };

  // Adjust duration for a clip
  const handleAdjustDuration = (clip: StudioClip, delta: number) => {
    const next = Math.max(1, Math.min(15, Number(((clip.duration || 3) + delta).toFixed(1))));
    onUpdateClip(clip.id, { duration: next });
  };

  // MP4 Video Render & Direct Export Engine
  const handleExportVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (project.clips.length === 0) {
      notify("No clips to export.", "error");
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setIsPlaying(false);
    notify("Preparing export render pipeline…", "info");

    try {
      // Setup Web Audio Mix
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();

      let voiceSource: AudioBufferSourceNode | null = null;
      if (project.audioUrl) {
        try {
          const audioFetch = await fetch(project.audioUrl);
          const arrayBuf = await audioFetch.arrayBuffer();
          const decodedAudio = await audioCtx.decodeAudioData(arrayBuf);
          const bufSource = audioCtx.createBufferSource();
          bufSource.buffer = decodedAudio;
          bufSource.playbackRate.value = currentSpeed;

          const voiceGain = audioCtx.createGain();
          voiceGain.gain.setValueAtTime(voiceVolume, 0);
          bufSource.connect(voiceGain);
          voiceGain.connect(dest);
          voiceSource = bufSource;
        } catch (e) {
          console.warn("[editor] Could not mix voice audio for export:", e);
        }
      }

      let bgmSource: AudioBufferSourceNode | null = null;
      if (project.bgmUrl) {
        try {
          const bgmFetch = await fetch(project.bgmUrl);
          const bgmArrayBuf = await bgmFetch.arrayBuffer();
          const decodedBgm = await audioCtx.decodeAudioData(bgmArrayBuf);
          const bSource = audioCtx.createBufferSource();
          bSource.buffer = decodedBgm;

          const bgmGain = audioCtx.createGain();
          bgmGain.gain.setValueAtTime(bgmVolume, 0);
          bSource.connect(bgmGain);
          bgmGain.connect(dest);
          bgmSource = bSource;
        } catch (e) {
          console.warn("[editor] Could not mix BGM for export:", e);
        }
      }

      // Capture Canvas Stream at 30 fps
      const canvasStream = canvas.captureStream(30);
      const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ];
      const combinedStream = new MediaStream(combinedTracks);

      const mimeType = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
        ? "video/mp4;codecs=avc1"
        : MediaRecorder.isTypeSupported("video/mp4")
          ? "video/mp4"
          : "video/webm;codecs=vp9";

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 6_000_000, // 6 Mbps high quality
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const finishPromise = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };
      });

      const width = project.aspectRatio === "9:16" ? 720 : 1280;
      const height = project.aspectRatio === "9:16" ? 1280 : 720;
      canvas.width = width;
      canvas.height = height;

      // Draw initial frame at time 0
      const exportCtx = canvas.getContext("2d");
      if (exportCtx) {
        drawFrame(0, exportCtx, width, height);
      }

      recorder.start();
      const exportStartAudioTime = audioCtx.currentTime;
      if (voiceSource) voiceSource.start(0);
      if (bgmSource) bgmSource.start(0);

      // Render frames continuously locked to AudioContext master clock with exact custom clip timings
      await new Promise<void>((resolve) => {
        let animId: number;
        const exportLoop = () => {
          const elapsed = audioCtx.currentTime - exportStartAudioTime;
          const simTime = Math.min(totalDuration, elapsed);

          if (exportCtx) {
            drawFrame(simTime, exportCtx, width, height);
          }

          setExportProgress(Math.min(100, Math.round((simTime / totalDuration) * 100)));

          if (elapsed < totalDuration) {
            animId = requestAnimationFrame(exportLoop);
          } else {
            cancelAnimationFrame(animId);
            resolve();
          }
        };

        animId = requestAnimationFrame(exportLoop);
      });

      recorder.stop();
      if (audioCtx.state !== "closed") {
        await audioCtx.close();
      }

      const finalBlob = await finishPromise;
      const downloadUrl = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      a.download = `${project.title || "story-video"}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      notify(`Video exported successfully! (${ext.toUpperCase()})`, "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Video export failed", "error");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
      seekTo(0);
    }
  };

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4 rounded-xl border border-brand-border bg-card p-4 shadow-sm">
      {/* Hidden inputs */}
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a"
        className="sr-only"
        onChange={handleAudioFile}
      />
      <input
        ref={bgmInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a"
        className="sr-only"
        onChange={handleCustomBgmUpload}
      />
      <input
        ref={singleImageInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleSingleImageFile}
      />

      {/* Editor Header & Primary Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Film className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">
                CapCut-Style Video Studio &amp; Exporter
              </h2>
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-2xs font-semibold text-muted-foreground">
                {project.aspectRatio === "9:16" ? "9:16 (Shorts / Reels)" : "16:9 (YouTube)"}
              </span>
            </div>
            <p className="text-2xs text-muted-foreground">
              Review visual motion, sync voiceover audio, auto-render captions &amp; export video
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Import Images button */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onImportImagesClick}
            className="h-8 gap-1.5 text-xs font-semibold"
            title="Import all images for clips"
          >
            <Upload className="size-3.5" />
            <span>Import Images</span>
          </Button>

          {/* Import Audio button */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploadingAudio}
            onClick={() => audioInputRef.current?.click()}
            className="h-8 gap-1.5 text-xs font-semibold"
            title="Upload CapCut TTS or recorded voiceover MP3/WAV"
          >
            {uploadingAudio ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Music className="size-3.5" />
            )}
            <span>{project.audioUrl ? "Replace Audio" : "Import Voiceover"}</span>
          </Button>

          {/* Auto-Sync with Audio */}
          {project.audioDuration > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAutoSyncAudio}
              className="h-8 gap-1 text-xs text-primary hover:text-foreground"
              title="Automatically distribute audio duration across clips"
            >
              <Wand2 className="size-3.5" />
              <span>Auto-Sync</span>
            </Button>
          ) : null}

          {/* Subtitles Toggle */}
          <Button
            type="button"
            size="sm"
            variant={showSubtitles ? "secondary" : "outline"}
            onClick={() => setShowSubtitles((s) => !s)}
            className="h-8 gap-1 text-xs"
            title="Toggle Bangla captions overlay"
          >
            <Subtitles className="size-3.5" />
            <span>Captions: {showSubtitles ? "ON" : "OFF"}</span>
          </Button>

          {/* Export Video Hero Button */}
          <Button
            type="button"
            size="sm"
            disabled={isExporting || project.clips.length === 0}
            onClick={handleExportVideo}
            className="h-8 gap-1.5 px-3 text-xs font-bold shadow-sm"
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            <span>{isExporting ? `Exporting ${exportProgress}%` : "Export Video (MP4)"}</span>
          </Button>
        </div>
      </div>

      {/* Main Player & Monitor Row */}
      <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
        {/* Left Monitor / Canvas Screen */}
        <div className="flex w-full flex-col items-center rounded-xl border border-border bg-surface-muted/50 p-4 lg:w-96 lg:shrink-0">
          <div
            className={cn(
              "relative overflow-hidden rounded-lg border border-border bg-card shadow-md",
              project.aspectRatio === "9:16"
                ? "aspect-9/16 w-56 max-w-full"
                : "aspect-video w-full",
            )}
          >
            <canvas ref={canvasRef} className="size-full object-contain" />
          </div>

          {/* Transport Controls below screen */}
          <div className="mt-3 flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 rounded-full"
                onClick={() => setIsPlaying((p) => !p)}
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
              </Button>

              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => seekTo(0)}
                title="Rewind to start"
              >
                <RotateCcw className="size-3.5" />
              </Button>

              {project.audioUrl ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsMuted((m) => !m)}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                </Button>
              ) : null}
            </div>

            {/* Timecode display */}
            <div className="font-mono text-xs font-semibold text-foreground">
              <span>{formatSec(currentTime)}</span>
              <span className="text-muted-foreground"> / </span>
              <span className="text-muted-foreground">{formatSec(totalDuration)}</span>
            </div>
          </div>

          {/* Color Saturation Control Pill */}
          <div className="mt-2.5 flex w-full items-center justify-between gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-2xs">
            <div className="flex items-center gap-1.5">
              <Palette className="size-3 text-primary shrink-0" />
              <span className="font-semibold text-muted-foreground uppercase text-3xs">Saturation:</span>
              <input
                type="range"
                min="0"
                max="200"
                step="5"
                value={saturation}
                onChange={(e) => onUpdateProject({ saturation: parseInt(e.target.value, 10) })}
                className="h-1.5 w-16 cursor-pointer accent-primary"
                title="Color Saturation (0% B&W to 200% Vibrant)"
              />
              <span className="font-mono text-3xs font-bold text-foreground w-8">
                {saturation}%
              </span>
            </div>

            <div className="flex items-center gap-1">
              {[
                { label: "B&W", val: 0 },
                { label: "100%", val: 100 },
                { label: "Vibrant", val: 135 },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onUpdateProject({ saturation: item.val })}
                  className={cn(
                    "rounded px-1.5 py-0.5 font-mono text-3xs transition-colors",
                    saturation === item.val
                      ? "bg-primary text-primary-foreground font-bold shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                  title={`Set saturation to ${item.val}%`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Details / Active Clip Quick Controls */}
        <div className="min-w-0 flex-1 space-y-3">
          {activeTiming ? (
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary">
                  CLIP #{String(activeTiming.clip.index).padStart(2, "0")} (
                  {activeTiming.clip.duration.toFixed(1)}s)
                </span>
                <span className="text-2xs text-muted-foreground">
                  Time: {formatSec(activeTiming.start)} - {formatSec(activeTiming.end)}
                </span>
              </div>

              {/* Clip narration */}
              <p className="font-bangla text-xs leading-5 text-foreground bg-muted/40 p-2 rounded">
                &ldquo;{activeTiming.clip.narration}&rdquo;
              </p>

              {/* Quick actions for active clip */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-2xs font-semibold text-muted-foreground uppercase">
                  Duration:
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustDuration(activeTiming.clip, -0.5)}
                    className="size-6 rounded bg-muted text-xs font-bold hover:bg-border"
                    title="Decrease duration"
                  >
                    -
                  </button>
                  <span className="font-mono text-2xs font-bold px-1.5">
                    {activeTiming.clip.duration.toFixed(1)}s
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAdjustDuration(activeTiming.clip, 0.5)}
                    className="size-6 rounded bg-muted text-xs font-bold hover:bg-border"
                    title="Increase duration"
                  >
                    +
                  </button>
                </div>

                <span className="text-2xs font-semibold text-muted-foreground uppercase ml-2">
                  Motion:
                </span>
                <button
                  type="button"
                  onClick={() => handleCycleMotion(activeTiming.clip)}
                  className="rounded bg-muted px-2 py-0.5 text-2xs font-medium capitalize hover:bg-border"
                  title="Click to cycle motion preset"
                >
                  {activeTiming.clip.motion || "zoom-in"} ↻
                </button>

                <button
                  type="button"
                  onClick={() => {
                    targetClipForImageRef.current = activeTiming.clip.id;
                    singleImageInputRef.current?.click();
                  }}
                  className="rounded bg-muted px-2 py-0.5 text-2xs font-medium hover:bg-border"
                >
                  {activeTiming.clip.imageUrl ? "Replace Image" : "Attach Image"}
                </button>

                <div className="flex items-center gap-1 border-l border-border/80 pl-2">
                  <button
                    type="button"
                    onClick={handleSplitAtPlayhead}
                    className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-2xs font-semibold text-primary hover:bg-border"
                    title="Split active clip at playhead"
                  >
                    <Scissors className="size-3" />
                    <span>Split</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDuplicateActiveClip}
                    className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground hover:bg-border hover:text-foreground"
                    title="Duplicate active clip"
                  >
                    <Copy className="size-3" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteActiveClip}
                    className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Delete active clip"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Audio Track Info Banner with Speed & Volume Control */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Music className="size-3.5 text-primary shrink-0" />
              <span className="text-2xs font-medium">
                {project.audioUrl
                  ? `Voiceover Audio: ${project.audioDuration}s` +
                    (currentSpeed !== 1.0
                      ? ` (${(project.audioDuration / currentSpeed).toFixed(1)}s @ ${currentSpeed}x)`
                      : "")
                  : "No voiceover audio attached yet. Import MP3/WAV to sync."}
              </span>

              {/* Voiceover Volume Slider (0% to 100%) */}
              {project.audioUrl ? (
                <div className="flex items-center gap-1 rounded-md border border-border/70 bg-card/60 px-2 py-0.5 ml-1">
                  <Volume2 className="size-3 text-muted-foreground" />
                  <span className="text-3xs font-bold uppercase text-muted-foreground">Vol:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={voiceVolume}
                    onChange={(e) => onUpdateProject({ voiceVolume: parseFloat(e.target.value) })}
                    className="h-1.5 w-16 cursor-pointer accent-primary"
                    title="Voiceover Volume (0% - 100%)"
                  />
                  <span className="font-mono text-3xs text-muted-foreground w-7">
                    {Math.round(voiceVolume * 100)}%
                  </span>
                </div>
              ) : null}

              {/* Audio Speed Controls */}
              <div className="flex items-center gap-1 rounded-md border border-border/70 bg-card/60 px-1.5 py-0.5">
                <span className="flex items-center gap-0.5 text-3xs font-bold uppercase tracking-wider text-muted-foreground">
                  <FastForward className="size-2.5 text-primary" />
                  Speed:
                </span>
                {[0.8, 1.0, 1.1, 1.2, 1.25, 1.5].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => handleUpdateSpeed(spd)}
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-3xs transition-colors",
                      currentSpeed === spd
                        ? "bg-primary text-primary-foreground font-bold shadow-xs"
                        : "bg-muted text-muted-foreground hover:bg-border hover:text-foreground",
                    )}
                    title={`Set voiceover speed to ${spd}x`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {project.audioUrl ? (
                <button
                  type="button"
                  onClick={() => onUpdateProject({ audioUrl: null, audioDuration: 0 })}
                  className="text-2xs text-muted-foreground hover:text-destructive"
                  title="Remove attached audio track"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="text-2xs font-semibold text-primary hover:underline"
                >
                  Import Audio
                </button>
              )}
            </div>
          </div>

          {/* Background Music (BGM) Track Banner with Synthesizer & Story Mood Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Headphones className="size-3.5 text-primary shrink-0" />
              <span className="text-2xs font-medium">
                {project.bgmUrl
                  ? `BGM: ${BGM_MOOD_PRESETS.find((p) => p.id === project.bgmMood)?.label || "Custom Music"}`
                  : "No background music attached yet."}
              </span>

              {/* BGM Volume Slider (0% to 100%) */}
              {project.bgmUrl ? (
                <div className="flex items-center gap-1.5 rounded-md border border-border/70 bg-card/60 px-2 py-0.5 ml-1">
                  <Volume2 className="size-3 text-muted-foreground" />
                  <span className="text-3xs font-bold uppercase text-muted-foreground">Vol:</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgmVolume}
                    onChange={(e) => onUpdateProject({ bgmVolume: parseFloat(e.target.value) })}
                    className="h-1.5 w-16 cursor-pointer accent-primary"
                    title="Background Music Volume (0% - 100%)"
                  />
                  <span className="font-mono text-3xs text-muted-foreground w-7">
                    {Math.round(bgmVolume * 100)}%
                  </span>
                </div>
              ) : null}

              {/* Story-Matched BGM Recommendation */}
              {project.recommendedBgmMood ? (
                <button
                  type="button"
                  disabled={generatingBgm}
                  onClick={() => handleGenerateBgm(project.recommendedBgmMood!)}
                  className={cn(
                    "rounded border px-2 py-0.5 text-2xs font-semibold transition-colors flex items-center gap-1 shadow-2xs",
                    project.bgmMood === project.recommendedBgmMood
                      ? "border-primary bg-primary text-primary-foreground font-bold shadow-xs"
                      : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20",
                  )}
                  title="Generate background music automatically matching the emotional mood of your story"
                >
                  <Sparkles className="size-3" />
                  <span>Story Match: {BGM_MOOD_PRESETS.find((p) => p.id === project.recommendedBgmMood)?.label}</span>
                </button>
              ) : null}

              {/* BGM Mood Presets */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-3xs font-bold uppercase text-muted-foreground">
                  {project.bgmUrl ? "Mood:" : "Presets:"}
                </span>
                {BGM_MOOD_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={generatingBgm}
                    onClick={() => handleGenerateBgm(preset.id)}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-3xs font-medium transition-colors flex items-center gap-1",
                      project.bgmMood === preset.id
                        ? "bg-primary text-primary-foreground font-bold shadow-xs"
                        : "bg-card border border-border/70 hover:bg-muted text-foreground",
                    )}
                    title={preset.description}
                  >
                    <span>{preset.emoji}</span>
                    <span className="hidden sm:inline">{preset.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {project.bgmUrl ? (
                <button
                  type="button"
                  onClick={() => onUpdateProject({ bgmUrl: null, bgmMood: null })}
                  className="text-2xs text-muted-foreground hover:text-destructive"
                  title="Remove background music"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => bgmInputRef.current?.click()}
                  className="text-2xs font-semibold text-primary hover:underline"
                  title="Upload MP3 or WAV music file"
                >
                  📁 Upload BGM
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CapCut-Style Multi-Track Timeline */}
      <div className="space-y-2.5 rounded-xl border border-border bg-surface-muted/40 p-3">
        {/* Audio Duration Deficit Warning & Auto-Fix Banner */}
        {durationDeficit >= 2.5 ? (
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-warning/40 bg-warning-subtle p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning">
                <AlertTriangle className="size-4" />
              </span>
              <div>
                <p className="font-bold text-foreground">
                  Voiceover is longer than your images ({effectiveAudioDuration.toFixed(0)}s audio vs {totalDuration.toFixed(0)}s images)!
                </p>
                <p className="text-2xs text-muted-foreground">
                  Images will end {durationDeficit.toFixed(0)}s early. Generate ~{clipsNeeded} more scenes or auto-fill to match the voiceover.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                disabled={isGeneratingMore}
                onClick={handleGenerateMoreScenes}
                className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
              >
                {isGeneratingMore ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                <span>Generate {clipsNeeded} More Scenes (AI)</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAutoFillClips}
                className="h-8 gap-1 text-xs"
                title="Duplicate existing frames with alternative camera motion"
              >
                <span>⚡ Auto-Fill Clips</span>
              </Button>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleAutoSyncAudio}
                className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                title="Stretch image duration to match audio length"
              >
                <span>Adjust Pacing</span>
              </Button>
            </div>
          </div>
        ) : null}

        {/* Timeline Header Toolbar: Bulk Duration, Split, Duplicate, Delete */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border/80 bg-card p-2 text-xs">
          {/* Global Duration Selector for All Clips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-muted-foreground">
              <Clock className="size-3 text-primary" />
              All Images Duration:
            </span>
            {[2.0, 2.5, 3.0, 4.0, 5.0, 6.0].map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => handleSetAllClipsDuration(sec)}
                className={cn(
                  "rounded px-2 py-1 font-mono text-xs transition-colors",
                  isAllSameDuration(sec)
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-border hover:text-foreground",
                )}
                title={`Set all image clips to ${sec}s each`}
              >
                {sec}s
              </button>
            ))}

            <div className="flex items-center gap-1 ml-1">
              <input
                type="number"
                min="0.5"
                max="30"
                step="0.5"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
                className="h-7 w-14 rounded border border-border bg-background px-1.5 font-mono text-xs text-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="5.0"
                title="Type any seconds for all clips"
              />
              <button
                type="button"
                onClick={() => handleSetAllClipsDuration(parseFloat(customDuration) || 5.0)}
                className="h-7 rounded border border-border bg-muted/80 px-2 font-mono text-2xs font-semibold text-foreground hover:bg-muted"
                title="Apply custom duration to all clips"
              >
                Apply All
              </button>
            </div>
          </div>

          {/* Quick Clip Actions & Zoom */}
          <div className="flex items-center gap-1.5">
            {/* Timeline Zoom Scale */}
            <div className="flex items-center gap-1 rounded-md border border-border/70 bg-card px-1.5 py-0.5">
              <button
                type="button"
                onClick={() => setPxPerSec((z) => Math.max(25, z - 10))}
                className="size-5 rounded hover:bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground hover:text-foreground"
                title="Zoom out timeline"
              >
                <ZoomOut className="size-3" />
              </button>
              <span className="font-mono text-3xs font-semibold px-1 text-muted-foreground">
                {pxPerSec}px/s
              </span>
              <button
                type="button"
                onClick={() => setPxPerSec((z) => Math.min(100, z + 10))}
                className="size-5 rounded hover:bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground hover:text-foreground"
                title="Zoom in timeline"
              >
                <ZoomIn className="size-3" />
              </button>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSplitAtPlayhead}
              className="h-7 gap-1 px-2.5 text-xs font-semibold"
              title="Split active clip at playhead position"
            >
              <Scissors className="size-3 text-primary" />
              <span>Split</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDuplicateActiveClip}
              className="h-7 gap-1 px-2 text-xs"
              title="Duplicate selected clip"
            >
              <Copy className="size-3" />
              <span>Duplicate</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDeleteActiveClip}
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Delete selected clip"
            >
              <Trash2 className="size-3" />
              <span>Delete</span>
            </Button>
          </div>
        </div>

        {/* Global Progress scrubber bar */}
        <div
          className="relative h-1.5 w-full cursor-pointer rounded-full bg-muted overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            seekTo(pos * totalDuration);
          }}
        >
          <div
            className="h-full bg-primary transition-all duration-75"
            style={{ width: `${(currentTime / totalDuration) * 100}%` }}
          />
        </div>

        {/* CapCut-Style Multi-Track Horizontal Scroll Area */}
        <div
          ref={timelineScrollRef}
          className="relative w-full overflow-x-auto rounded-lg border border-border/80 bg-background/80 p-2 scrollbar-thin select-none"
        >
          <div
            className="relative flex flex-col gap-2 min-w-full pb-2"
            style={{ width: `${timelineWidth}px` }}
          >
            {/* Time Ruler */}
            <div
              className="relative h-5 border-b border-border/70 select-none cursor-pointer"
              style={{ width: `${timelineWidth}px` }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                seekTo(clickX / pxPerSec);
              }}
            >
              {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, s) => {
                if (s % 5 === 0) {
                  return (
                    <div
                      key={s}
                      className="absolute top-0 flex flex-col items-start -translate-x-1/2"
                      style={{ left: `${s * pxPerSec}px` }}
                    >
                      <span className="font-mono text-3xs text-muted-foreground pl-0.5">
                        {formatSec(s)}
                      </span>
                      <div className="h-2 w-px bg-border" />
                    </div>
                  );
                }
                return (
                  <div
                    key={s}
                    className="absolute bottom-0 h-1 w-px bg-border/60 -translate-x-1/2"
                    style={{ left: `${s * pxPerSec}px` }}
                  />
                );
              })}
            </div>

            {/* Track 1: CapCut Filmstrip Image Clips Track (Width Proportional to Clip Duration!) */}
            <div className="relative h-20 flex items-center overflow-visible">
              <div className="flex items-center h-full">
                {clipTimings.map(({ clip, start }, idx) => {
                  const isActive = idx === activeClipIndex || clip.id === selectedClipId;
                  const clipDur = clip.duration || 3;
                  const clipWidth = Math.max(48, clipDur * pxPerSec);
                  const isBeingResized = resizingClip?.id === clip.id;

                  return (
                    <div
                      key={clip.id}
                      onClick={() => {
                        setSelectedClipId(clip.id);
                        seekTo(start);
                      }}
                      style={{ width: `${clipWidth}px` }}
                      className={cn(
                        "group relative h-full shrink-0 cursor-pointer overflow-hidden border-y border-r transition-shadow rounded-sm",
                        idx === 0 && "border-l",
                        isActive
                          ? "border-primary ring-2 ring-primary/40 bg-card z-10 shadow-md"
                          : "border-border/80 bg-card/90 hover:border-muted-foreground/50",
                      )}
                    >
                      {/* Filmstrip Thumbnail Background */}
                      <div className="relative size-full overflow-hidden flex items-center justify-center">
                        {clip.imageUrl ? (
                          <div className="flex size-full overflow-hidden">
                            <Image
                              src={clip.imageUrl}
                              alt=""
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-1 text-center">
                            <ImagePlus className="size-4 text-muted-foreground/60" />
                            <span className="text-3xs text-muted-foreground">No image</span>
                          </div>
                        )}

                        {/* Top-Left Duration Pill (CapCut Style: 3.6s) */}
                        <span className="absolute top-1 left-1.5 rounded bg-card/90 px-1.5 py-0.5 font-mono text-3xs font-bold text-foreground border border-border/60 shadow-xs">
                          {clipDur.toFixed(1)}s
                        </span>

                        {/* Bottom-Left Index Badge (#01) */}
                        <span className="absolute bottom-1 left-1.5 rounded bg-card/90 px-1 py-0.5 font-mono text-3xs font-semibold text-foreground border border-border/60">
                          #{clip.index}
                        </span>

                        {/* Bottom-Right Motion Badge */}
                        <span className="absolute bottom-1 right-1.5 rounded bg-primary/20 px-1.5 py-0.5 font-mono text-3xs font-medium text-primary capitalize hidden sm:inline">
                          {clip.motion || "zoom-in"}
                        </span>
                      </div>

                      {/* CapCut Drag Handles on Selected Clip */}
                      {isActive ? (
                        <>
                          {/* Left Handle */}
                          <div
                            onMouseDown={(e) => startResizing(e, clip.id, "left")}
                            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center bg-primary/30 hover:bg-primary/60 text-primary-foreground select-none z-20"
                            title="Drag to trim start of image"
                          >
                            <div className="w-1 h-7 rounded-full bg-primary" />
                          </div>

                          {/* Right Handle (Stretch / Shrink duration to match voice!) */}
                          <div
                            onMouseDown={(e) => startResizing(e, clip.id, "right")}
                            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center bg-primary/30 hover:bg-primary/60 text-primary-foreground select-none z-20"
                            title="Drag right to stretch image to voice end, or drag left to shrink"
                          >
                            <div className="w-1 h-7 rounded-full bg-primary" />
                          </div>
                        </>
                      ) : null}

                      {/* Floating duration tooltip while resizing */}
                      {isBeingResized ? (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-primary px-2 py-0.5 font-mono text-xs font-bold text-primary-foreground shadow-md z-30 pointer-events-none">
                          {clipDur.toFixed(1)}s
                        </div>
                      ) : null}
                    </div>
                  );
                })}

                {/* Add New Empty Clip Button */}
                <button
                  type="button"
                  onClick={handleAddNewEmptyClip}
                  className="flex h-full w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed border-border bg-card/40 text-muted-foreground hover:border-primary hover:text-primary transition-colors select-none ml-1"
                  title="Add a new image clip"
                >
                  <Plus className="size-4" />
                  <span className="font-mono text-3xs font-semibold">+ Add</span>
                </button>
              </div>
            </div>

            {/* Track 2: CapCut Audio Waveform Track (1:1 Vertically Aligned with Image Clips!) */}
            <div className="relative h-14 rounded-lg bg-cyan-950/20 border border-cyan-800/30 overflow-hidden select-none">
              <div
                className="relative h-full"
                style={{ width: `${timelineWidth}px` }}
              >
                {project.audioUrl ? (
                  <>
                    <canvas
                      ref={waveformCanvasRef}
                      className="size-full pointer-events-none"
                    />
                    <span className="absolute top-1 left-2 font-mono text-3xs font-semibold text-cyan-400/90 pointer-events-none flex items-center gap-1 bg-cyan-950/70 px-1.5 py-0.5 rounded">
                      <Music className="size-2.5" />
                      Voiceover Waveform ({project.audioDuration}s)
                    </span>
                  </>
                ) : (
                  <div
                    onClick={() => audioInputRef.current?.click()}
                    className="flex size-full items-center justify-center gap-2 cursor-pointer text-muted-foreground hover:text-primary transition-colors text-xs"
                  >
                    <Music className="size-4" />
                    <span>Drop or Import Voiceover Audio to see speech waveform and dialogue pauses</span>
                  </div>
                )}
              </div>
            </div>

            {/* Track 3: Background Music Track (if BGM attached) */}
            {project.bgmUrl ? (
              <div className="relative h-8 rounded-lg bg-purple-950/20 border border-purple-800/30 overflow-hidden select-none">
                <div
                  className="relative h-full flex items-center px-3"
                  style={{ width: `${timelineWidth}px` }}
                >
                  <span className="font-mono text-3xs font-semibold text-purple-400 flex items-center gap-1">
                    <Headphones className="size-2.5" />
                    BGM: {BGM_MOOD_PRESETS.find((p) => p.id === project.bgmMood)?.label || "Custom Music"}
                  </span>
                </div>
              </div>
            ) : null}

            {/* CapCut Vertical Playhead Line & Needle */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-primary z-30 pointer-events-none transition-all duration-75"
              style={{
                left: `${currentTime * pxPerSec}px`,
              }}
            >
              <div className="absolute -top-3 -translate-x-1/2 rounded bg-primary px-1.5 py-0.5 font-mono text-3xs font-bold text-primary-foreground shadow-sm">
                {formatSec(currentTime)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Audio Element for playback */}
      {project.audioUrl ? (
        <audio
          ref={audioRef}
          src={project.audioUrl}
          muted={isMuted}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
        />
      ) : null}

      {/* Hidden Background Music Element for playback */}
      {project.bgmUrl ? (
        <audio
          ref={bgmRef}
          src={project.bgmUrl}
          loop
          muted={isMuted}
        />
      ) : null}
    </div>
  );
}
