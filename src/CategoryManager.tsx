import { useState } from "react";
import {
  Check,
  CircleAlert,
  LoaderCircle,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { BudgetCategory, CategoryCatalog } from "./types";
import { prepareCategorySave } from "./categoryDraft";

export default function CategoryManager({
  catalog,
  supported,
  busy,
  error,
  onClose,
  onSave,
}: {
  catalog: CategoryCatalog;
  supported: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (catalog: CategoryCatalog) => void;
}) {
  // Keep the original revision even if a conflict refreshes the page behind this dialog.
  const [revision] = useState(catalog.revision);
  const [entries, setEntries] = useState(() =>
    catalog.entries.map((c) => ({ ...c })),
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState("#34b4a4");
  const [localError, setLocalError] = useState("");
  const active = entries.filter((c) => c.active),
    removed = entries.filter((c) => !c.active);
  function update(id: string, patch: Partial<BudgetCategory>) {
    setEntries((previous) =>
      previous.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
    setLocalError("");
  }
  function add() {
    if (!name.trim()) return;
    try {
      setEntries(prepareCategorySave(entries, name, color));
      setName("");
      setLocalError("");
    } catch (e) {
      setLocalError(
        e instanceof Error ? e.message : "Check your category names.",
      );
    }
  }
  return (
    <form
      className="category-manager"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || !supported) return;
        try {
          const next = prepareCategorySave(entries, name, color);
          // Retain the same IDs if the request fails and the user retries.
          setEntries(next);
          setName("");
          setLocalError("");
          onSave({ revision, entries: next });
        } catch (e) {
          setLocalError(
            e instanceof Error ? e.message : "Check your category names.",
          );
        }
      }}
    >
      <div className="category-manager-body">
        <div className="category-manager-note">
          Build a budget that fits your life. Removing a category keeps its
          transactions and past budgets safe. You can restore it anytime.
        </div>
        <div className="category-add-section">
          <label htmlFor="new-category-name">New category</label>
          <div className="category-editor-row">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="New category color"
              disabled={busy}
            />
            <input
              id="new-category-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setLocalError("");
              }}
              maxLength={40}
              placeholder="e.g. Travel, Health, Education"
              disabled={busy || entries.length >= 200}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <button
              type="button"
              className="secondary-button"
              onClick={add}
              disabled={busy || !name.trim() || entries.length >= 200}
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>
        <div className="category-editor-list">
          {active.map((c, index) => (
            <div className="category-editor-row" key={c.id}>
              <input
                type="color"
                value={c.color}
                onChange={(e) => update(c.id, { color: e.target.value })}
                aria-label={`Color for ${c.label || `category ${index + 1}`}`}
                disabled={busy}
              />
              <label className="sr-only" htmlFor={`category-${c.id}`}>
                Category {index + 1} name
              </label>
              <input
                id={`category-${c.id}`}
                value={c.label}
                onChange={(e) => update(c.id, { label: e.target.value })}
                maxLength={40}
                required
                disabled={busy}
              />
              <button
                type="button"
                className="icon-button delete-action"
                aria-label={`Remove ${c.label}`}
                title={`Remove ${c.label}`}
                onClick={() => update(c.id, { active: false })}
                disabled={busy}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
          {!active.length && (
            <p className="muted-text">
              No active categories. Add one above or restore a removed category.
            </p>
          )}
        </div>
        {removed.length > 0 && (
          <details className="removed-categories">
            <summary>Removed categories ({removed.length})</summary>
            {removed.map((c) => (
              <div className="removed-category-row" key={c.id}>
                <span>
                  <i style={{ background: c.color }} />
                  {c.label}
                </span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => update(c.id, { active: true })}
                  disabled={busy}
                >
                  <RotateCcw size={14} />
                  Restore {c.label}
                </button>
              </div>
            ))}
          </details>
        )}
      </div>
      {(!supported || localError || error) && (
        <p className="form-error category-save-error" role="alert">
          <CircleAlert size={17} />
          {!supported
            ? "The running backend needs an update. Rerun Hisabo Backend in IntelliJ, then refresh this page to save categories."
            : localError || error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button className="primary-button" disabled={busy || !supported}>
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Check size={17} />
          )}
          Save categories
        </button>
      </div>
    </form>
  );
}
