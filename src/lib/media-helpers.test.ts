import { describe, expect, it } from "vitest";
import {
  createMediaFingerprintRegistry,
  getMediaFingerprint,
} from "./media-helpers";

function fileRef(name: string, size: number, lastModified: number) {
  return { name, size, lastModified };
}

describe("media fingerprints and batch duplicate detection", () => {
  it("builds the existing name/size/lastModified identity without hashing", () => {
    const file = fileRef("scene.png", 4096, 1700000000000);

    expect(getMediaFingerprint(file)).toBe("scene.png\u00004096\u00001700000000000");
    expect(getMediaFingerprint({ ...file })).toBe(getMediaFingerprint(file));
  });

  it("rejects two identical files selected in the same batch", () => {
    const registry = createMediaFingerprintRegistry();
    const first = fileRef("same.mp4", 2048, 1710000000000);
    const second = fileRef("same.mp4", 2048, 1710000000000);

    expect(registry.reserve(first)).toBe(true);
    // The second reservation happens before any async import work, so React
    // state does not need to have updated yet.
    expect(registry.reserve(second)).toBe(false);
  });

  it("allows genuinely different files in the same batch", () => {
    const registry = createMediaFingerprintRegistry();

    expect(registry.reserve(fileRef("a.png", 100, 1))).toBe(true);
    expect(registry.reserve(fileRef("b.png", 100, 1))).toBe(true);
    expect(registry.reserve(fileRef("a.png", 101, 1))).toBe(true);
    expect(registry.reserve(fileRef("a.png", 100, 2))).toBe(true);
  });

  it("seeds duplicates from the existing media library", () => {
    const registry = createMediaFingerprintRegistry([fileRef("existing.png", 500, 99)]);

    expect(registry.reserve(fileRef("existing.png", 500, 99))).toBe(false);
    expect(registry.reserve(fileRef("new.png", 500, 99))).toBe(true);
  });

  it("releases a reservation when the import fails so a later copy can retry", () => {
    const registry = createMediaFingerprintRegistry();
    const file = fileRef("retry.png", 123, 456);

    expect(registry.reserve(file)).toBe(true);
    registry.release(file);
    expect(registry.reserve(file)).toBe(true);
  });

  it("keeps sequential imports consistent with the batch rule", () => {
    const existing = createMediaFingerprintRegistry([
      fileRef("already-imported.png", 123, 456),
    ]);

    expect(existing.reserve(fileRef("already-imported.png", 123, 456))).toBe(false);
  });
});
