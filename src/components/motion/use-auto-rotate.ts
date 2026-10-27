"use client";

import { useEffect, useState } from "react";

export function useAutoRotate(length: number, delay: number, enabled = true) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!enabled || paused || length < 2) return;

    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % length);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [index, length, delay, enabled, paused]);

  return { index, setIndex, paused, setPaused };
}
