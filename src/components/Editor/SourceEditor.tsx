/**
 * Raw markdown source view — a monospace textarea bound directly to the
 * active tab's content. Edits flow through `updateContent` like the block
 * editor does, so dirty state + autosave keep working.
 *
 * No syntax highlighting in v0.1 — just the bytes, monospaced. Upgrade to
 * CodeMirror or Shiki-decorated textarea if we end up wanting it later.
 */

import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (next: string) => void;
}

export function SourceEditor({ value, onChange }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Autofocus on mount so the user can start editing immediately after flipping.
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="source-editor">
      <textarea
        ref={ref}
        className="source-editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="soft"
        aria-label="Markdown source"
      />
    </div>
  );
}
