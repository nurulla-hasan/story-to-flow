import { describe, expect, it, vi } from "vitest";
import { createMediaResourceLeaseTracker } from "./media-resource-leases";

describe("media resource leases", () => {
  it("revokes immediately when no operation holds a lease", () => {
    const tracker = createMediaResourceLeaseTracker();
    const revoke = vi.fn();

    tracker.revokeWhenReleased("asset-1", revoke);

    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("defers revocation until the active operation releases its lease", () => {
    const tracker = createMediaResourceLeaseTracker();
    const revoke = vi.fn();

    const release = tracker.acquire(["asset-1", "asset-2"]);

    expect(tracker.isLeased("asset-1")).toBe(true);
    expect(tracker.isLeased("asset-2")).toBe(true);

    tracker.revokeWhenReleased("asset-1", revoke);

    expect(revoke).not.toHaveBeenCalled();
    expect(tracker.isLeased("asset-1")).toBe(true);

    release();

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(tracker.isLeased("asset-1")).toBe(false);
  });

  it.each(["completes", "aborts", "fails"] as const)(
    "releases resources after an operation %s",
    () => {
      const tracker = createMediaResourceLeaseTracker();
      const revoke = vi.fn();

      const release = tracker.acquire(["asset-1"]);
      tracker.revokeWhenReleased("asset-1", revoke);

      expect(revoke).not.toHaveBeenCalled();
      expect(tracker.isLeased("asset-1")).toBe(true);

      // Export dialogs call the same release function in their finally block
      // for successful, cancelled, and failed exports.
      release();

      expect(revoke).toHaveBeenCalledTimes(1);
      expect(tracker.isLeased("asset-1")).toBe(false);
    }
  );

  it("does not release a resource until every lease is returned", () => {
    const tracker = createMediaResourceLeaseTracker();
    const revoke = vi.fn();

    const first = tracker.acquire(["asset-1"]);
    const second = tracker.acquire(["asset-1"]);
    tracker.revokeWhenReleased("asset-1", revoke);

    first();
    expect(revoke).not.toHaveBeenCalled();
    expect(tracker.isLeased("asset-1")).toBe(true);

    second();
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(tracker.isLeased("asset-1")).toBe(false);
  });

  it("makes release idempotent", () => {
    const tracker = createMediaResourceLeaseTracker();
    const revoke = vi.fn();

    const release = tracker.acquire(["asset-1"]);
    tracker.revokeWhenReleased("asset-1", revoke);

    release();
    release();
    release();

    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("keeps leased URLs alive across provider disposal and revokes on release", () => {
    const tracker = createMediaResourceLeaseTracker();
    const revoke = vi.fn();

    const release = tracker.acquire(["asset-1"]);
    tracker.revokeWhenReleased("asset-1", revoke);

    // A route change unmounts the provider while an export is still running.
    tracker.dispose();

    expect(revoke).not.toHaveBeenCalled();
    expect(tracker.isLeased("asset-1")).toBe(true);

    release();

    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("handles empty and duplicate lease requests safely", () => {
    const tracker = createMediaResourceLeaseTracker();
    const revoke = vi.fn();

    const emptyRelease = tracker.acquire([]);
    emptyRelease();

    const release = tracker.acquire(["asset-1", "asset-1", "asset-1"]);
    tracker.revokeWhenReleased("asset-1", revoke);

    release();
    release();

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(tracker.isLeased("asset-1")).toBe(false);
  });
});
