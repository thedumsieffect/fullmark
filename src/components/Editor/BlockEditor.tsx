import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { Placeholder } from "@tiptap/extensions";
import { Typography } from "@tiptap/extension-typography";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Wikilink } from "@/services/editor/extensions/wikilink";
import { CodeHighlight } from "@/services/editor/extensions/code-highlight";
import { SlashMenuExtension } from "@/services/editor/extensions/slash-menu";

export interface BlockEditorProps {
  /** Initial markdown content. Only read on mount — pass a `key` to remount on file switch. */
  initialMarkdown: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function BlockEditor({
  initialMarkdown,
  onChange,
  placeholder = "Type / for commands…",
  editable = true,
}: BlockEditorProps) {
  const editor = useEditor({
    extensions: [
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
    ],
    content: initialMarkdown,
    contentType: "markdown",
    editorProps: {
      attributes: { class: "tiptap" },
    },
    onUpdate: ({ editor }) => {
      if (!onChange) return;
      onChange(editor.getMarkdown());
    },
    editable,
    immediatelyRender: false,
  });

  // Sync editable prop into the live editor (so reader-mode toggle takes effect
  // without remounting the editor).
  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  return <EditorContent editor={editor} />;
}
