"use client";

export interface MediaResourceLeaseTracker {
  /**
   * Hold the given asset URLs alive until the returned release function is
   * called. Release is idempotent and safe after the owning provider unmounts.
   */
  acquire(assetIds: Iterable<string>): () => void;
  isLeased(assetId: string): boolean;
  /**
   * Revoke an asset's Object URLs immediately when it is not leased, or defer
   * revocation until the last active lease is released.
   */
  revokeWhenReleased(assetId: string, revoke: () => void): void;
  /**
   * Mark the provider as gone. Any deferred revocations without an active
   * lease run now; leased resources stay alive until the operation releases.
   */
  dispose(): void;
}

export function createMediaResourceLeaseTracker(): MediaResourceLeaseTracker {
  const leaseCounts = new Map<string, number>();
  const deferredRevocations = new Map<string, () => void>();

  const runDeferredRevocation = (assetId: string) => {
    if ((leaseCounts.get(assetId) ?? 0) > 0) return;
    const revoke = deferredRevocations.get(assetId);
    if (!revoke) return;
    deferredRevocations.delete(assetId);
    revoke();
  };

  return {
    acquire(assetIds) {
      const uniqueIds = Array.from(new Set(assetIds));
      if (uniqueIds.length === 0) return () => {};

      for (const assetId of uniqueIds) {
        leaseCounts.set(assetId, (leaseCounts.get(assetId) ?? 0) + 1);
      }

      let released = false;
      return () => {
        if (released) return;
        released = true;

        for (const assetId of uniqueIds) {
          const remaining = (leaseCounts.get(assetId) ?? 1) - 1;
          if (remaining > 0) {
            leaseCounts.set(assetId, remaining);
          } else {
            leaseCounts.delete(assetId);
            runDeferredRevocation(assetId);
          }
        }
      };
    },

    isLeased(assetId) {
      return (leaseCounts.get(assetId) ?? 0) > 0;
    },

    revokeWhenReleased(assetId, revoke) {
      if ((leaseCounts.get(assetId) ?? 0) > 0) {
        deferredRevocations.set(assetId, revoke);
        return;
      }
      revoke();
    },

    dispose() {
      for (const assetId of Array.from(deferredRevocations.keys())) {
        runDeferredRevocation(assetId);
      }
    },
  };
}
