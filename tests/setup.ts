import { afterEach } from "vitest";

afterEach(() => {
  delete process.env.FULLMARK_KEEP_ARTIFACTS;
  delete process.env.FULLMARK_ARTIFACT_DIR;
});
