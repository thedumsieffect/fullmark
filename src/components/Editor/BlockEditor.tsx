import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { createEditorExtensions } from "@/services/editor/extensions";
import { isOpenableExternalUrl } from "@/services/external-links";

export type EditorMarkdownSnapshot = {
  markdown: string;
  revision: number;
};

export interface BlockEditorProps {
  /** Initial markdown content. Only read on mount — pass a `key` to remount on file switch. */
  initialMarkdown: string;
  initialRevision: number;
  onEdit?: (revision: number) => void;
  onSnapshot?: (snapshot: EditorMarkdownSnapshot) => void;
  onOpenLink?: (target: string) => void;
  onOpenUrl?: (url: string) => void;
  registerSnapshotProvider?: (
    provider: () => EditorMarkdownSnapshot,
  ) => () => void;
  placeholder?: string;
  editable?: boolean;
}

export function BlockEditor({
  initialMarkdown,
  initialRevision,
  onEdit,
  onSnapshot,
  onOpenLink,
  onOpenUrl,
  registerSnapshotProvider,
  placeholder = "Type / for commands…",
  editable = true,
}: BlockEditorProps) {
  const revisionRef = useRef(initialRevision);
  const extensions = useMemo(
    () => createEditorExtensions({ placeholder }),
    [placeholder],
  );

  useEffect(() => {
    revisionRef.current = Math.max(revisionRef.current, initialRevision);
  }, [initialRevision]);

  const editor = useEditor({
    extensions,
    content: initialMarkdown,
    contentType: "markdown",
    editorProps: {
      attributes: { class: "tiptap" },
      handleDOMEvents: {
        click: (_view, event) => {
          if (!event.metaKey && !event.ctrlKey) return false;
          const target = event.target;
          if (!(target instanceof Element)) return false;

          const wikilink = target.closest<HTMLElement>("[data-wikilink]");
          if (wikilink) {
            const linkTarget = wikilink.dataset.wikilink;
            if (!linkTarget) return false;

            event.preventDefault();
            onOpenLink?.(linkTarget);
            return true;
          }

          const anchor = target.closest<HTMLAnchorElement>("a[href]");
          const href = anchor?.href;
          if (!href || !isOpenableExternalUrl(href)) return false;

          event.preventDefault();
          onOpenUrl?.(href);
          return true;
        },
      },
    },
    onUpdate: () => {
      revisionRef.current += 1;
      onEdit?.(revisionRef.current);
    },
    editable,
    immediatelyRender: false,
  });

  useLayoutEffect(() => {
    if (!editor) return;
    const getSnapshot = () => ({
      markdown: editor.getMarkdown(),
      revision: revisionRef.current,
    });
    const unregister = registerSnapshotProvider?.(getSnapshot);
    return () => {
      onSnapshot?.(getSnapshot());
      unregister?.();
    };
  }, [editor, onSnapshot, registerSnapshotProvider]);

  // Sync editable prop into the live editor (so reader-mode toggle takes effect
  // without remounting the editor).
  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  return <EditorContent editor={editor} />;
}
