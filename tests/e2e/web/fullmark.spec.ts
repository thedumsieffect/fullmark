import { expect, test, type Page } from "@playwright/test";

type WorkspaceEntry = {
  name: string;
  path: string;
  isDir: boolean;
  parent: number | null;
};

const ROOT = "/e2e-vault";

async function pressAppShortcut(page: Page, key: string, shiftKey = false) {
  await page.locator("body").dispatchEvent("keydown", {
    key,
    ctrlKey: true,
    metaKey: false,
    shiftKey,
    altKey: false,
    bubbles: true,
    cancelable: true,
  });
}

function makeEntries(extraFiles = 0): WorkspaceEntry[] {
  const entries: WorkspaceEntry[] = [
    { name: "e2e-vault", path: ROOT, isDir: true, parent: null },
    { name: "Inbox", path: `${ROOT}/Inbox`, isDir: true, parent: 0 },
    { name: "Projects", path: `${ROOT}/Projects`, isDir: true, parent: 0 },
    {
      name: "Daily Note.md",
      path: `${ROOT}/Inbox/Daily Note.md`,
      isDir: false,
      parent: 1,
    },
    {
      name: "Project Plan.mdx",
      path: `${ROOT}/Projects/Project Plan.mdx`,
      isDir: false,
      parent: 2,
    },
    {
      name: "README.markdown",
      path: `${ROOT}/README.markdown`,
      isDir: false,
      parent: 0,
    },
  ];

  for (let idx = 0; idx < extraFiles; idx++) {
    entries.push({
      name: `Generated ${String(idx).padStart(4, "0")}.md`,
      path: `${ROOT}/Projects/Generated ${String(idx).padStart(4, "0")}.md`,
      isDir: false,
      parent: 2,
    });
  }

  return entries;
}

function makeFiles(extraFiles = 0): Record<string, string> {
  const files: Record<string, string> = {
    [`${ROOT}/Inbox/Daily Note.md`]: [
      "# Daily Note",
      "",
      "Today links to [[Project Plan]].",
      "",
      "External link: [Example](https://example.com).",
      "",
      "- [ ] Keep editing fast",
      "",
    ].join("\n"),
    [`${ROOT}/Projects/Project Plan.mdx`]: [
      "# Project Plan",
      "",
      "A plan with `inline code` and a task.",
      "",
      "- [x] Build test harness",
      "",
    ].join("\n"),
    [`${ROOT}/README.markdown`]: "# Readme\n\nGenerated workspace root note.\n",
  };

  for (let idx = 0; idx < extraFiles; idx++) {
    files[`${ROOT}/Projects/Generated ${String(idx).padStart(4, "0")}.md`] =
      `# Generated ${idx}\n\nSynthetic file for quick switcher coverage.\n`;
  }

  return files;
}

async function installTauriMock(page: Page, extraFiles = 0) {
  await page.addInitScript(
    ({ entries, files, root }) => {
      type Callback = (payload: unknown) => void;
      const callbackMap = new Map<number, Callback>();
      const listenerMap = new Map<
        number,
        { event: string; callbackId: number }
      >();
      let nextCallbackId = 1;
      let nextEventId = 1;
      const mutableFiles = { ...files };
      const writes: Array<{ path: string; content: string }> = [];
      const openedUrls: string[] = [];

      window.__FULLMARK_E2E__ = {
        root,
        writes,
        openedUrls,
        files: mutableFiles,
        emit(event: string, payload: unknown) {
          for (const [id, listener] of listenerMap) {
            if (listener.event !== event) continue;
            callbackMap.get(listener.callbackId)?.({ event, id, payload });
          }
        },
      };

      window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
        unregisterListener(_event: string, id: number) {
          listenerMap.delete(id);
        },
      };

      window.__TAURI_INTERNALS__ = {
        transformCallback(callback: Callback, once = false) {
          const id = nextCallbackId++;
          callbackMap.set(id, (payload: unknown) => {
            callback(payload);
            if (once) callbackMap.delete(id);
          });
          return id;
        },
        unregisterCallback(id: number) {
          callbackMap.delete(id);
        },
        convertFileSrc(path: string) {
          return path;
        },
        async invoke(command: string, args?: Record<string, unknown>) {
          if (command === "plugin:dialog|open") return root;
          if (command === "plugin:event|listen") {
            const eventId = nextEventId++;
            listenerMap.set(eventId, {
              event: String(args?.event),
              callbackId: Number(args?.handler),
            });
            return eventId;
          }
          if (command === "plugin:event|unlisten") {
            listenerMap.delete(Number(args?.eventId));
            return null;
          }
          if (command === "plugin:opener|open_url") {
            openedUrls.push(String(args?.url));
            return null;
          }
          if (command === "walk_workspace") return entries;
          if (command === "read_text_file") {
            const path = String(args?.path);
            return {
              content: mutableFiles[path] ?? "",
              canonicalPath: path,
              modifiedMs: 1,
            };
          }
          if (command === "atomic_write_text") {
            const path = String(args?.path);
            const content = String(args?.content);
            mutableFiles[path] = content;
            writes.push({ path, content });
            return path;
          }
          if (command === "is_default_markdown_handler") return false;
          if (command === "get_default_markdown_handler") return null;
          if (command === "set_default_markdown_handler") return null;
          throw new Error(`Unhandled Tauri command in E2E mock: ${command}`);
        },
      };
    },
    {
      entries: makeEntries(extraFiles),
      files: makeFiles(extraFiles),
      root: ROOT,
    },
  );
}

async function openWorkspace(page: Page, extraFiles = 0) {
  await installTauriMock(page, extraFiles);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "FullMark" })).toBeVisible();
  await page.getByRole("button", { name: "Open folder…" }).click();
  await expect(page.getByText("e2e-vault")).toBeVisible();
}

async function bootWithPersistedSession(page: Page) {
  await installTauriMock(page);
  await page.addInitScript(
    ({ root }) => {
      localStorage.setItem(
        "fullmark.workspace",
        JSON.stringify({
          state: { root, recent: [root] },
          version: 0,
        }),
      );
      localStorage.setItem(
        "fullmark.tabs",
        JSON.stringify({
          state: {
            restoredPaths: [
              `${root}/Inbox/Daily Note.md`,
              `${root}/Projects/Project Plan.mdx`,
            ],
            activePath: `${root}/Projects/Project Plan.mdx`,
          },
          version: 1,
        }),
      );
    },
    { root: ROOT },
  );
  await page.goto("/");
}

test("opens a mocked workspace and filters the markdown tree", async ({
  page,
}) => {
  await openWorkspace(page);

  await expect(page.getByRole("tree")).toBeVisible();
  await expect(
    page.getByRole("treeitem", { name: "Daily Note" }),
  ).toBeVisible();
  await expect(
    page.getByRole("treeitem", { name: "Project Plan" }),
  ).toBeVisible();
  await expect(page.getByText("asset")).toHaveCount(0);
});

test("opens, edits, and saves latest source content", async ({ page }) => {
  await openWorkspace(page);

  await page.getByRole("treeitem", { name: "Daily Note" }).click();
  await expect(page.getByRole("tab", { name: "Daily Note" })).toBeVisible();

  await page.locator('button[title^="Source view"]').click();
  const source = page.getByLabel("Markdown source");
  await expect(source).toBeVisible();
  await source.fill("# Daily Note\n\nChanged in headless E2E.\n");
  await expect(page.getByText("Unsaved")).toBeVisible();

  await pressAppShortcut(page, "s");
  await expect
    .poll(() => page.evaluate(() => window.__FULLMARK_E2E__.writes.length))
    .toBe(1);
  await expect(page.getByText("Saved")).toBeVisible();

  const writes = await page.evaluate(() => window.__FULLMARK_E2E__.writes);
  expect(writes).toEqual([
    {
      path: `${ROOT}/Inbox/Daily Note.md`,
      content: "# Daily Note\n\nChanged in headless E2E.\n",
    },
  ]);
});

test("quick switcher navigates a large indexed workspace and reader mode toggles", async ({
  page,
}) => {
  await openWorkspace(page, 250);

  await pressAppShortcut(page, "k");
  await expect(
    page.getByRole("dialog", { name: "Search files" }),
  ).toBeVisible();
  await page.getByPlaceholder("Search files…").fill("generated 0249");
  await expect(
    page.getByRole("option", { name: /Generated 0249/ }),
  ).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("tab", { name: "Generated 0249" })).toBeVisible();
  await pressAppShortcut(page, "r");
  await expect(page.locator(".app-title-mode")).toHaveText(/Reader/);
});

test("cmd-click opens wikilink targets from the current workspace", async ({
  page,
}) => {
  await openWorkspace(page);

  await page.getByRole("treeitem", { name: "Daily Note" }).click();
  await expect(page.getByRole("tab", { name: "Daily Note" })).toBeVisible();

  const wikilink = page.locator("[data-wikilink='Project Plan']");
  await expect(wikilink).toBeVisible();
  await expect(wikilink).toHaveCSS("cursor", "pointer");
  await wikilink.dispatchEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    metaKey: true,
  });

  await expect(page.getByRole("tab", { name: "Project Plan" })).toBeVisible();
});

test("cmd-click opens markdown URL links in the system browser", async ({
  page,
}) => {
  await openWorkspace(page);

  await page.getByRole("treeitem", { name: "Daily Note" }).click();
  await expect(page.getByRole("tab", { name: "Daily Note" })).toBeVisible();

  const link = page.getByRole("link", { name: "Example" });
  await expect(link).toBeVisible();
  await expect(link).toHaveCSS("cursor", "pointer");
  await link.dispatchEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    metaKey: true,
  });

  await expect
    .poll(() => page.evaluate(() => window.__FULLMARK_E2E__.openedUrls))
    .toEqual(["https://example.com/"]);
});

test("restores open tabs and active file after app restart", async ({
  page,
}) => {
  await bootWithPersistedSession(page);

  await expect(
    page.getByRole("treeitem", { name: "Daily Note" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Daily Note" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Project Plan" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Project Plan" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    page.getByRole("heading", { name: "Project Plan" }),
  ).toBeVisible();
});
