/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { walkWorkspace, type TreeNode } from "@/services/fs-bridge";
import { useWorkspaceStore } from "@/stores/workspace";

vi.mock("@/services/fs-bridge", () => ({
  walkWorkspace: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function tree(root: string, child: string): TreeNode {
  return {
    name: root.split("/").pop() || root,
    path: root,
    isDir: true,
    hasMarkdown: true,
    children: [{ name: child, path: `${root}/${child}`, isDir: false }],
  };
}

describe("workspace stale scan race", () => {
  const walkWorkspaceMock = vi.mocked(walkWorkspace);

  beforeEach(() => {
    localStorage.clear();
    walkWorkspaceMock.mockReset();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
  });

  it("does not let an older workspace scan replace the current workspace tree", async () => {
    const first = deferred<TreeNode>();
    const second = deferred<TreeNode>();
    walkWorkspaceMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const openFirst = useWorkspaceStore.getState().openWorkspace("/vault/old");
    const openSecond = useWorkspaceStore.getState().openWorkspace("/vault/new");

    second.resolve(tree("/vault/new", "current.md"));
    await openSecond;

    expect(useWorkspaceStore.getState()).toMatchObject({
      root: "/vault/new",
      tree: {
        path: "/vault/new",
        children: [{ name: "current.md" }],
      },
      loadingTree: false,
    });

    first.resolve(tree("/vault/old", "stale.md"));
    await openFirst;

    expect(useWorkspaceStore.getState()).toMatchObject({
      root: "/vault/new",
      tree: {
        path: "/vault/new",
        children: [{ name: "current.md" }],
      },
      loadingTree: false,
    });
  });
});
