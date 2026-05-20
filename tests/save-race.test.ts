import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { atomicWrite } from "@/services/fs-bridge";
import { useTabsStore } from "@/stores/tabs";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

type PendingWrite = {
  path: string;
  content: string;
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("save race stability", () => {
  const invokeMock = vi.mocked(invoke);
  const writes: PendingWrite[] = [];

  beforeEach(() => {
    writes.length = 0;
    invokeMock.mockReset();
    invokeMock.mockImplementation((command, args) => {
      if (command === "read_text_file") {
        const path = String((args as { path: string }).path);
        return Promise.resolve({
          content: "base",
          canonicalPath: path,
          modifiedMs: 100,
        });
      }

      if (command === "atomic_write_text") {
        const pending = deferred<string>();
        const writeArgs = args as { path: string; content: string };
        writes.push({
          path: writeArgs.path,
          content: writeArgs.content,
          resolve: pending.resolve,
          reject: pending.reject,
        });
        return pending.promise;
      }

      return Promise.reject(new Error(`unexpected invoke command: ${command}`));
    });

    useTabsStore.setState(useTabsStore.getInitialState(), true);
  });

  it("serializes atomic writes to the same path", async () => {
    const first = atomicWrite("/notes/a.md", "one");
    const second = atomicWrite("/notes/a.md", "two");

    await flushMicrotasks();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ path: "/notes/a.md", content: "one" });

    writes[0].resolve("/notes/a.md");
    await first;
    await flushMicrotasks();

    expect(writes).toHaveLength(2);
    expect(writes[1]).toMatchObject({ path: "/notes/a.md", content: "two" });

    writes[1].resolve("/notes/a.md");
    await second;
  });

  it("keeps newer edits dirty when an older save finishes later", async () => {
    const path = await useTabsStore.getState().openFile("/notes/race.md");

    useTabsStore.getState().updateContent(path, "draft one");
    const save = useTabsStore.getState().save(path);

    await flushMicrotasks();
    expect(writes).toHaveLength(1);
    expect(writes[0].content).toBe("draft one");

    useTabsStore.getState().updateContent(path, "draft two");
    writes[0].resolve(path);
    await save;

    const tab = useTabsStore.getState().tabs.find((candidate) => {
      return candidate.path === path;
    });

    expect(tab).toMatchObject({
      content: "draft two",
      baseContent: "draft one",
      dirty: true,
    });
  });
});
