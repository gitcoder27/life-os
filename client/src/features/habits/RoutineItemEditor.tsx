import { useRef, useEffect, type KeyboardEvent } from "react";

export interface RoutineItemEntry {
  key: string;
  id?: string;
  title: string;
  isRequired: boolean;
}

let nextKey = 1;
export function makeItemKey() {
  return `new-${nextKey++}`;
}

export function createEmptyItem(): RoutineItemEntry {
  return { key: makeItemKey(), title: "", isRequired: true };
}

interface RoutineItemEditorProps {
  items: RoutineItemEntry[];
  onChange: (items: RoutineItemEntry[]) => void;
}

export function RoutineItemEditor({ items, onChange }: RoutineItemEditorProps) {
  const rowRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const focusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusKeyRef.current) {
      const input = rowRefs.current.get(focusKeyRef.current);
      if (input) {
        input.focus();
      }
      focusKeyRef.current = null;
    }
  });

  function updateItem(key: string, patch: Partial<RoutineItemEntry>) {
    onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  function removeItem(key: string) {
    if (items.length <= 1) return;
    onChange(items.filter((item) => item.key !== key));
  }

  function moveItem(key: string, direction: -1 | 1) {
    const index = items.findIndex((item) => item.key === key);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange(next);
  }

  function addItem() {
    const newItem = createEmptyItem();
    focusKeyRef.current = newItem.key;
    onChange([...items, newItem]);
  }

  function handleKeyDown(e: KeyboardEvent, key: string, index: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      const newItem = createEmptyItem();
      focusKeyRef.current = newItem.key;
      const next = [...items];
      next.splice(index + 1, 0, newItem);
      onChange(next);
    } else if (e.key === "Backspace" && items.find((i) => i.key === key)?.title === "" && items.length > 1) {
      e.preventDefault();
      const prevKey = index > 0 ? items[index - 1].key : items.length > 1 ? items[1].key : null;
      if (prevKey) focusKeyRef.current = prevKey;
      removeItem(key);
    } else if (e.key === "ArrowUp" && e.altKey) {
      e.preventDefault();
      moveItem(key, -1);
    } else if (e.key === "ArrowDown" && e.altKey) {
      e.preventDefault();
      moveItem(key, 1);
    }
  }

  return (
    <div className="routine-item-editor">
      <div className="routine-item-editor__header">
        <span className="routine-item-editor__label">Checklist items</span>
        <span className="routine-item-editor__hint">{items.length} item{items.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="routine-item-editor__list">
        {items.map((item, index) => (
          <div key={item.key} className="routine-item-row">
            <div className="routine-item-row__reorder">
              <button
                type="button"
                className="routine-item-row__arrow"
                onClick={() => moveItem(item.key, -1)}
                disabled={index === 0}
                aria-label="Move up"
                tabIndex={-1}
              >
                &#x25B4;
              </button>
              <button
                type="button"
                className="routine-item-row__arrow"
                onClick={() => moveItem(item.key, 1)}
                disabled={index === items.length - 1}
                aria-label="Move down"
                tabIndex={-1}
              >
                &#x25BE;
              </button>
            </div>

            <span className="routine-item-row__index">{index + 1}</span>

            <input
              ref={(el) => {
                if (el) rowRefs.current.set(item.key, el);
                else rowRefs.current.delete(item.key);
              }}
              type="text"
              className="routine-item-row__input"
              placeholder={index === 0 ? "e.g. Drink water" : "Next step\u2026"}
              value={item.title}
              onChange={(e) => updateItem(item.key, { title: e.target.value })}
              onKeyDown={(e) => handleKeyDown(e, item.key, index)}
              maxLength={200}
            />

            <button
              type="button"
              className={`routine-item-row__required${item.isRequired ? " routine-item-row__required--on" : ""}`}
              onClick={() => updateItem(item.key, { isRequired: !item.isRequired })}
              title={item.isRequired ? "Required — click to make optional" : "Optional — click to make required"}
              tabIndex={-1}
            >
              {item.isRequired ? "Required" : "Optional"}
            </button>

            <button
              type="button"
              className="routine-item-row__delete"
              onClick={() => removeItem(item.key)}
              disabled={items.length <= 1}
              aria-label="Remove item"
              tabIndex={-1}
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="routine-item-editor__add"
        onClick={addItem}
      >
        <span className="routine-item-editor__add-icon">+</span>
        Add item
      </button>

      <p className="routine-item-editor__shortcuts">
        <kbd>Enter</kbd> new item &middot; <kbd>Alt+&uarr;&darr;</kbd> reorder &middot; <kbd>Backspace</kbd> on empty to remove
      </p>
    </div>
  );
}
