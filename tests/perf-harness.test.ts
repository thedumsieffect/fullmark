import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const harness = await import("../scripts/generate-vault.mjs");

describe("generated vault harness", () => {
  it("exposes every required benchmark profile", () => {
    expect(harness.PROFILE_NAMES).toEqual([
      "small",
      "medium",
      "large",
      "chaos",
      "flat-50k",
      "deep-5k",
      "wide-dirs",
      "mixed-large",
      "unicode-paths",
    ]);
  });

  it("generates deterministic small vault manifests outside the repo by default", async () => {
    const first = await harness.createGeneratedVault({
      profile: "small",
      seed: "unit-seed",
    });
    const second = await harness.createGeneratedVault({
      profile: "small",
      seed: "unit-seed",
    });

    try {
      expect(first.root.startsWith(os.tmpdir())).toBe(true);
      expect(second.root.startsWith(os.tmpdir())).toBe(true);
      expect(first.manifest.markdownFileCount).toBe(32);
      expect(first.manifest.markdownFiles).toEqual(second.manifest.markdownFiles);
      expect(first.manifest.totalMarkdownBytes).toBe(second.manifest.totalMarkdownBytes);

      const samplePath = path.join(first.root, first.manifest.markdownFiles[0]);
      await expect(fs.readFile(samplePath, "utf8")).resolves.toContain("# ");
    } finally {
      await first.cleanup();
      await second.cleanup();
    }
  });

  it("covers unicode paths without losing manifest readability", async () => {
    const vault = await harness.createGeneratedVault({
      profile: "unicode-paths",
      seed: "unicode-unit-seed",
    });

    try {
      expect(vault.manifest.markdownFileCount).toBe(420);
      expect(vault.manifest.markdownFiles.some((file: string) => /[^\x00-\x7F]/.test(file))).toBe(
        true,
      );
      await expect(
        fs.readFile(path.join(vault.root, "fullmark-generated-manifest.json"), "utf8"),
      ).resolves.toContain("unicode-paths");
    } finally {
      await vault.cleanup();
    }
  });

  it("keeps generated vaults under .tmp when artifact retention is requested", async () => {
    process.env.FULLMARK_KEEP_ARTIFACTS = "1";
    const vault = await harness.createGeneratedVault({
      profile: "small",
      seed: "keep-artifacts-seed",
    });

    try {
      expect(vault.root).toContain(`${path.sep}.tmp${path.sep}generated-vaults${path.sep}small`);
      const stats = await fs.stat(vault.root);
      expect(stats.isDirectory()).toBe(true);
    } finally {
      await fs.rm(vault.root, { recursive: true, force: true });
    }
  });
});
