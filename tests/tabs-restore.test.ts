import { beforeEach, describe, expect, it, vi } from "vitest";

const fsBridge = vi.hoisted(() => ({
  readTextFile: vi.fn(),
  atomicWrite: vi.fn(),
}));

vi.mock("@/services/fs-bridge", () => fsBridge);

import { useTabsStore } from "../src/stores/tabs";

describe("tab session restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTabsStore.setState(useTabsStore.getInitialState(), true);
    fsBridge.readTextFile.mockImplementation((path: string) =>
      Promise.resolve({
        canonicalPath: path,
        content: `# ${path}`,
        modifiedMs: 1,
      }),
    );
  });

  it("reopens persisted tab paths from disk and restores the active tab", async () => {
    useTabsStore.setState({
      restoredPaths: ["/vault/a.md", "/vault/b.md"],
      activePath: "/vault/a.md",
      hasRestoredSession: false,
      restoringTabs: false,
    });

    await useTabsStore.getState().restoreSession();

    expect(fsBridge.readTextFile).toHaveBeenCalledTimes(2);
    expect(useTabsStore.getState().tabs.map((tab) => tab.path)).toEqual([
      "/vault/a.md",
      "/vault/b.md",
    ]);
    expect(useTabsStore.getState().activePath).toBe("/vault/a.md");
    expect(useTabsStore.getState().tabs.every((tab) => !tab.dirty)).toBe(true);
  });
});
