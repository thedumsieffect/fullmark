import { describe, expect, it } from "vitest";
import { buildTreeFromWorkspaceEntries } from "../src/services/fs-bridge";
import { buildWorkspaceFileIndex } from "../src/stores/workspace";
import { rankWorkspaceFiles } from "../src/components/CommandPalette/QuickSwitcher";
import { resolveWorkspaceLinkTarget } from "../src/services/link-targets";

describe("workspace tree and search indexing", () => {
  it("rebuilds nested tree data from flat workspace entries", () => {
    const tree = buildTreeFromWorkspaceEntries(
      [
        { name: "vault", path: "/vault", isDir: true, parent: null },
        { name: "Notes", path: "/vault/Notes", isDir: true, parent: 0 },
        {
          name: "Meeting.md",
          path: "/vault/Notes/Meeting.md",
          isDir: false,
          parent: 1,
        },
        {
          name: "README.md",
          path: "/vault/README.md",
          isDir: false,
          parent: 0,
        },
      ],
      "/vault",
    );

    expect(tree.children?.map((child) => child.name)).toEqual([
      "Notes",
      "README.md",
    ]);
    expect(tree.hasMarkdown).toBe(true);
    expect(tree.children?.[0].hasMarkdown).toBe(true);
  });

  it("builds a reusable flat file index for quick switching", () => {
    const tree = buildTreeFromWorkspaceEntries(
      [
        { name: "vault", path: "/vault", isDir: true, parent: null },
        { name: "Notes", path: "/vault/Notes", isDir: true, parent: 0 },
        {
          name: "Meeting.md",
          path: "/vault/Notes/Meeting.md",
          isDir: false,
          parent: 1,
        },
        {
          name: "Plan.mdx",
          path: "/vault/Projects/Plan.mdx",
          isDir: false,
          parent: 0,
        },
      ],
      "/vault",
    );

    const index = buildWorkspaceFileIndex(tree, "/vault");

    expect(index).toMatchObject([
      {
        label: "Meeting",
        relativePath: "Notes/Meeting.md",
        folder: "Notes",
        searchName: "meeting",
      },
      {
        label: "Plan",
        relativePath: "Projects/Plan.mdx",
        folder: "Projects",
        searchPath: "projects/plan.mdx",
      },
    ]);
    expect(rankWorkspaceFiles(index, "meet")[0].file.path).toBe(
      "/vault/Notes/Meeting.md",
    );
    expect(rankWorkspaceFiles(index, "proj")[0].file.path).toBe(
      "/vault/Projects/Plan.mdx",
    );
  });

  it("resolves wikilink targets from the workspace index", () => {
    const tree = buildTreeFromWorkspaceEntries(
      [
        { name: "vault", path: "/vault", isDir: true, parent: null },
        { name: "Notes", path: "/vault/Notes", isDir: true, parent: 0 },
        {
          name: "Meeting.md",
          path: "/vault/Notes/Meeting.md",
          isDir: false,
          parent: 1,
        },
        {
          name: "Project Plan.mdx",
          path: "/vault/Projects/Project Plan.mdx",
          isDir: false,
          parent: 0,
        },
      ],
      "/vault",
    );

    const index = buildWorkspaceFileIndex(tree, "/vault");

    expect(resolveWorkspaceLinkTarget(index, "Project Plan")?.path).toBe(
      "/vault/Projects/Project Plan.mdx",
    );
    expect(resolveWorkspaceLinkTarget(index, "Notes/Meeting#agenda")?.path).toBe(
      "/vault/Notes/Meeting.md",
    );
    expect(resolveWorkspaceLinkTarget(index, "Missing")).toBeNull();
  });
});
