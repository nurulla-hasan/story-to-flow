import { describe, it, expect } from "vitest";
import { calculatePlayheadTimeFromPointer } from "./playhead-coordinates";
import { getPixelsPerSecond } from "./ruler-scale";

describe("Playhead Coordinate & Scrubbing Calculations", () => {
  it("calculates accurate playhead time at 100% zoom with no scroll", () => {
    const pxPerSec = getPixelsPerSecond(100); // 40 px/s
    const time = calculatePlayheadTimeFromPointer({
      clientX: 244,
      containerLeft: 144, // 100px into container
      scrollLeft: 0,
      pixelsPerSecond: pxPerSec,
      totalDuration: 10,
    });
    expect(time).toBe(2.5); // 100px / 40 px/s = 2.5s
  });

  it("calculates accurate playhead time with horizontal scroll offset", () => {
    const pxPerSec = getPixelsPerSecond(100); // 40 px/s
    const time = calculatePlayheadTimeFromPointer({
      clientX: 244,
      containerLeft: 144, // 100px into container viewport
      scrollLeft: 200, // container scrolled 200px right
      pixelsPerSecond: pxPerSec,
      totalDuration: 20,
    });
    // (100 + 200) / 40 = 300 / 40 = 7.5s
    expect(time).toBe(7.5);
  });

  it("calculates accurate playhead time at 10% zoom (low zoom / overview)", () => {
    const pxPerSec = getPixelsPerSecond(10); // 4 px/s
    const time = calculatePlayheadTimeFromPointer({
      clientX: 344,
      containerLeft: 144, // 200px into container
      scrollLeft: 0,
      pixelsPerSecond: pxPerSec,
      totalDuration: 100,
    });
    // 200px / 4 px/s = 50.0s
    expect(time).toBe(50.0);
  });

  it("calculates accurate playhead time at 500% zoom (deep frame precision)", () => {
    const pxPerSec = getPixelsPerSecond(500); // 200 px/s
    const time = calculatePlayheadTimeFromPointer({
      clientX: 244,
      containerLeft: 144, // 100px into container
      scrollLeft: 0,
      pixelsPerSecond: pxPerSec,
      totalDuration: 10,
    });
    // 100px / 200 px/s = 0.5s
    expect(time).toBe(0.5);
  });

  it("clamps to 0 when pointer is dragged left of timeline origin into track sidebar", () => {
    const pxPerSec = getPixelsPerSecond(100);
    const time = calculatePlayheadTimeFromPointer({
      clientX: 44, // 100px to the left of container
      containerLeft: 144,
      scrollLeft: 0,
      pixelsPerSecond: pxPerSec,
      totalDuration: 10,
    });
    expect(time).toBe(0);
  });

  it("clamps to totalDuration when pointer is dragged past the end of the timeline", () => {
    const pxPerSec = getPixelsPerSecond(100);
    const time = calculatePlayheadTimeFromPointer({
      clientX: 2000,
      containerLeft: 144,
      scrollLeft: 500,
      pixelsPerSecond: pxPerSec,
      totalDuration: 10,
    });
    expect(time).toBe(10);
  });

  it("safely handles zero or negative pixelsPerSecond", () => {
    const time = calculatePlayheadTimeFromPointer({
      clientX: 200,
      containerLeft: 100,
      scrollLeft: 0,
      pixelsPerSecond: 0,
      totalDuration: 10,
    });
    expect(time).toBe(0);
  });
});
