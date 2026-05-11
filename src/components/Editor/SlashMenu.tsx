/**
 * Slash command popover. Rendered as the children of the suggestion plugin's
 * portal; positioned by the extension. Exposes an imperative `onKeyDown` so
 * the suggestion plugin can route ArrowUp/Down/Enter through us.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Editor, Range } from "@tiptap/core";

export type SlashItem = {
  title: string;
  description: string;
  shortcut?: string;
  cmd: (ctx: { editor: Editor; range: Range }) => void;
};

interface Props {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

export type SlashMenuHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

export const SlashMenu = forwardRef<SlashMenuHandle, Props>(
  ({ items, command }, ref) => {
    const [selected, setSelected] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset selection when the filtered list changes
    useEffect(() => {
      setSelected(0);
    }, [items]);

    // Scroll selected into view
    useEffect(() => {
      const el = listRef.current?.children[selected] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelected((i) => (i - 1 + items.length) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((i) => (i + 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === "Enter") {
          const item = items[selected];
          if (item) command(item);
          return true;
        }
        if (event.key === "Escape") {
          // Let the suggestion plugin close itself; we just signal handled.
          return false;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="slash-menu">
          <div className="slash-empty">No matches</div>
        </div>
      );
    }

    return (
      <div className="slash-menu" ref={listRef}>
        {items.map((item, idx) => (
          <button
            key={item.title}
            type="button"
            className={`slash-item ${idx === selected ? "slash-item-selected" : ""}`}
            onMouseEnter={() => setSelected(idx)}
            onClick={() => command(item)}
          >
            <div className="slash-item-main">
              <div className="slash-item-title">{item.title}</div>
              <div className="slash-item-desc">{item.description}</div>
            </div>
            {item.shortcut && (
              <div className="slash-item-shortcut">{item.shortcut}</div>
            )}
          </button>
        ))}
      </div>
    );
  },
);

SlashMenu.displayName = "SlashMenu";
