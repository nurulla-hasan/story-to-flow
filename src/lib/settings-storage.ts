"use client";

import { useCallback, useSyncExternalStore } from "react";

import type {
  VisualAssetMode,
  VideoSoundMode,
  VideoAssetDuration,
} from "./validation";

export const PRODUCTION_SETTINGS_KEY = "story_forge_production_settings";
export const SETTINGS_CHANGE_EVENT = "story_forge_settings_change";

export interface ProductionSettingsState {
  visualStyle: string;
  aspectRatio: "9:16" | "16:9";
  staticFramePacing: "Auto" | number;
  videoAssetDuration: VideoAssetDuration;
  visualAssetMode: VisualAssetMode;
  videoSoundMode: VideoSoundMode;
}

export const DEFAULT_PRODUCTION_SETTINGS: ProductionSettingsState = {
  visualStyle: "Auto",
  aspectRatio: "9:16",
  staticFramePacing: 4, // 4.0s default static image frame pacing
  videoAssetDuration: 4, // 4.0s default video source asset duration (4s, 6s, 8s)
  visualAssetMode: "Hybrid", // Hybrid (AI mixes static images & video)
  videoSoundMode: "Silent Video", // Silent Video default
};

export function getStoredProductionSettings(): ProductionSettingsState {
  if (typeof window === "undefined") {
    return DEFAULT_PRODUCTION_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(PRODUCTION_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const parsedVideoDur = parsed.videoAssetDuration;
      const validVideoDur: VideoAssetDuration =
        parsedVideoDur === 4 || parsedVideoDur === 6 || parsedVideoDur === 8
          ? parsedVideoDur
          : DEFAULT_PRODUCTION_SETTINGS.videoAssetDuration;

      return {
        visualStyle: parsed.visualStyle || DEFAULT_PRODUCTION_SETTINGS.visualStyle,
        aspectRatio: parsed.aspectRatio === "16:9" ? "16:9" : "9:16",
        staticFramePacing: parsed.staticFramePacing ?? DEFAULT_PRODUCTION_SETTINGS.staticFramePacing,
        videoAssetDuration: validVideoDur,
        visualAssetMode: parsed.visualAssetMode || DEFAULT_PRODUCTION_SETTINGS.visualAssetMode,
        videoSoundMode: parsed.videoSoundMode || DEFAULT_PRODUCTION_SETTINGS.videoSoundMode,
      };
    }
  } catch {
    // Fall back to defaults on parsing errors
  }
  return DEFAULT_PRODUCTION_SETTINGS;
}

export function setStoredProductionSettings(
  partial: Partial<ProductionSettingsState>
): void {
  if (typeof window === "undefined") return;

  try {
    const current = getStoredProductionSettings();
    const updated = { ...current, ...partial };
    window.localStorage.setItem(PRODUCTION_SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent(SETTINGS_CHANGE_EVENT, { detail: updated })
    );
  } catch {
    // Ignore storage write errors
  }
}

export function resetStoredProductionSettings(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PRODUCTION_SETTINGS_KEY,
      JSON.stringify(DEFAULT_PRODUCTION_SETTINGS)
    );
    window.dispatchEvent(
      new CustomEvent(SETTINGS_CHANGE_EVENT, { detail: DEFAULT_PRODUCTION_SETTINGS })
    );
  } catch {
    // Ignore storage write errors
  }
}

function subscribeToSettingsChanges(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(SETTINGS_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SETTINGS_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

let cachedSnapshot: ProductionSettingsState = DEFAULT_PRODUCTION_SETTINGS;
let cachedRaw: string | null = null;

function getSettingsSnapshot(): ProductionSettingsState {
  if (typeof window === "undefined") {
    return DEFAULT_PRODUCTION_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(PRODUCTION_SETTINGS_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedSnapshot = getStoredProductionSettings();
    }
    return cachedSnapshot;
  } catch {
    return DEFAULT_PRODUCTION_SETTINGS;
  }
}

function getServerSettingsSnapshot(): ProductionSettingsState {
  return DEFAULT_PRODUCTION_SETTINGS;
}

export function useProductionSettings() {
  const settings = useSyncExternalStore(
    subscribeToSettingsChanges,
    getSettingsSnapshot,
    getServerSettingsSnapshot
  );

  const updateSetting = useCallback(
    <K extends keyof ProductionSettingsState>(
      key: K,
      value: ProductionSettingsState[K]
    ) => {
      setStoredProductionSettings({ [key]: value });
    },
    []
  );

  const resetDefaults = useCallback(() => {
    resetStoredProductionSettings();
  }, []);

  const isDefault =
    settings.visualStyle === DEFAULT_PRODUCTION_SETTINGS.visualStyle &&
    settings.aspectRatio === DEFAULT_PRODUCTION_SETTINGS.aspectRatio &&
    settings.staticFramePacing === DEFAULT_PRODUCTION_SETTINGS.staticFramePacing &&
    settings.videoAssetDuration === DEFAULT_PRODUCTION_SETTINGS.videoAssetDuration &&
    settings.visualAssetMode === DEFAULT_PRODUCTION_SETTINGS.visualAssetMode &&
    settings.videoSoundMode === DEFAULT_PRODUCTION_SETTINGS.videoSoundMode;

  return {
    settings,
    updateSetting,
    resetDefaults,
    isDefault,
  };
}
