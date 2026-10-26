"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_MODEL } from "@/lib/constants";

export const MODEL_STORAGE_KEY = "story_forge_selected_model";
export const MODEL_CHANGE_EVENT = "story_forge_model_change";

/**
 * Read the user's selected model from browser storage.
 * Safely handles SSR and missing storage.
 */
export function getStoredModel(): string {
  if (typeof window === "undefined") {
    return DEFAULT_MODEL;
  }
  try {
    const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (stored && typeof stored === "string" && stored.trim()) {
      return stored.trim();
    }
  } catch {
    // LocalStorage might be disabled or restricted
  }
  return DEFAULT_MODEL;
}

/**
 * Persist the user's selected model into browser storage.
 * Dispatches an event so other components update synchronously.
 */
export function setStoredModel(modelId: string): void {
  if (typeof window === "undefined") return;

  const validModel = modelId && modelId.trim() ? modelId.trim() : DEFAULT_MODEL;
  try {
    window.localStorage.setItem(MODEL_STORAGE_KEY, validModel);
  } catch {
    // Ignore storage write errors (e.g., quota exceeded, private mode)
  }

  // Notify listeners within the same window
  window.dispatchEvent(
    new CustomEvent(MODEL_CHANGE_EVENT, { detail: validModel })
  );
}

/**
 * React hook to read and update the persisted AI model selection.
 */
export function useSelectedModel() {
  const [model, setModel] = useState<string>(() => getStoredModel());
  const [isLoaded] = useState<boolean>(true);

  useEffect(() => {
    const handleModelChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setModel(customEvent.detail);
      } else {
        setModel(getStoredModel());
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === MODEL_STORAGE_KEY) {
        setModel(e.newValue || DEFAULT_MODEL);
      }
    };

    window.addEventListener(MODEL_CHANGE_EVENT, handleModelChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(MODEL_CHANGE_EVENT, handleModelChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const updateModel = useCallback((newModel: string) => {
    setStoredModel(newModel);
    setModel(newModel);
  }, []);

  return {
    selectedModel: model,
    setSelectedModel: updateModel,
    isDefaultModel: model === DEFAULT_MODEL,
    isLoaded,
  };
}
