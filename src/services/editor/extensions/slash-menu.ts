/**
 * Slash command extension — `/` opens a floating menu of block-insert commands.
 *
 * Built on @tiptap/suggestion. The Suggestion plugin handles trigger detection,
 * filtering query text, and lifecycle events. We render the React popover via
 * ReactRenderer and position it via fixed CSS based on the cursor rect the
 * suggestion plugin reports.
 *
 * Commands list lives in this file so adding a new block-insert is a one-line
 * change.
 */

import { Extension, type Editor, type Range } from "@tiptap/core";
import { Suggestion, type SuggestionProps } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import {
  computePosition,
  autoUpdate,
  offset,
  flip,
  shift,
  type VirtualElement,
} from "@floating-ui/dom";
import {
  SlashMenu,
  type SlashItem,
  type SlashMenuHandle,
} from "@/components/Editor/SlashMenu";

const ALL_ITEMS: SlashItem[] = [
  {
    title: "Heading 1",
    description: "Big section heading",
    shortcut: "# ",
    cmd: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    shortcut: "## ",
    cmd: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    shortcut: "### ",
    cmd: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Paragraph",
    description: "Plain text",
    cmd: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("paragraph").run(),
  },
  {
    title: "Bulleted list",
    description: "Unordered list",
    shortcut: "- ",
    cmd: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    description: "Ordered list",
    shortcut: "1. ",
    cmd: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Task list",
    description: "Checklist",
    shortcut: "- [ ]",
    cmd: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Quote",
    description: "Indented block quote",
    shortcut: "> ",
    cmd: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    description: "Auto-detect language",
    shortcut: "```",
    cmd: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setCodeBlock().run(),
  },
  {
    title: "Code · JavaScript",
    description: "JS, with highlighting",
    cmd: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setCodeBlock({ language: "javascript" })
        .run(),
  },
  {
    title: "Code · TypeScript",
    description: "TS, with highlighting",
    cmd: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setCodeBlock({ language: "typescript" })
        .run(),
  },
  {
    title: "Code · Python",
    description: "Python, with highlighting",
    cmd: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setCodeBlock({ language: "python" })
        .run(),
  },
  {
    title: "Code · Bash",
    description: "Shell script, with highlighting",
    cmd: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setCodeBlock({ language: "bash" })
        .run(),
  },
  {
    title: "Code · JSON",
    description: "JSON, with highlighting",
    cmd: ({ editor, range }) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setCodeBlock({ language: "json" })
        .run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    shortcut: "---",
    cmd: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

function filterItems(query: string): SlashItem[] {
  if (!query) return ALL_ITEMS;
  const q = query.toLowerCase();
  return ALL_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q),
  ).slice(0, 10);
}

export const SlashMenuExtension = Extension.create({
  name: "slashMenu",

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      Suggestion({
        editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashItem }) => {
          props.cmd({ editor, range });
        },
        items: ({ query }: { query: string }) => filterItems(query),
        render: () => {
          let component: ReactRenderer<SlashMenuHandle> | null = null;
          let container: HTMLDivElement | null = null;
          let cleanupAutoUpdate: (() => void) | null = null;
          let currentClientRect: (() => DOMRect | null) | null = null;

          // Virtual reference element — always returns the latest cursor rect.
          const virtualRef: VirtualElement = {
            getBoundingClientRect: () => {
              const rect = currentClientRect?.();
              // Fallback to a 1×1 rect at the top-left if no rect yet; floating-ui
              // will still position relative to it and we update on next tick.
              return (
                rect ??
                ({
                  x: 0,
                  y: 0,
                  top: 0,
                  left: 0,
                  bottom: 0,
                  right: 0,
                  width: 0,
                  height: 0,
                  toJSON() {},
                } as DOMRect)
              );
            },
          };

          const reposition = () => {
            if (!container) return;
            void computePosition(virtualRef, container, {
              placement: "bottom-start",
              middleware: [
                offset(6),
                flip({ padding: 8 }),
                shift({ padding: 8 }),
              ],
            }).then(({ x, y }) => {
              if (!container) return;
              container.style.position = "fixed";
              container.style.left = `${x}px`;
              container.style.top = `${y}px`;
            });
          };

          return {
            onStart: (props: SuggestionProps<SlashItem, SlashItem>) => {
              component = new ReactRenderer(SlashMenu, {
                props: {
                  items: props.items,
                  command: (item: SlashItem) => props.command(item),
                },
                editor: props.editor,
              });
              container = document.createElement("div");
              container.className = "slash-menu-portal";
              container.style.zIndex = "9999";
              container.appendChild(component.element);
              document.body.appendChild(container);

              currentClientRect = props.clientRect ?? null;
              cleanupAutoUpdate = autoUpdate(virtualRef, container, reposition);
            },
            onUpdate: (props: SuggestionProps<SlashItem, SlashItem>) => {
              component?.updateProps({
                items: props.items,
                command: (item: SlashItem) => props.command(item),
              });
              currentClientRect = props.clientRect ?? currentClientRect;
              reposition();
            },
            onKeyDown: ({ event }: { event: KeyboardEvent }) => {
              if (event.key === "Escape") {
                cleanupAutoUpdate?.();
                cleanupAutoUpdate = null;
                container?.remove();
                container = null;
                return true;
              }
              return component?.ref?.onKeyDown({ event }) ?? false;
            },
            onExit: () => {
              cleanupAutoUpdate?.();
              cleanupAutoUpdate = null;
              component?.destroy();
              container?.remove();
              component = null;
              container = null;
              currentClientRect = null;
            },
          };
        },
      }),
    ];
  },
});
