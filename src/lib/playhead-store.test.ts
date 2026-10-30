import { describe, it, expect, vi } from "vitest";
import { createPlayheadStore } from "./playhead-store";

describe("playhead-store", () => {
  it("initializes with provided time or 0", () => {
    const s1 = createPlayheadStore(5.5);
    expect(s1.getPlayhead()).toBe(5.5);

    const s2 = createPlayheadStore(-1);
    expect(s2.getPlayhead()).toBe(0);

    const s3 = createPlayheadStore(Number.NaN);
    expect(s3.getPlayhead()).toBe(0);
  });

  it("updates playhead and notifies subscribers", () => {
    const store = createPlayheadStore(0);
    const listenerA = vi.fn();
    const listenerB = vi.fn();

    const unsubA = store.subscribe(listenerA);
    const unsubB = store.subscribe(listenerB);

    store.setPlayhead(1.25);
    expect(store.getPlayhead()).toBe(1.25);
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    // No notification if time is unchanged
    store.setPlayhead(1.25);
    expect(listenerA).toHaveBeenCalledTimes(1);

    // Unsubscribe listenerA
    unsubA();
    store.setPlayhead(2.5);
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(2);

    unsubB();
    store.setPlayhead(3.0);
    expect(listenerB).toHaveBeenCalledTimes(2);
  });
});
