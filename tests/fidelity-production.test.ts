/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { Typography } from "@tiptap/extension-typography";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Wikilink } from "@/services/editor/extensions/wikilink";
import { CodeHighlight } from "@/services/editor/extensions/code-highlight";
import { SlashMenuExtension } from "@/services/editor/extensions/slash-menu";

const editors: Editor[] = [];

function makeProductionEditor() {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeHighlight,
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({
        indentation: { style: "space", size: 2 },
      }),
      Placeholder.configure({
        placeholder: "Type / for commands...",
        emptyEditorClass: "is-editor-empty",
      }),
      Wikilink,
      SlashMenuExtension,
    ],
    content: "",
    editable: true,
  });
  editors.push(editor);
  return editor;
}

function roundTrip(markdown: string) {
  const editor = makeProductionEditor();
  editor.commands.setContent(markdown, { contentType: "markdown" });
  return editor.getMarkdown();
}

function jsonFor(markdown: string) {
  const editor = makeProductionEditor();
  editor.commands.setContent(markdown, { contentType: "markdown" });
  return editor.getJSON();
}

afterEach(() => {
  for (const editor of editors.splice(0)) {
    editor.destroy();
    editor.options.element.remove();
  }
});

describe("production editor markdown fidelity", () => {
  it("keeps FullMark custom markdown idempotent after the canonical pass", () => {
    const markdown = [
      "# Daily note",
      "",
      "Intro with [[Project Atlas|Atlas]] and `inline code`.",
      "",
      "- [ ] Ship stability tests",
      "  - [x] Preserve nested task state",
      "",
      "```ts",
      "const status = \"stable\";",
      "```",
      "",
      "> Quote with **strong** and _emphasis_.",
      "",
    ].join("\n");

    const firstPass = roundTrip(markdown);
    const secondPass = roundTrip(firstPass);

    expect(firstPass).toContain("[[Project Atlas|Atlas]]");
    expect(firstPass).toContain("- [ ] Ship stability tests");
    expect(firstPass).toContain("  - [x] Preserve nested task state");
    expect(firstPass).toContain("```ts");
    expect(secondPass).toBe(firstPass);
    expect(jsonFor(secondPass)).toEqual(jsonFor(firstPass));
  });

  it("does not serialize wikilinks as plain bracket text", () => {
    const markdown = "See [[Roadmap]] and [[Project Atlas|Atlas]].";
    const output = roundTrip(markdown);

    expect(output).toBe(markdown);
    expect(output).not.toContain("\\[\\[");
  });
});
