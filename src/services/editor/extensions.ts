import type { Extensions } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { Typography } from "@tiptap/extension-typography";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Wikilink } from "@/services/editor/extensions/wikilink";
import { CodeHighlight } from "@/services/editor/extensions/code-highlight";
import { SlashMenuExtension } from "@/services/editor/extensions/slash-menu";

type EditorExtensionsOptions = {
  placeholder: string;
};

export function createEditorExtensions({
  placeholder,
}: EditorExtensionsOptions): Extensions {
  return [
    // Disable starter-kit's plain code block so we can supply the syntax-highlighted variant.
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
      placeholder,
      emptyEditorClass: "is-editor-empty",
    }),
    Wikilink,
    SlashMenuExtension,
  ];
}
