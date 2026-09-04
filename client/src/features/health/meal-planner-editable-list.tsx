import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";

export function EditableList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const addRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const value = draft.trim();
    if (!value) return;
    onChange([...items, value]);
    setDraft("");
    addRef.current?.focus();
  }

  function handleRemove(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  }

  function handleEditStart(index: number) {
    setEditingIndex(index);
    setEditValue(items[index]);
  }

  function handleEditSave(index: number) {
    const value = editValue.trim();
    if (!value) {
      handleRemove(index);
    } else {
      onChange(items.map((item, itemIndex) => (itemIndex === index ? value : item)));
    }
    setEditingIndex(null);
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleEditSave(index);
    } else if (event.key === "Escape") {
      setEditingIndex(null);
    }
  }

  return (
    <div className="rc-editable-list">
      {items.length > 0 && (
        <ul className="rc-editable-list__items">
          {items.map((item, index) => (
            <li key={index} className="rc-editable-list__item">
              <span className="rc-editable-list__num">{index + 1}</span>
              {editingIndex === index ? (
                <input
                  type="text"
                  className="rc-editable-list__edit-input"
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  onKeyDown={(event) => handleEditKeyDown(event, index)}
                  onBlur={() => handleEditSave(index)}
                  autoFocus
                />
              ) : (
                <span
                  className="rc-editable-list__text"
                  onClick={() => handleEditStart(index)}
                >
                  {item}
                </span>
              )}
              <button
                type="button"
                className="rc-editable-list__remove"
                onClick={() => handleRemove(index)}
                aria-label={`Remove item ${index + 1}`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="rc-editable-list__add">
        <input
          ref={addRef}
          type="text"
          className="rc-editable-list__add-input"
          placeholder={placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAdd();
            }
          }}
        />
        {draft.trim() && (
          <button
            type="button"
            className="rc-editable-list__add-btn"
            onClick={handleAdd}
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}
