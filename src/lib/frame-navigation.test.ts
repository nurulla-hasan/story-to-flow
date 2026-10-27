import { describe, it, expect } from "vitest";
import {
  stepFrame,
  formatFrameTimecode,
} from "./frame-navigation";

describe("Single-Frame Playhead Stepping Logic", () => {
  it("steps forward by exactly 1 frame (1/30s)", () => {
    const next = stepFrame(0, 1, 10.0, 30);
    expect(next).toBe(1 / 30);
    expect(formatFrameTimecode(next, 30)).toBe("00:00:01");
  });

  it("steps backward by exactly 1 frame", () => {
    const initial = 5 / 30;
    const prev = stepFrame(initial, -1, 10.0, 30);
    expect(prev).toBe(4 / 30);
    expect(formatFrameTimecode(prev, 30)).toBe("00:00:04");
  });

  it("clamps at timeline start 0 when stepping backward from 0", () => {
    const clamped = stepFrame(0, -1, 10.0, 30);
    expect(clamped).toBe(0);
    expect(formatFrameTimecode(clamped, 30)).toBe("00:00:00");
  });

  it("clamps at timeline end when stepping forward beyond total duration", () => {
    const clamped = stepFrame(10.0, 1, 10.0, 30);
    expect(clamped).toBe(10.0);
    expect(formatFrameTimecode(clamped, 30)).toBe("00:10:00");
  });

  it("eliminates cumulative floating-point drift over 300 repeated steps", () => {
    let playhead = 0;
    // Step forward 300 times (10 full seconds at 30 fps)
    for (let i = 0; i < 300; i++) {
      playhead = stepFrame(playhead, 1, 10.0, 30);
    }

    expect(playhead).toBe(10.0);
    expect(formatFrameTimecode(playhead, 30)).toBe("00:10:00");

    // Step backward 300 times
    for (let i = 0; i < 300; i++) {
      playhead = stepFrame(playhead, -1, 10.0, 30);
    }

    expect(playhead).toBe(0);
    expect(formatFrameTimecode(playhead, 30)).toBe("00:00:00");
  });

  it("formats timecode accurately for frame boundaries 0 through 29", () => {
    expect(formatFrameTimecode(0 / 30, 30)).toBe("00:00:00");
    expect(formatFrameTimecode(14 / 30, 30)).toBe("00:00:14");
    expect(formatFrameTimecode(29 / 30, 30)).toBe("00:00:29");
    expect(formatFrameTimecode(30 / 30, 30)).toBe("00:01:00");
  });
});
