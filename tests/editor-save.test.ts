import { beforeEach, describe, expect, it, vi } from "vitest";

const fsBridge = vi.hoisted(() => ({
  readTextFile: vi.fn(),
  atomicWrite: vi.fn(),
}));

vi.mock("@/services/fs-bridge", () => fsBridge);

import { useTabsStore } from "../src/stores/tabs";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("editor save snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTabsStore.setState({ tabs: [], activePath: null });
    fsBridge.readTextFile.mockResolvedValue({
      canonicalPath: "/tmp/note.md",
      content: "saved",
      modifiedMs: 1,
    });
  });

  it("writes the registered editor snapshot instead of stale tab content", async () => {
    const path = await useTabsStore.getState().openFile("/tmp/note.md");
    const unregister = useTabsStore
      .getState()
      .registerSnapshotProvider(path, () => ({
        content: "rendered edit",
        revision: 1,
      }));

    useTabsStore.getState().markEditorChanged(path, 1);
    await useTabsStore.getState().save(path);

    expect(fsBridge.atomicWrite).toHaveBeenCalledWith(path, "rendered edit");
    expect(useTabsStore.getState().tabs[0]).toMatchObject({
      baseContent: "rendered edit",
      content: "rendered edit",
      revision: 1,
      savedRevision: 1,
      dirty: false,
    });

    unregister();
  });

  it("keeps a tab dirty when edits happen during an in-flight save", async () => {
    const path = await useTabsStore.getState().openFile("/tmp/note.md");
    const write = deferred<string>();
    fsBridge.atomicWrite.mockReturnValue(write.promise);

    let snapshot = { content: "first edit", revision: 1 };
    const unregister = useTabsStore
      .getState()
      .registerSnapshotProvider(path, () => snapshot);

    useTabsStore.getState().markEditorChanged(path, 1);
    const savePromise = useTabsStore.getState().save(path);
    expect(fsBridge.atomicWrite).toHaveBeenCalledWith(path, "first edit");

    snapshot = { content: "second edit", revision: 2 };
    useTabsStore.getState().markEditorChanged(path, 2);

    write.resolve(path);
    await savePromise;

    expect(useTabsStore.getState().tabs[0]).toMatchObject({
      baseContent: "first edit",
      revision: 2,
      savedRevision: 1,
      dirty: true,
    });

    unregister();
  });

  it("clears dirty without writing when the save snapshot matches disk", async () => {
    const path = await useTabsStore.getState().openFile("/tmp/note.md");
    useTabsStore.getState().markEditorChanged(path, 1);
    useTabsStore.getState().syncEditorSnapshot(path, {
      content: "saved",
      revision: 1,
    });

    await useTabsStore.getState().save(path);

    expect(fsBridge.atomicWrite).not.toHaveBeenCalled();
    expect(useTabsStore.getState().tabs[0]).toMatchObject({
      content: "saved",
      revision: 1,
      savedRevision: 1,
      dirty: false,
    });
  });
});
