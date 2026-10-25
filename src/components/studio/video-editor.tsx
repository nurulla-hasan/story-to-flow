"use client";

import * as React from "react";
import {
  type BgmMood,
  type ClipMotion,
  type ClipSfxConfig,
  type ClipTransition,
  type SfxType,
  type StudioClip,
  type StudioProject,
  type TransitionType,
} from "./types";
import { api } from "@/lib/apiClient";
import { BGM_MOOD_PRESETS, generateCinematicBgm } from "@/lib/bgm";
import {
  loadAudioBuffer,
  loadPresetSfxBuffer,
  playUniversalSfx,
} from "@/lib/sfx";
import { AudioMixer } from "./editor/audio-mixer";
import { ClipInspector } from "./editor/clip-inspector";
import { CommandBar } from "./editor/command-bar";
import { EditorModals } from "./editor/editor-modals";
import {
  EditorToolPanel,
  EditorToolPanelContent,
  EditorToolRail,
  InspectorRail,
  MobileEditorToolbar,
  MobileToolSheet,
  ProjectInspectorPanel,
  type EditorTool,
  type InspectorTab,
  type MobileEditorTab,
} from "./editor/editor-sidebar";
import {
  computeVoiceSegmentTimings,
  formatSec,
  generateClipId,
  getClipMedia,
  getClipSfxConfig,
  getProjectVoiceSegments,
} from "./editor/editor-shared";
import { PreviewStage } from "./editor/preview-stage";
import { TimelineDock } from "./editor/timeline-dock";
import { TransportBar } from "./editor/transport-bar";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface VideoEditorProps {
  project: StudioProject;
  onUpdateProject: (patch: Partial<StudioProject>) => void;
  onUpdateClip: (clipId: string, patch: Partial<StudioClip>) => void;
  notify: (message: string, kind?: "info" | "error" | "success") => void;
  onImportImagesClick: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onResetProject?: () => void;
}

export function VideoEditor({
  project,
  onUpdateProject,
  onUpdateClip,
  notify,
  onImportImagesClick,
  saveStatus,
  onResetProject,
}: VideoEditorProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const currentTimeRef = React.useRef(0);

  React.useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);
  const [isMuted, setIsMuted] = React.useState(false);
  const [showSubtitles, setShowSubtitles] = React.useState(true);
  const [selectedClipId, setSelectedClipId] = React.useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = React.useState<"video" | "voice">("video");
  const [selectedVoiceSegmentId, setSelectedVoiceSegmentId] = React.useState<string | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = React.useState(false);

  // Undo & Redo History Stack (up to 50 states)
  const [history, setHistory] = React.useState<StudioProject[]>([]);
  const [future, setFuture] = React.useState<StudioProject[]>([]);
  const canUndo = history.length > 0;
  const canRedo = future.length > 0;

  const commitProjectUpdate = React.useCallback(
    (patch: Partial<StudioProject>) => {
      setHistory((prev) => [...prev.slice(-49), project]);
      setFuture([]);
      onUpdateProject(patch);
    },
    [project, onUpdateProject],
  );

  const commitClipUpdate = React.useCallback(
    (clipId: string, patch: Partial<StudioClip>) => {
      setHistory((prev) => [...prev.slice(-49), project]);
      setFuture([]);
      onUpdateClip(clipId, patch);
    },
    [project, onUpdateClip],
  );

  const handleUndo = React.useCallback(() => {
    if (history.length === 0) return;
    const prevProject = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setFuture((prev) => [project, ...prev]);
    onUpdateProject(prevProject);
    notify("Undo", "info");
  }, [history, project, onUpdateProject, notify]);

  const handleRedo = React.useCallback(() => {
    if (future.length === 0) return;
    const nextProject = future[0];
    setFuture((prev) => prev.slice(1));
    setHistory((prev) => [...prev.slice(-49), project]);
    onUpdateProject(nextProject);
    notify("Redo", "info");
  }, [future, project, onUpdateProject, notify]);

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [activeTool, setActiveTool] = React.useState<EditorTool | null>("media");
  const [inspectorTab, setInspectorTab] = React.useState<InspectorTab>("clip");
  const [mobileTool, setMobileTool] = React.useState<MobileEditorTab | null>(null);

  // Timeline scale & waveform
  const [pxPerSec, setPxPerSec] = React.useState(50);
  const [audioPeaks, setAudioPeaks] = React.useState<number[] | null>(null);
  const [resizingClip, setResizingClip] = React.useState<{ id: string; duration: number } | null>(null);
  const resizingRef = React.useRef<{ clipId: string; edge: "left" | "right"; startX: number; initialDur: number } | null>(null);
  const [activeTransitionModal, setActiveTransitionModal] = React.useState<{
    clipIndex: number | null;
    type: TransitionType;
    duration: number;
  } | null>(null);

  // SFX Transform Modal & Upload state
  const [activeSfxModal, setActiveSfxModal] = React.useState<{
    clipId: string;
    config: ClipSfxConfig;
  } | null>(null);
  const customSfxInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadingSfx, setUploadingSfx] = React.useState(false);

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
  const stageRef = React.useRef<HTMLDivElement>(null);
  const lastPlayedSfxClipRef = React.useRef<string | null>(null);
  const sfxAudioCtxRef = React.useRef<AudioContext | null>(null);

  // Preloaded image & video elements cache for smooth real-time rendering
  const imageCacheRef = React.useRef<Map<string, HTMLImageElement>>(new Map());
  const videoCacheRef = React.useRef<Map<string, HTMLVideoElement>>(new Map());
  const [imageVersion, setImageVersion] = React.useState(0);

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

  // The inspector edits the explicitly selected clip, falling back to whatever is under the playhead.
  const selectedTiming = React.useMemo(
    () => clipTimings.find((t) => t.clip.id === selectedClipId) ?? null,
    [clipTimings, selectedClipId],
  );
  const editingTiming = selectedTiming ?? activeTiming;
  const editingClip = editingTiming?.clip ?? null;
  const isEditingSelected = Boolean(selectedTiming);

  // Voice segments & timings (splittable multi-segment voice track)
  const voiceSegments = React.useMemo(
    () =>
      getProjectVoiceSegments({
        voiceSegments: project.voiceSegments,
        audioUrl: project.audioUrl,
        audioDuration: project.audioDuration,
      }),
    [project.voiceSegments, project.audioUrl, project.audioDuration],
  );

  const voiceTimings = React.useMemo(
    () => computeVoiceSegmentTimings(voiceSegments),
    [voiceSegments],
  );

  // Split Video Clip at Playhead
  const handleSplitVideoAtPlayhead = React.useCallback(() => {
    const targetTiming =
      selectedTiming &&
      currentTime >= selectedTiming.start &&
      currentTime <= selectedTiming.end
        ? selectedTiming
        : activeTiming &&
            currentTime >= activeTiming.start &&
            currentTime <= activeTiming.end
          ? activeTiming
          : selectedTiming ?? activeTiming;

    if (!targetTiming) {
      notify("Select a video clip or position the playhead over a clip to split.", "info");
      return;
    }

    const { clip, start, end } = targetTiming;

    if (currentTime < start || currentTime > end) {
      notify(
        `Move playhead inside Clip #${clip.index} (${formatSec(start)}–${formatSec(end)}) to split.`,
        "info",
      );
      return;
    }

    const offsetInClip = currentTime - start;
    const remainingInClip = end - currentTime;

    if (offsetInClip < 0.3 || remainingInClip < 0.3) {
      notify("Position the playhead at least 0.3s inside the clip to split.", "info");
      return;
    }

    const part1Dur = Number(Math.max(0.3, offsetInClip).toFixed(1));
    const part2Dur = Number(Math.max(0.3, clip.duration - part1Dur).toFixed(1));
    const speed = clip.speed ?? 1.0;

    const clip1: StudioClip = {
      ...clip,
      duration: part1Dur,
      baseDuration: Number((part1Dur * speed).toFixed(1)),
    };

    const clip2: StudioClip = {
      ...clip,
      id: generateClipId(),
      duration: part2Dur,
      baseDuration: Number((part2Dur * speed).toFixed(1)),
    };

    const targetIdx = project.clips.findIndex((c) => c.id === clip.id);
    if (targetIdx === -1) return;

    const newClips = [...project.clips];
    newClips.splice(targetIdx, 1, clip1, clip2);
    const reindexed = newClips.map((c, i) => ({ ...c, index: i + 1 }));

    setSelectedClipId(clip2.id);
    setSelectedTrack("video");
    setSelectedVoiceSegmentId(null);
    commitProjectUpdate({ clips: reindexed });
    notify(`Split Clip #${clip.index} into two at ${formatSec(currentTime)}!`, "success");
  }, [selectedTiming, activeTiming, currentTime, project.clips, commitProjectUpdate, notify]);

  // Split Voice Segment at Playhead (non-destructive startOffset math)
  const handleSplitVoiceAtPlayhead = React.useCallback(() => {
    if (voiceTimings.length === 0) {
      notify("No voiceover on the timeline to split.", "info");
      return;
    }

    const targetTiming =
      (selectedVoiceSegmentId
        ? voiceTimings.find((t) => t.segment.id === selectedVoiceSegmentId)
        : null) ||
      voiceTimings.find((t) => currentTime >= t.start && currentTime <= t.end) ||
      voiceTimings[0];

    if (!targetTiming) return;

    const { segment, start, end } = targetTiming;
    if (currentTime < start || currentTime > end) {
      notify(
        `Move playhead inside voice segment (${formatSec(start)}–${formatSec(end)}) to split.`,
        "info",
      );
      return;
    }

    const offsetInSeg = currentTime - start;
    const remainingInSeg = end - currentTime;

    if (offsetInSeg < 0.2 || remainingInSeg < 0.2) {
      notify("Position playhead at least 0.2s inside the voice segment to split.", "info");
      return;
    }

    const part1Dur = Number(offsetInSeg.toFixed(2));
    const part2Dur = Number((segment.duration - offsetInSeg).toFixed(2));

    const seg1 = {
      ...segment,
      duration: part1Dur,
    };

    const seg2 = {
      ...segment,
      id: `vseg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      startOffset: Number((segment.startOffset + offsetInSeg).toFixed(2)),
      duration: part2Dur,
    };

    const targetIdx = voiceSegments.findIndex((s) => s.id === segment.id);
    if (targetIdx === -1) return;

    const newSegments = [...voiceSegments];
    newSegments.splice(targetIdx, 1, seg1, seg2);

    commitProjectUpdate({ voiceSegments: newSegments });
    setSelectedVoiceSegmentId(seg2.id);
    setSelectedTrack("voice");
    setSelectedClipId(null);
    notify(`Split voiceover at ${formatSec(currentTime)}!`, "success");
  }, [voiceTimings, voiceSegments, selectedVoiceSegmentId, currentTime, commitProjectUpdate, notify]);

  // Track-aware split: splits currently selected track
  const handleSplitSelected = React.useCallback(() => {
    if (selectedTrack === "voice" || (selectedVoiceSegmentId && !selectedClipId)) {
      handleSplitVoiceAtPlayhead();
    } else {
      handleSplitVideoAtPlayhead();
    }
  }, [selectedTrack, selectedVoiceSegmentId, selectedClipId, handleSplitVoiceAtPlayhead, handleSplitVideoAtPlayhead]);

  // Split All: cuts through BOTH video and voice tracks intersecting playhead simultaneously
  const handleSplitAllAtPlayhead = React.useCallback(() => {
    let splitAny = false;

    // 1. Split intersecting video clip
    let nextClips = project.clips;
    const videoTarget = clipTimings.find(
      (t) => currentTime > t.start && currentTime < t.end,
    );
    if (videoTarget) {
      const offsetInClip = currentTime - videoTarget.start;
      const remainingInClip = videoTarget.end - currentTime;
      if (offsetInClip >= 0.2 && remainingInClip >= 0.2) {
        const part1Dur = Number(Math.max(0.3, offsetInClip).toFixed(1));
        const part2Dur = Number(Math.max(0.3, videoTarget.clip.duration - part1Dur).toFixed(1));
        const speed = videoTarget.clip.speed ?? 1.0;
        const clip1: StudioClip = {
          ...videoTarget.clip,
          duration: part1Dur,
          baseDuration: Number((part1Dur * speed).toFixed(1)),
        };
        const clip2: StudioClip = {
          ...videoTarget.clip,
          id: generateClipId(),
          duration: part2Dur,
          baseDuration: Number((part2Dur * speed).toFixed(1)),
        };
        const targetIdx = project.clips.findIndex((c) => c.id === videoTarget.clip.id);
        if (targetIdx !== -1) {
          const updated = [...project.clips];
          updated.splice(targetIdx, 1, clip1, clip2);
          nextClips = updated.map((c, i) => ({ ...c, index: i + 1 }));
          splitAny = true;
        }
      }
    }

    // 2. Split intersecting voice segment
    let nextVoice = voiceSegments;
    const voiceTarget = voiceTimings.find(
      (t) => currentTime > t.start && currentTime < t.end,
    );
    if (voiceTarget) {
      const offsetInSeg = currentTime - voiceTarget.start;
      const remainingInSeg = voiceTarget.end - currentTime;
      if (offsetInSeg >= 0.2 && remainingInSeg >= 0.2) {
        const part1Dur = Number(offsetInSeg.toFixed(2));
        const part2Dur = Number((voiceTarget.segment.duration - offsetInSeg).toFixed(2));
        const seg1 = {
          ...voiceTarget.segment,
          duration: part1Dur,
        };
        const seg2 = {
          ...voiceTarget.segment,
          id: `vseg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          startOffset: Number((voiceTarget.segment.startOffset + offsetInSeg).toFixed(2)),
          duration: part2Dur,
        };
        const targetIdx = voiceSegments.findIndex((s) => s.id === voiceTarget.segment.id);
        if (targetIdx !== -1) {
          const updated = [...voiceSegments];
          updated.splice(targetIdx, 1, seg1, seg2);
          nextVoice = updated;
          splitAny = true;
        }
      }
    }

    if (splitAny) {
      commitProjectUpdate({
        clips: nextClips,
        voiceSegments: nextVoice,
      });
      notify(`Split all tracks at ${formatSec(currentTime)}!`, "success");
    } else {
      notify("Move playhead inside a video clip or voice segment to split.", "info");
    }
  }, [clipTimings, voiceTimings, voiceSegments, project.clips, currentTime, commitProjectUpdate, notify]);

  // Preload attached media (images and videos) for smooth real-time rendering
  React.useEffect(() => {
    project.clips.forEach((clip) => {
      const media = getClipMedia(clip);
      if (!media.url) return;

      if (media.type === "video") {
        if (!videoCacheRef.current.has(media.url)) {
          const vid = document.createElement("video");
          vid.src = media.url;
          vid.crossOrigin = "anonymous";
          vid.playsInline = true;
          vid.muted = true;
          vid.preload = "auto";
          vid.onloadeddata = () => setImageVersion((v) => v + 1);
          videoCacheRef.current.set(media.url, vid);
        }
      } else {
        if (!imageCacheRef.current.has(media.url)) {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          img.onload = () => setImageVersion((version) => version + 1);
          img.src = media.url;
          imageCacheRef.current.set(media.url, img);
        }
      }
    });
  }, [project.clips]);

  const voiceVolume = project.voiceVolume ?? 1.0;
  const bgmVolume = project.bgmVolume ?? 0.20;
  const saturation = project.saturation ?? 100;

  const playbackStateRef = React.useRef({
    currentTime,
    currentSpeed,
    isMuted,
    voiceVolume,
    bgmVolume,
    totalDuration,
    voiceTimings,
    activeTiming,
  });

  React.useEffect(() => {
    playbackStateRef.current = {
      currentTime,
      currentSpeed,
      isMuted,
      voiceVolume,
      bgmVolume,
      totalDuration,
      voiceTimings,
      activeTiming,
    };
  });

  // Handle Voiceover, BGM & Video media play/pause
  React.useEffect(() => {
    const audio = audioRef.current;
    const bgm = bgmRef.current;
    const {
      currentTime: time,
      currentSpeed: spd,
      isMuted: muted,
      voiceVolume: vVol,
      bgmVolume: bVol,
      totalDuration: totalDur,
      voiceTimings: vTimings,
      activeTiming: actTiming,
    } = playbackStateRef.current;

    if (isPlaying) {
      if (audio) {
        const activeVoice = vTimings.find(
          (t) => time >= t.start && time < t.end,
        );
        if (activeVoice) {
          audio.currentTime =
            activeVoice.segment.startOffset + (time - activeVoice.start);
          audio.playbackRate = spd;
          audio.volume = muted ? 0 : vVol;
          audio.play().catch(() => {});
        }
      }
      if (bgm) {
        bgm.currentTime = time % (bgm.duration || totalDur);
        bgm.volume = muted ? 0 : bVol;
        bgm.play().catch(() => {});
      }
      if (actTiming) {
        const media = getClipMedia(actTiming.clip);
        if (media.type === "video" && media.url) {
          const vid = videoCacheRef.current.get(media.url);
          if (vid && vid.readyState >= 1) {
            const clipSpeed = actTiming.clip.speed || 1;
            vid.currentTime = Math.max(0, (time - actTiming.start) * clipSpeed);
            vid.volume = muted ? 0 : (actTiming.clip.videoVolume ?? 0);
            vid.playbackRate = spd * clipSpeed;
            vid.play().catch(() => {});
          }
        }
      }
    } else {
      if (audio) audio.pause();
      if (bgm) bgm.pause();
      videoCacheRef.current.forEach((vid) => {
        if (!vid.paused) vid.pause();
      });
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

  const enableDucking = project.enableAudioDucking ?? true;

  // Trigger sound effects when playhead reaches clip offset
  React.useEffect(() => {
    if (!isPlaying) {
      lastPlayedSfxClipRef.current = null;
      return;
    }

    if (activeTiming) {
      const cfg = getClipSfxConfig(activeTiming.clip);
      if (cfg && cfg.type !== "none") {
        const triggerTime = activeTiming.start + (cfg.offset || 0);
        const diff = currentTime - triggerTime;

        if (diff >= 0 && diff <= 0.25) {
          if (lastPlayedSfxClipRef.current !== activeTiming.clip.id) {
            lastPlayedSfxClipRef.current = activeTiming.clip.id;
            try {
              if (!sfxAudioCtxRef.current || sfxAudioCtxRef.current.state === "closed") {
                const AudioCtx =
                  window.AudioContext ||
                  (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                sfxAudioCtxRef.current = new AudioCtx();
              }
              if (sfxAudioCtxRef.current.state === "suspended") {
                sfxAudioCtxRef.current.resume();
              }
              void playUniversalSfx(sfxAudioCtxRef.current, cfg);
            } catch (e) {
              console.warn("[sfx] Live playback failed:", e);
            }
          }
        }
      }
    }
  }, [isPlaying, currentTime, activeTiming]);

  // Smart Audio Ducking: lowers BGM volume to 15% during voiceover playback, and smooth ramp up to 35% on pause/finish
  React.useEffect(() => {
    if (!bgmRef.current || isMuted) return;

    if (enableDucking && project.audioUrl) {
      const isVoiceSpeaking =
        audioRef.current &&
        !audioRef.current.paused &&
        !audioRef.current.ended &&
        isPlaying &&
        currentTime < (project.audioDuration / currentSpeed);

      const targetBgmVol = isVoiceSpeaking
        ? Math.min(bgmVolume, 0.15)
        : Math.min(1.0, Math.max(bgmVolume, 0.35));

      bgmRef.current.volume = targetBgmVol;
    } else {
      bgmRef.current.volume = bgmVolume;
    }
  }, [currentTime, isPlaying, bgmVolume, isMuted, enableDucking, project.audioUrl, project.audioDuration, currentSpeed]);

  // Update BGM volume/mute dynamically without restarting audio
  React.useEffect(() => {
    if (bgmRef.current && !enableDucking) {
      bgmRef.current.volume = isMuted ? 0 : bgmVolume;
    }
  }, [bgmVolume, isMuted, enableDucking]);

  // Sync audio and video time when user manually seeks
  const seekTo = React.useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(time, totalDuration));
      currentTimeRef.current = clamped;
      setCurrentTime(clamped);

      // 1. Sync voiceover segment audio
      const audio = audioRef.current;
      if (audio) {
        const activeVoice = voiceTimings.find(
          (t) => clamped >= t.start && clamped < t.end,
        );
        if (activeVoice) {
          const targetAudioTime =
            activeVoice.segment.startOffset + (clamped - activeVoice.start);
          audio.currentTime = targetAudioTime;
          audio.playbackRate = currentSpeed;
          audio.volume = isMuted ? 0 : voiceVolume;
          if (isPlaying && audio.paused) {
            audio.play().catch(() => {});
          }
        } else if (!audio.paused) {
          audio.pause();
        }
      }

      // 2. Sync video media element
      const activeClipTiming = clipTimings.find(
        (t) => clamped >= t.start && clamped < t.end,
      );
      if (activeClipTiming) {
        const media = getClipMedia(activeClipTiming.clip);
        if (media.type === "video" && media.url) {
          const vid = videoCacheRef.current.get(media.url);
          if (vid && vid.readyState >= 1) {
            const clipSpeed = activeClipTiming.clip.speed || 1;
            const targetVidTime = Math.max(
              0,
              (clamped - activeClipTiming.start) * clipSpeed,
            );
            vid.currentTime = Math.min(vid.duration || targetVidTime, targetVidTime);
            vid.volume = isMuted ? 0 : (activeClipTiming.clip.videoVolume ?? 0);
            vid.playbackRate = currentSpeed * clipSpeed;
            if (isPlaying && vid.paused) {
              vid.play().catch(() => {});
            }
          }
        }
      }

      if (bgmRef.current) {
        bgmRef.current.currentTime =
          clamped % (bgmRef.current.duration || totalDuration);
      }
    },
    [
      totalDuration,
      currentSpeed,
      voiceTimings,
      clipTimings,
      isPlaying,
      isMuted,
      voiceVolume,
    ],
  );

  const handleResetProject = React.useCallback(() => {
    setResetDialogOpen(true);
  }, []);

  const handleConfirmReset = React.useCallback(() => {
    setIsPlaying(false);
    seekTo(0);
    setSelectedClipId(null);
    setSelectedVoiceSegmentId(null);
    setSelectedTrack("video");

    if (onResetProject) {
      onResetProject();
    } else {
      commitProjectUpdate({
        clips: [],
        audioUrl: null,
        audioDuration: 0,
        voiceSegments: [],
        bgmUrl: null,
      });
    }

    notify("Project has been completely reset.", "success");
  }, [seekTo, onResetProject, commitProjectUpdate, notify]);

  // Native fullscreen preview (CapCut-style "expand monitor")
  React.useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = React.useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.();
      return;
    }
    const el = stageRef.current;
    if (el?.requestFullscreen) {
      void el.requestFullscreen().catch(() => {
        notify("Fullscreen preview is not available in this browser.", "info");
      });
    }
  }, [notify]);

  // Editing shortcuts: Space play/pause, S split selected, Ctrl+Shift+S split all, Ctrl+Z undo, Ctrl+Y redo
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        setIsPlaying((playing) => !playing);
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        (event.key === "s" || event.key === "S")
      ) {
        // Ctrl+Shift+S / Cmd+Shift+S: Split All tracks at playhead
        event.preventDefault();
        handleSplitAllAtPlayhead();
      } else if (
        (event.key === "s" || event.key === "S") &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        // S: Split Selected track at playhead
        event.preventDefault();
        handleSplitSelected();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "z" || event.key === "Z") &&
        !event.shiftKey
      ) {
        // Ctrl+Z: Undo
        event.preventDefault();
        handleUndo();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "y" ||
          event.key === "Y" ||
          (event.shiftKey && (event.key === "z" || event.key === "Z")))
      ) {
        // Ctrl+Y / Ctrl+Shift+Z: Redo
        event.preventDefault();
        handleRedo();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekTo(currentTime - (event.shiftKey ? 5 : 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        seekTo(currentTime + (event.shiftKey ? 5 : 1));
      } else if (event.key.toLowerCase() === "m") {
        setIsMuted((muted) => !muted);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    currentTime,
    seekTo,
    handleSplitSelected,
    handleSplitAllAtPlayhead,
    handleUndo,
    handleRedo,
  ]);

  // Keep the playhead visible inside the timeline while playing
  React.useEffect(() => {
    if (!isPlaying) return;
    const scroller = timelineScrollRef.current;
    if (!scroller) return;

    const playheadX = currentTime * pxPerSec;
    const padding = 72;
    if (playheadX < scroller.scrollLeft + padding) {
      scroller.scrollLeft = Math.max(0, playheadX - padding);
    } else if (playheadX > scroller.scrollLeft + scroller.clientWidth - padding) {
      scroller.scrollLeft = playheadX - scroller.clientWidth + padding;
    }
  }, [currentTime, isPlaying, pxPerSec]);

  // Playback animation loop: syncs canvas, audio and video media smoothly forward
  React.useEffect(() => {
    let lastStamp = performance.now();

    const loop = (stamp: number) => {
      if (isPlaying) {
        const delta = Math.max(0, Math.min(0.1, (stamp - lastStamp) / 1000));
        let nextTime = currentTimeRef.current + delta * currentSpeed;

        // When voiceover audio is active, sync timeline time with audio hardware clock
        const audio = audioRef.current;
        if (
          audio &&
          !audio.paused &&
          !audio.ended &&
          Number.isFinite(audio.currentTime)
        ) {
          const activeVoice = voiceTimings.find(
            (t) =>
              currentTimeRef.current >= t.start &&
              currentTimeRef.current < t.end,
          );
          if (activeVoice) {
            const calculatedTime =
              activeVoice.start +
              (audio.currentTime - activeVoice.segment.startOffset);
            if (
              calculatedTime >= activeVoice.start &&
              calculatedTime <= activeVoice.end + 0.2
            ) {
              nextTime = calculatedTime;
            }
          }
        }

        if (nextTime >= totalDuration) {
          setIsPlaying(false);
          seekTo(0);
          return;
        }

        currentTimeRef.current = nextTime;
        setCurrentTime(nextTime);

        // Sync voice segment audio when crossing boundary or starting
        if (audio && isPlaying) {
          const activeVoice = voiceTimings.find(
            (t) => nextTime >= t.start && nextTime < t.end,
          );
          if (activeVoice) {
            const targetAudioTime =
              activeVoice.segment.startOffset + (nextTime - activeVoice.start);
            if (audio.paused) {
              audio.currentTime = targetAudioTime;
              audio.playbackRate = currentSpeed;
              audio.volume = isMuted ? 0 : voiceVolume;
              audio.play().catch(() => {});
            } else if (Math.abs(audio.currentTime - targetAudioTime) > 0.8) {
              audio.currentTime = targetAudioTime;
            }
          } else if (!audio.paused) {
            audio.pause();
          }
        }

        // Sync active video clip
        if (activeTiming && isPlaying) {
          const media = getClipMedia(activeTiming.clip);
          if (media.type === "video" && media.url) {
            const vid = videoCacheRef.current.get(media.url);
            if (vid && vid.readyState >= 1) {
              const clipSpeed = activeTiming.clip.speed || 1;
              const targetVidTime = Math.max(
                0,
                (nextTime - activeTiming.start) * clipSpeed,
              );
              const clampedVidTime = Math.min(
                vid.duration || targetVidTime,
                targetVidTime,
              );
              vid.volume = isMuted ? 0 : (activeTiming.clip.videoVolume ?? 0);
              vid.playbackRate = currentSpeed * clipSpeed;
              if (vid.paused) {
                vid.currentTime = clampedVidTime;
                vid.play().catch(() => {});
              } else if (Math.abs(vid.currentTime - clampedVidTime) > 0.8) {
                vid.currentTime = clampedVidTime;
              }
            }
          }
        }
      }
      lastStamp = stamp;
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [
    isPlaying,
    totalDuration,
    currentSpeed,
    seekTo,
    voiceTimings,
    activeTiming,
    isMuted,
    voiceVolume,
  ]);

  const timelineWidth = React.useMemo(() => {
    return Math.max(640, Math.ceil(totalDuration * pxPerSec) + 32);
  }, [totalDuration, pxPerSec]);

  const voiceoverWidth = React.useMemo(() => {
    if (!project.audioDuration) return 0;
    return Math.max(40, (project.audioDuration / currentSpeed) * pxPerSec);
  }, [project.audioDuration, currentSpeed, pxPerSec]);

  // Decode Voiceover Audio Waveform Peaks
  React.useEffect(() => {
    if (!project.audioUrl) {
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

    const width = Math.max(1, Math.ceil(voiceoverWidth));
    const height = 52;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    if (!audioPeaks || audioPeaks.length === 0 || !project.audioDuration) {
      return;
    }

    const barWidth = 2;
    const gap = 1;
    const totalBars = Math.max(1, Math.floor(width / (barWidth + gap)));

    // Track-voice token keeps the waveform readable in both themes.
    const styles = getComputedStyle(canvas);
    ctx.fillStyle =
      styles.getPropertyValue("--track-voice").trim() || "currentColor";

    for (let i = 0; i < totalBars; i++) {
      const peakIdx = Math.floor((i / totalBars) * audioPeaks.length);
      const amp = audioPeaks[peakIdx] || 0;
      const barH = Math.max(2, Math.min(height - 8, amp * (height - 10)));
      const x = i * (barWidth + gap);
      const y = (height - barH) / 2;
      ctx.fillRect(x, y, barWidth, barH);
    }
  }, [audioPeaks, voiceoverWidth, project.audioDuration]);

  // CapCut-style drag handles to stretch / shrink images with smooth 0.1s snapping & 0.5s minimum
  const startResizing = React.useCallback(
    (
      e: React.MouseEvent | React.PointerEvent,
      clipId: string,
      edge: "left" | "right",
    ) => {
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

      const handlePointerMove = (moveEvent: PointerEvent | MouseEvent) => {
        if (!resizingRef.current) return;
        const { clipId: id, startX, initialDur, edge: currentEdge } = resizingRef.current;
        const deltaX = moveEvent.clientX - startX;
        const deltaSec = deltaX / pxPerSec;
        const delta = currentEdge === "right" ? deltaSec : -deltaSec;
        const newDur = Math.max(0.5, Math.min(30, Number((initialDur + delta).toFixed(1))));
        const currentClip = project.clips.find((c) => c.id === id);
        const speed = currentClip?.speed ?? 1.0;

        setResizingClip({ id, duration: newDur });
        onUpdateClip(id, {
          duration: newDur,
          baseDuration: Number((newDur * speed).toFixed(1)),
        });
      };

      const handlePointerUp = () => {
        resizingRef.current = null;
        setResizingClip(null);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("mousemove", handlePointerMove);
        window.removeEventListener("mouseup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("mousemove", handlePointerMove);
      window.addEventListener("mouseup", handlePointerUp);
    },
    [project.clips, pxPerSec, onUpdateClip],
  );

  const getMediaElement = React.useCallback(
    (clip: StudioClip): HTMLImageElement | HTMLVideoElement | null => {
      const media = getClipMedia(clip);
      if (!media.url) return null;
      if (media.type === "video") {
        return videoCacheRef.current.get(media.url) || null;
      }
      return imageCacheRef.current.get(media.url) || null;
    },
    [],
  );

  // Draw an individual media (image or video frame) with Ken Burns motion onto canvas
  const drawSingleMedia = React.useCallback(
    (
      media: HTMLImageElement | HTMLVideoElement | null,
      motion: ClipMotion,
      progress: number,
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
      flipped = false,
    ) => {
      const isImg = media instanceof HTMLImageElement;
      const isVid = media instanceof HTMLVideoElement;
      const isReady =
        (isImg && media.complete && media.naturalWidth > 0) ||
        (isVid && media.readyState >= 1 && media.videoWidth > 0);

      if (isReady && media) {
        ctx.save();

        if (saturation !== 100) {
          ctx.filter = `saturate(${saturation}%)`;
        }

        let scale = 1.0;
        let offsetX = 0;
        const offsetY = 0;

        if (motion === "zoom-in") {
          scale = 1.0 + progress * 0.12;
        } else if (motion === "zoom-out") {
          scale = 1.12 - progress * 0.12;
        } else if (motion === "pan-left") {
          scale = 1.08;
          offsetX = (0.5 - progress) * 36;
        } else if (motion === "pan-right") {
          scale = 1.08;
          offsetX = (progress - 0.5) * 36;
        }

        ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
        ctx.scale(scale * (flipped ? -1 : 1), scale);

        const naturalW = isImg ? media.naturalWidth : media.videoWidth;
        const naturalH = isImg ? media.naturalHeight : media.videoHeight;
        const mediaRatio = naturalW / naturalH;
        const canvasRatio = width / height;
        let renderW = width;
        let renderH = height;

        if (mediaRatio > canvasRatio) {
          renderH = height;
          renderW = height * mediaRatio;
        } else {
          renderW = width;
          renderH = width / mediaRatio;
        }

        ctx.drawImage(media, -renderW / 2, -renderH / 2, renderW, renderH);
        ctx.restore();
      } else {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, 0, width, height);
      }
    },
    [saturation],
  );

  // Draw a single frame at the given timestamp with CapCut transition blending & frame-accurate clip durations
  const drawFrame = React.useCallback(
    (time: number, ctx: CanvasRenderingContext2D, width: number, height: number) => {
      // 1. Fill background
      ctx.fillStyle = "#0c131a";
      ctx.fillRect(0, 0, width, height);

      // 2. Check for active transition between clip i and clip i+1
      let inTransition = false;
      let activeNarration = "";

      for (let i = 0; i < clipTimings.length - 1; i++) {
        const timingA = clipTimings[i];
        const timingB = clipTimings[i + 1];
        const transition = timingA.clip.transition;

        if (transition && transition.type && transition.type !== "none") {
          const transDur = Math.max(0.1, Math.min(1.5, transition.duration || 0.4));
          const splitTime = timingA.end;
          const transStart = splitTime - transDur / 2;
          const transEnd = splitTime + transDur / 2;

          if (time >= transStart && time < transEnd) {
            inTransition = true;
            const transProgress = Math.max(0, Math.min(1, (time - transStart) / transDur));
            activeNarration = transProgress < 0.5 ? timingA.clip.narration : timingB.clip.narration;

            const mediaA = getMediaElement(timingA.clip);
            const mediaB = getMediaElement(timingB.clip);
            const motionA: ClipMotion = timingA.clip.motion || "zoom-in";
            const motionB: ClipMotion = timingB.clip.motion || "zoom-in";

            if (transition.type === "dissolve") {
              ctx.save();
              ctx.globalAlpha = 1 - transProgress;
              drawSingleMedia(mediaA, motionA, 1.0, ctx, width, height, Boolean(timingA.clip.flipped));
              ctx.restore();

              ctx.save();
              ctx.globalAlpha = transProgress;
              drawSingleMedia(mediaB, motionB, 0.0, ctx, width, height, Boolean(timingB.clip.flipped));
              ctx.restore();
            } else if (transition.type === "white-flash") {
              if (transProgress < 0.5) {
                drawSingleMedia(mediaA, motionA, 1.0, ctx, width, height, Boolean(timingA.clip.flipped));
                ctx.fillStyle = `rgba(255, 255, 255, ${transProgress * 2})`;
                ctx.fillRect(0, 0, width, height);
              } else {
                drawSingleMedia(mediaB, motionB, 0.0, ctx, width, height, Boolean(timingB.clip.flipped));
                ctx.fillStyle = `rgba(255, 255, 255, ${(1 - transProgress) * 2})`;
                ctx.fillRect(0, 0, width, height);
              }
            } else if (transition.type === "black-dip") {
              if (transProgress < 0.5) {
                drawSingleMedia(mediaA, motionA, 1.0, ctx, width, height, Boolean(timingA.clip.flipped));
                ctx.fillStyle = `rgba(0, 0, 0, ${transProgress * 2})`;
                ctx.fillRect(0, 0, width, height);
              } else {
                drawSingleMedia(mediaB, motionB, 0.0, ctx, width, height, Boolean(timingB.clip.flipped));
                ctx.fillStyle = `rgba(0, 0, 0, ${(1 - transProgress) * 2})`;
                ctx.fillRect(0, 0, width, height);
              }
            } else if (transition.type === "slide-left") {
              ctx.save();
              ctx.translate(-transProgress * width, 0);
              drawSingleMedia(mediaA, motionA, 1.0, ctx, width, height, Boolean(timingA.clip.flipped));
              ctx.restore();

              ctx.save();
              ctx.translate((1 - transProgress) * width, 0);
              drawSingleMedia(mediaB, motionB, 0.0, ctx, width, height, Boolean(timingB.clip.flipped));
              ctx.restore();
            } else if (transition.type === "slide-right") {
              ctx.save();
              ctx.translate(transProgress * width, 0);
              drawSingleMedia(mediaA, motionA, 1.0, ctx, width, height, Boolean(timingA.clip.flipped));
              ctx.restore();

              ctx.save();
              ctx.translate((-1 + transProgress) * width, 0);
              drawSingleMedia(mediaB, motionB, 0.0, ctx, width, height, Boolean(timingB.clip.flipped));
              ctx.restore();
            } else if (transition.type === "zoom-push") {
              ctx.save();
              ctx.globalAlpha = Math.max(0, 1 - transProgress);
              ctx.translate(width / 2, height / 2);
              ctx.scale(1.0 + transProgress * 0.35, 1.0 + transProgress * 0.35);
              ctx.translate(-width / 2, -height / 2);
              drawSingleMedia(mediaA, motionA, 1.0, ctx, width, height, Boolean(timingA.clip.flipped));
              ctx.restore();

              ctx.save();
              ctx.globalAlpha = transProgress;
              const inScale = 1.3 - transProgress * 0.3;
              ctx.translate(width / 2, height / 2);
              ctx.scale(inScale, inScale);
              ctx.translate(-width / 2, -height / 2);
              drawSingleMedia(mediaB, motionB, 0.0, ctx, width, height, Boolean(timingB.clip.flipped));
              ctx.restore();
            }
            break;
          }
        }
      }

      // 3. Normal rendering if not in active transition
      if (!inTransition) {
        let timing = clipTimings.find((t) => time >= t.start && time < t.end);
        if (!timing && clipTimings.length > 0) {
          timing = time >= totalDuration ? clipTimings[clipTimings.length - 1] : clipTimings[0];
        }
        if (timing) {
          const { clip, start, end } = timing;
          activeNarration = clip.narration;
          const clipDur = Math.max(0.1, end - start);
          const progress = Math.max(0, Math.min(1, (time - start) / clipDur));
          const cachedMedia = getMediaElement(clip);

          drawSingleMedia(
            cachedMedia,
            clip.motion || "zoom-in",
            progress,
            ctx,
            width,
            height,
            Boolean(clip.flipped),
          );

          const isVid = clip.mediaType === "video" || Boolean(clip.videoUrl);
          const isImg = cachedMedia instanceof HTMLImageElement;
          const isReady =
            cachedMedia &&
            ((isImg && cachedMedia.complete && cachedMedia.naturalWidth > 0) ||
              (cachedMedia instanceof HTMLVideoElement && cachedMedia.readyState >= 1));

          if (!isReady) {
            ctx.fillStyle = "#94a3b8";
            ctx.font = "bold 32px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(
              `Clip #${clip.index} (${isVid ? "Video" : "Image"})`,
              width / 2,
              height / 2 - 20,
            );
            ctx.font = "20px sans-serif";
            ctx.fillText(
              isVid
                ? "Attach or import video to view"
                : "Attach or import image to view",
              width / 2,
              height / 2 + 25,
            );
          }
        }
      }

      // 4. Draw Subtitles Overlay (Bengali Narration)
      if (showSubtitles && activeNarration) {
        const text = activeNarration;
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
    [
      clipTimings,
      totalDuration,
      drawSingleMedia,
      getMediaElement,
      showSubtitles,
      project.aspectRatio,
    ],
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
  }, [currentTime, drawFrame, project.aspectRatio, imageVersion]);

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

  // Custom SFX Upload Handler
  const handleCustomSfxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSfxModal) return;

    setUploadingSfx(true);
    notify("Uploading custom sound effect audio…", "info");
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
        setActiveSfxModal((prev) =>
          prev
            ? {
                ...prev,
                config: {
                  ...prev.config,
                  type: "custom",
                  customUrl: uploaded.url,
                  customName: file.name.replace(/\.[^/.]+$/, ""),
                },
              }
            : null,
        );
        notify("Custom sound effect uploaded! Ready to transform.", "success");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to upload SFX", "error");
    } finally {
      setUploadingSfx(false);
      if (customSfxInputRef.current) customSfxInputRef.current.value = "";
    }
  };

  const handleOpenSfxModal = (clip: StudioClip) => {
    const existing = getClipSfxConfig(clip);
    setActiveSfxModal({
      clipId: clip.id,
      config: existing || {
        type: "cartoon-pop",
        offset: 0,
        volume: 1.0,
        speed: 1.0,
      },
    });
  };

  const handleSaveSfxModal = (config: ClipSfxConfig | null) => {
    if (!activeSfxModal) return;
    const clipId = activeSfxModal.clipId;
    if (!config || config.type === "none") {
      onUpdateClip(clipId, { sfx: "none", sfxConfig: undefined });
      notify("Removed sound effect from clip.", "info");
    } else {
      onUpdateClip(clipId, {
        sfx: config.type !== "custom" ? config.type : "none",
        sfxConfig: config,
      });
      notify("Saved sound effect transforms!", "success");
    }
    setActiveSfxModal(null);
  };

  const handleTestSfx = (cfg: ClipSfxConfig) => {
    try {
      if (!sfxAudioCtxRef.current || sfxAudioCtxRef.current.state === "closed") {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        sfxAudioCtxRef.current = new AudioCtx();
      }
      if (sfxAudioCtxRef.current.state === "suspended") {
        sfxAudioCtxRef.current.resume();
      }
      void playUniversalSfx(sfxAudioCtxRef.current, cfg);
    } catch (e) {
      console.warn("[sfx] Test play failed:", e);
    }
  };

  // Apply CapCut Transition to single split or all splits
  const handleApplyTransition = (
    type: TransitionType,
    duration: number,
    applyToAll: boolean,
  ) => {
    if (applyToAll) {
      const updatedClips = project.clips.map((c, idx) => ({
        ...c,
        transition:
          idx < project.clips.length - 1
            ? ({ type, duration } as ClipTransition)
            : undefined,
      }));
      onUpdateProject({ clips: updatedClips });
      notify(
        type === "none"
          ? "Removed transitions from all splits."
          : `Applied ${type} transition (${duration.toFixed(1)}s) across all splits!`,
        "success",
      );
    } else if (
      activeTransitionModal?.clipIndex !== null &&
      activeTransitionModal?.clipIndex !== undefined
    ) {
      const targetIdx = activeTransitionModal.clipIndex;
      const targetClip = project.clips[targetIdx];
      if (targetClip) {
        onUpdateClip(targetClip.id, {
          transition: type === "none" ? undefined : { type, duration },
        });
        notify(
          type === "none"
            ? `Removed transition from Clip #${targetClip.index}.`
            : `Applied ${type} transition (${duration.toFixed(1)}s) to Clip #${targetClip.index}!`,
          "success",
        );
      }
    }
    setActiveTransitionModal(null);
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

  // Delete the selected clip or voice segment
  const handleDeleteActive = () => {
    if (selectedTrack === "voice" && selectedVoiceSegmentId) {
      if (voiceSegments.length <= 1) {
        notify("Cannot delete the only voice segment (replace voiceover audio instead).", "info");
        return;
      }
      const newSegments = voiceSegments.filter((s) => s.id !== selectedVoiceSegmentId);
      commitProjectUpdate({ voiceSegments: newSegments });
      setSelectedVoiceSegmentId(null);
      notify("Deleted voice segment.", "info");
      return;
    }

    if (!editingTiming) return;
    if (project.clips.length <= 1) {
      notify("Cannot delete the only remaining clip.", "info");
      return;
    }
    const clipIndex = editingTiming.clip.index;
    const newClips = project.clips
      .filter((c) => c.id !== editingTiming.clip.id)
      .map((c, i) => ({ ...c, index: i + 1 }));

    setSelectedClipId(null);
    commitProjectUpdate({ clips: newClips });
    notify(`Deleted Clip #${clipIndex}.`, "info");
  };

  // Duplicate the selected clip (falls back to the playhead clip)
  const handleDuplicateActiveClip = () => {
    if (!editingTiming) return;
    const targetIdx = project.clips.findIndex((c) => c.id === editingTiming.clip.id);
    if (targetIdx === -1) return;

    const clone: StudioClip = {
      ...editingTiming.clip,
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };

    const newClips = [...project.clips];
    newClips.splice(targetIdx + 1, 0, clone);
    const reindexed = newClips.map((c, i) => ({ ...c, index: i + 1 }));

    setSelectedClipId(clone.id);
    commitProjectUpdate({ clips: reindexed });
    notify(`Duplicated Clip #${editingTiming.clip.index}!`, "success");
  };

  const handleStepClip = (direction: -1 | 1) => {
    if (clipTimings.length === 0) return;
    const currentIdx = editingTiming
      ? clipTimings.findIndex((t) => t.clip.id === editingTiming.clip.id)
      : 0;
    const nextIdx = Math.min(
      clipTimings.length - 1,
      Math.max(0, currentIdx + direction),
    );
    const next = clipTimings[nextIdx];
    if (!next) return;
    setSelectedClipId(next.clip.id);
    seekTo(next.start);
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
          workflowMode: project.workflowMode ?? "video-clips",
        }),
      });

      if (res.clips?.length) {
        const combined = [...project.clips, ...res.clips];
        commitProjectUpdate({ clips: combined });
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

    commitProjectUpdate({ clips: [...project.clips, ...newClips] });
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

    commitProjectUpdate({ clips: [...project.clips, newClip] });
    notify(`Added Clip #${newClip.index} to timeline!`, "success");
  };

  // Single clip media (image or video) replacement inside timeline
  const handleSingleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const clipId = targetClipForImageRef.current;
    if (!file || !clipId) return;

    const isVideo =
      file.type.startsWith("video/") ||
      /\.(mp4|webm|mov|m4v)$/i.test(file.name);
    const mediaType = isVideo ? ("video" as const) : ("image" as const);
    const localUrl = URL.createObjectURL(file);

    commitClipUpdate(clipId, {
      imageUrl: localUrl,
      videoUrl: isVideo ? localUrl : null,
      mediaUrl: localUrl,
      mediaType,
      videoVolume: 0,
    });

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api<{
        success: boolean;
        files: { url: string; kind?: string }[];
      }>("/api/studio/upload", {
        method: "POST",
        body: formData,
      });
      if (res.files?.[0]?.url) {
        commitClipUpdate(clipId, {
          imageUrl: res.files[0].url,
          videoUrl: isVideo ? res.files[0].url : null,
          mediaUrl: res.files[0].url,
          mediaType,
        });
      }
      notify(
        isVideo
          ? "Clip video updated and saved!"
          : "Clip media updated and saved!",
        "success",
      );
    } catch {
      notify("Clip media updated locally.", "info");
    } finally {
      if (singleImageInputRef.current) singleImageInputRef.current.value = "";
    }
  };

  // Adjust duration for a clip
  const handleAdjustDuration = (clip: StudioClip, delta: number) => {
    const next = Math.max(0.5, Math.min(30, Number(((clip.duration || 3) + delta).toFixed(1))));
    const speed = clip.speed ?? 1.0;
    commitClipUpdate(clip.id, {
      duration: next,
      baseDuration: Number((next * speed).toFixed(1)),
    });
  };

  // CapCut Flip / Mirror horizontal tool
  const handleToggleFlip = (clip: StudioClip) => {
    commitClipUpdate(clip.id, { flipped: !clip.flipped });
    notify(`Flipped Clip #${clip.index} horizontally!`, "info");
  };

  // CapCut Fit Timeline to visible screen
  const handleFitTimeline = () => {
    if (timelineScrollRef.current) {
      const containerW = timelineScrollRef.current.clientWidth - 40;
      const fitPx = Math.max(20, Math.min(100, Math.floor(containerW / totalDuration)));
      setPxPerSec(fitPx);
      notify(`Fitted timeline to screen (${fitPx}px/s)!`, "info");
    }
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

      const voiceSourceList: {
        source: AudioBufferSourceNode;
        startAt: number;
        offset: number;
        duration: number;
      }[] = [];
      let voiceSource: AudioBufferSourceNode | null = null;

      if (voiceTimings.length > 0 && voiceTimings[0].segment.audioUrl) {
        try {
          const audioFetch = await fetch(voiceTimings[0].segment.audioUrl);
          const arrayBuf = await audioFetch.arrayBuffer();
          const decodedAudio = await audioCtx.decodeAudioData(arrayBuf);

          for (const timing of voiceTimings) {
            const bufSource = audioCtx.createBufferSource();
            bufSource.buffer = decodedAudio;
            bufSource.playbackRate.value = currentSpeed;

            const voiceGain = audioCtx.createGain();
            voiceGain.gain.setValueAtTime(voiceVolume, 0);
            bufSource.connect(voiceGain);
            voiceGain.connect(dest);

            voiceSourceList.push({
              source: bufSource,
              startAt: Math.max(0, timing.start / currentSpeed),
              offset: Math.max(0, timing.segment.startOffset),
              duration: Math.max(0.1, timing.segment.duration / currentSpeed),
            });
          }
        } catch (e) {
          console.warn("[editor] Could not mix voice audio for export:", e);
        }
      } else if (project.audioUrl) {
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

      let bgmGain: GainNode | null = null;
      let bgmSource: AudioBufferSourceNode | null = null;
      if (project.bgmUrl) {
        try {
          const bgmFetch = await fetch(project.bgmUrl);
          const bgmArrayBuf = await bgmFetch.arrayBuffer();
          const decodedBgm = await audioCtx.decodeAudioData(bgmArrayBuf);
          const bSource = audioCtx.createBufferSource();
          bSource.buffer = decodedBgm;

          bgmGain = audioCtx.createGain();
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

      // Preload every SFX & video element used in this project before the recorder starts.
      const presetSfxTypes = new Set<SfxType>();
      const customSfxUrls = new Set<string>();
      const videoPreloadPromises: Promise<void>[] = [];

      for (const timing of clipTimings) {
        const cfg = getClipSfxConfig(timing.clip);
        if (cfg && cfg.type !== "none") {
          if (cfg.type === "custom") {
            if (cfg.customUrl) customSfxUrls.add(cfg.customUrl);
          } else {
            presetSfxTypes.add(cfg.type);
          }
        }

        const media = getClipMedia(timing.clip);
        if (media.type === "video" && media.url) {
          let vid = videoCacheRef.current.get(media.url);
          if (!vid) {
            vid = document.createElement("video");
            vid.src = media.url;
            vid.crossOrigin = "anonymous";
            vid.playsInline = true;
            vid.muted = true;
            vid.preload = "auto";
            videoCacheRef.current.set(media.url, vid);
          }
          if (vid.readyState < 2) {
            videoPreloadPromises.push(
              new Promise((res) => {
                vid!.onloadeddata = () => res();
                vid!.onerror = () => res();
                setTimeout(res, 3000);
              }),
            );
          }
        }
      }
      await Promise.all([
        ...[...presetSfxTypes].map((type) =>
          loadPresetSfxBuffer(audioCtx, type),
        ),
        ...[...customSfxUrls].map((url) => loadAudioBuffer(audioCtx, url)),
        ...videoPreloadPromises,
      ]);

      const sfxTriggeredDuringExport = new Set<string>();
      recorder.start();
      const exportStartAudioTime = audioCtx.currentTime;
      if (voiceSourceList.length > 0) {
        for (const item of voiceSourceList) {
          item.source.start(
            exportStartAudioTime + item.startAt,
            item.offset,
            item.duration,
          );
        }
      } else if (voiceSource) {
        voiceSource.start(0);
      }
      if (bgmSource) bgmSource.start(0);

      // Render frames continuously locked to AudioContext master clock with exact custom clip timings
      await new Promise<void>((resolve) => {
        let animId: number;
        const exportLoop = () => {
          const elapsed = audioCtx.currentTime - exportStartAudioTime;
          const simTime = Math.min(totalDuration, elapsed);

          // Smart Audio Ducking during export
          if (bgmGain && enableDucking && project.audioUrl) {
            const isSpeaking = simTime < project.audioDuration / currentSpeed;
            const duckTarget = isSpeaking
              ? Math.min(bgmVolume, 0.15)
              : Math.min(1.0, Math.max(bgmVolume, 0.35));
            bgmGain.gain.setValueAtTime(duckTarget, audioCtx.currentTime);
          }

          // Trigger procedural or custom SFX into export audio stream
          clipTimings.forEach((timing) => {
            const cfg = getClipSfxConfig(timing.clip);
            if (
              cfg &&
              cfg.type !== "none" &&
              !sfxTriggeredDuringExport.has(timing.clip.id)
            ) {
              const triggerTime = timing.start + (cfg.offset || 0);
              if (simTime >= triggerTime && simTime <= triggerTime + 0.15) {
                sfxTriggeredDuringExport.add(timing.clip.id);
                void playUniversalSfx(audioCtx, cfg, dest);
              }
            }
          });

          if (exportCtx) {
            // Sync active video frame if current clip is a video
            const activeClipTiming = clipTimings.find(
              (t) => simTime >= t.start && simTime < t.end,
            );
            if (activeClipTiming) {
              const media = getClipMedia(activeClipTiming.clip);
              if (media.type === "video" && media.url) {
                const vid = videoCacheRef.current.get(media.url);
                if (vid && vid.readyState >= 1) {
                  const clipSpeed = activeClipTiming.clip.speed || 1;
                  vid.currentTime = Math.max(
                    0,
                    (simTime - activeClipTiming.start) * clipSpeed,
                  );
                }
              }
            }
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

  // Click-or-drag scrubbing that works on any timeline track
  const beginScrub = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = event.currentTarget;
    const update = (clientX: number) => {
      const rect = track.getBoundingClientRect();
      seekTo(Math.max(0, (clientX - rect.left) / pxPerSec));
    };

    update(event.clientX);

    const handleMove = (moveEvent: PointerEvent) => update(moveEvent.clientX);
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const tickStep = pxPerSec >= 60 ? 1 : pxPerSec >= 32 ? 2 : 5;
  // Label spacing must be a multiple of tick spacing so every label lands on a tick.
  const labelStep = pxPerSec >= 60 ? 5 : 10;
  const sfxCount = project.clips.filter((clip) => Boolean(getClipSfxConfig(clip))).length;
  const bgmLabel =
    BGM_MOOD_PRESETS.find((preset) => preset.id === project.bgmMood)?.label ||
    "Custom music";
  const aspectLabel =
    project.aspectRatio === "9:16" ? "9:16 Shorts / Reels" : "16:9 YouTube";

  const mobileToolTitles: Record<MobileEditorTab, string> = {
    media: "Media",
    audio: "Audio",
    text: "Text",
    transitions: "Transitions",
    effects: "Effects",
    clip: "Clip properties",
  };

  const handleSelectClip = (clip: StudioClip) => {
    const timing = clipTimings.find((item) => item.clip.id === clip.id);
    setSelectedClipId(clip.id);
    setInspectorTab("clip");
    setMobileTool(null);
    if (timing) seekTo(timing.start);
  };

  const handleOpenTransitionAll = () => {
    setMobileTool(null);
    setActiveTransitionModal({
      clipIndex: null,
      type: "white-flash",
      duration: 0.4,
    });
  };

  const handleOpenTransitionAtPlayhead = () => {
    if (clipTimings.length < 2) return;
    const targetIndex =
      activeClipIndex >= clipTimings.length - 1
        ? clipTimings.length - 2
        : activeClipIndex;
    const targetClip = clipTimings[targetIndex]?.clip;
    setMobileTool(null);
    setActiveTransitionModal({
      clipIndex: targetIndex,
      type: targetClip?.transition?.type ?? "dissolve",
      duration: targetClip?.transition?.duration ?? 0.4,
    });
  };

  const handleOpenSfxFromPanel = (clip: StudioClip) => {
    setMobileTool(null);
    handleOpenSfxModal(clip);
  };

  const handleImportImagesFromPanel = () => {
    setMobileTool(null);
    onImportImagesClick();
  };

  return (
    <section
      aria-label="CapCut-style video studio and exporter"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-editor-chrome text-foreground"
    >
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
        ref={customSfxInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg"
        className="sr-only"
        onChange={handleCustomSfxUpload}
      />
      <input
        ref={singleImageInputRef}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        className="sr-only"
        onChange={handleSingleImageFile}
      />

      {/* ── Command bar ─────────────────────────────────────────── */}
      <CommandBar
        project={project}
        aspectLabel={aspectLabel}
        totalDuration={totalDuration}
        effectiveAudioDuration={effectiveAudioDuration}
        showSubtitles={showSubtitles}
        saveStatus={saveStatus}
        onToggleSubtitles={() => setShowSubtitles((value) => !value)}
        onImportImagesClick={onImportImagesClick}
        onReplaceVoice={() => audioInputRef.current?.click()}
        onAutoSync={handleAutoSyncAudio}
        uploadingAudio={uploadingAudio}
        isExporting={isExporting}
        exportProgress={exportProgress}
        onExport={handleExportVideo}
        onResetProject={handleResetProject}
      />

      {/* ── Library + monitor + properties ──────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <EditorToolRail
          activeTool={activeTool}
          onSelectTool={(tool) =>
            setActiveTool((current) => (current === tool ? null : tool))
          }
        />

        {activeTool ? (
          <EditorToolPanel
            activeTool={activeTool}
            project={project}
            selectedClip={editingClip}
            selectedTiming={editingTiming}
            showSubtitles={showSubtitles}
            saturation={saturation}
            onClose={() => setActiveTool(null)}
            onToggleSubtitles={() => setShowSubtitles((value) => !value)}
            onImportImages={handleImportImagesFromPanel}
            onAddClip={handleAddNewEmptyClip}
            onSelectClip={handleSelectClip}
            onUpdateProject={onUpdateProject}
            onUpdateClip={onUpdateClip}
            onOpenTransitionAll={handleOpenTransitionAll}
            onOpenTransitionAtPlayhead={handleOpenTransitionAtPlayhead}
            onOpenSfx={handleOpenSfxFromPanel}
          />
        ) : null}

        <div className="flex min-w-0 flex-1">
          <PreviewStage
            project={project}
            stageRef={stageRef}
            canvasRef={canvasRef}
            isFullscreen={isFullscreen}
            isExporting={isExporting}
            exportProgress={exportProgress}
            showSubtitles={showSubtitles}
            onToggleSubtitles={() => setShowSubtitles((value) => !value)}
            onToggleFullscreen={toggleFullscreen}
            onUpdateProject={onUpdateProject}
          />

          <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-surface-subtle xl:flex">
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {inspectorTab === "clip" ? (
                <ClipInspector
                  editingClip={editingClip}
                  editingTiming={editingTiming}
                  isEditingSelected={isEditingSelected}
                  onStepClip={handleStepClip}
                  onAdjustDuration={handleAdjustDuration}
                  onUpdateClip={commitClipUpdate}
                  targetClipForImageRef={targetClipForImageRef}
                  singleImageInputRef={singleImageInputRef}
                  onToggleFlip={handleToggleFlip}
                  onSplit={handleSplitSelected}
                  onDuplicate={handleDuplicateActiveClip}
                  onDelete={handleDeleteActive}
                  onOpenSfx={handleOpenSfxFromPanel}
                />
              ) : inspectorTab === "audio" ? (
                <AudioMixer
                  project={project}
                  onUpdateProject={commitProjectUpdate}
                  effectiveAudioDuration={effectiveAudioDuration}
                  currentSpeed={currentSpeed}
                  voiceVolume={voiceVolume}
                  bgmVolume={bgmVolume}
                  bgmLabel={bgmLabel}
                  enableDucking={enableDucking}
                  generatingBgm={generatingBgm}
                  audioInputRef={audioInputRef}
                  bgmInputRef={bgmInputRef}
                  onUpdateSpeed={handleUpdateSpeed}
                  onGenerateBgm={handleGenerateBgm}
                />
              ) : (
                <ProjectInspectorPanel
                  project={project}
                  onUpdateProject={onUpdateProject}
                />
              )}
            </div>
          </aside>

          <InspectorRail activeTab={inspectorTab} onSelectTab={setInspectorTab} />
        </div>
      </div>

      {/* ── Transport ───────────────────────────────────────────── */}
      <TransportBar
        project={project}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((playing) => !playing)}
        onSeek={seekTo}
        onStop={() => {
          setIsPlaying(false);
          seekTo(0);
        }}
        currentTime={currentTime}
        totalDuration={totalDuration}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted((muted) => !muted)}
        onToggleFullscreen={toggleFullscreen}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      {/* ── Timeline dock ───────────────────────────────────────── */}
      <TimelineDock
        project={project}
        onUpdateProject={commitProjectUpdate}
        editingClip={editingClip}
        clipTimings={clipTimings}
        totalDuration={totalDuration}
        effectiveAudioDuration={effectiveAudioDuration}
        durationDeficit={durationDeficit}
        clipsNeeded={clipsNeeded}
        isGeneratingMore={isGeneratingMore}
        currentTime={currentTime}
        activeClipIndex={activeClipIndex}
        selectedClipId={selectedClipId}
        selectedTrack={selectedTrack}
        setSelectedTrack={setSelectedTrack}
        selectedVoiceSegmentId={selectedVoiceSegmentId}
        setSelectedVoiceSegmentId={setSelectedVoiceSegmentId}
        voiceTimings={voiceTimings}
        sfxCount={sfxCount}
        bgmLabel={bgmLabel}
        bgmVolume={bgmVolume}
        isMuted={isMuted}
        pxPerSec={pxPerSec}
        tickStep={tickStep}
        labelStep={labelStep}
        timelineWidth={timelineWidth}
        voiceoverWidth={voiceoverWidth}
        customDuration={customDuration}
        resizingClip={resizingClip}
        timelineScrollRef={timelineScrollRef}
        waveformCanvasRef={waveformCanvasRef}
        audioPeaks={audioPeaks}
        audioInputRef={audioInputRef}
        bgmInputRef={bgmInputRef}
        setIsMuted={setIsMuted}
        setSelectedClipId={setSelectedClipId}
        setPxPerSec={setPxPerSec}
        setCustomDuration={setCustomDuration}
        setActiveTransitionModal={setActiveTransitionModal}
        seekTo={seekTo}
        beginScrub={beginScrub}
        startResizing={startResizing}
        isAllSameDuration={isAllSameDuration}
        handleGenerateMoreScenes={handleGenerateMoreScenes}
        handleAutoFillClips={handleAutoFillClips}
        handleAutoSyncAudio={handleAutoSyncAudio}
        handleSetAllClipsDuration={handleSetAllClipsDuration}
        handleFitTimeline={handleFitTimeline}
        handleSplitAtPlayhead={handleSplitSelected}
        handleSplitSelected={handleSplitSelected}
        handleSplitAllAtPlayhead={handleSplitAllAtPlayhead}
        handleDuplicateActiveClip={handleDuplicateActiveClip}
        handleDeleteActiveClip={handleDeleteActive}
        handleToggleFlip={handleToggleFlip}
        handleAddNewEmptyClip={handleAddNewEmptyClip}
        handleOpenSfxModal={handleOpenSfxModal}
      />

      <MobileEditorToolbar
        activeTab={mobileTool}
        onSelectTab={(tab) =>
          setMobileTool((current) => (current === tab ? null : tab))
        }
      />

      {mobileTool ? (
        <MobileToolSheet
          title={mobileToolTitles[mobileTool]}
          onClose={() => setMobileTool(null)}
        >
          {mobileTool === "clip" ? (
            <ClipInspector
              editingClip={editingClip}
              editingTiming={editingTiming}
              isEditingSelected={isEditingSelected}
              onStepClip={handleStepClip}
              onAdjustDuration={handleAdjustDuration}
              onUpdateClip={commitClipUpdate}
              targetClipForImageRef={targetClipForImageRef}
              singleImageInputRef={singleImageInputRef}
              onToggleFlip={handleToggleFlip}
              onSplit={handleSplitSelected}
              onDuplicate={handleDuplicateActiveClip}
              onDelete={handleDeleteActive}
              onOpenSfx={handleOpenSfxFromPanel}
            />
          ) : mobileTool === "audio" ? (
            <AudioMixer
              project={project}
              onUpdateProject={commitProjectUpdate}
              effectiveAudioDuration={effectiveAudioDuration}
              currentSpeed={currentSpeed}
              voiceVolume={voiceVolume}
              bgmVolume={bgmVolume}
              bgmLabel={bgmLabel}
              enableDucking={enableDucking}
              generatingBgm={generatingBgm}
              audioInputRef={audioInputRef}
              bgmInputRef={bgmInputRef}
              onUpdateSpeed={handleUpdateSpeed}
              onGenerateBgm={handleGenerateBgm}
            />
          ) : (
            <EditorToolPanelContent
              activeTool={mobileTool}
              project={project}
              selectedClip={editingClip}
              selectedTiming={editingTiming}
              showSubtitles={showSubtitles}
              saturation={saturation}
              onToggleSubtitles={() => setShowSubtitles((value) => !value)}
              onImportImages={handleImportImagesFromPanel}
              onAddClip={handleAddNewEmptyClip}
              onSelectClip={handleSelectClip}
              onUpdateProject={onUpdateProject}
              onUpdateClip={onUpdateClip}
              onOpenTransitionAll={handleOpenTransitionAll}
              onOpenTransitionAtPlayhead={handleOpenTransitionAtPlayhead}
              onOpenSfx={handleOpenSfxFromPanel}
            />
          )}
        </MobileToolSheet>
      ) : null}

      {/* Hidden media elements for live playback */}
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

      {project.bgmUrl ? (
        <audio ref={bgmRef} src={project.bgmUrl} loop muted={isMuted} />
      ) : null}

      {/* Transition + SFX modals */}
      <EditorModals
        project={project}
        clipTimings={clipTimings}
        currentTime={currentTime}
        activeTransitionModal={activeTransitionModal}
        setActiveTransitionModal={setActiveTransitionModal}
        handleApplyTransition={handleApplyTransition}
        activeSfxModal={activeSfxModal}
        setActiveSfxModal={setActiveSfxModal}
        handleSaveSfxModal={handleSaveSfxModal}
        handleTestSfx={handleTestSfx}
        customSfxInputRef={customSfxInputRef}
        uploadingSfx={uploadingSfx}
        notify={notify}
      />

      {/* Shadcn Alert Dialog for Reset Confirmation */}
      <ConfirmDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        title="Reset Studio Project?"
        description="Are you sure you want to reset everything? All video clips, images, voiceover segments, and timeline transforms will be completely cleared."
        confirmLabel="Yes, Reset Everything"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleConfirmReset}
      />
    </section>
  );
}
