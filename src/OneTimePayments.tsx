import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { money, sum } from "./data";
import {
  modeledPaymentDate,
  nextPaymentDate,
  paymentDateBounds,
  shortDate,
} from "./mortgage";
import type { MortgageAnalysis } from "./mortgage";

type PaymentDraft = { id: string; date: string; amount: string };

function PaymentEditor({
  payment,
  editing,
  balanceDate,
  onClose,
  onSubmit,
}: {
  payment: PaymentDraft;
  editing: boolean;
  balanceDate: string;
  onClose: () => void;
  onSubmit: (payment: PaymentDraft) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(payment);
  const bounds = paymentDateBounds(balanceDate);
  const application = modeledPaymentDate(balanceDate, draft.date);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    dateInput.current?.focus();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="lump-sum-dialog"
      aria-labelledby="payment-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-heading">
        <div>
          <span className="overline">Extra principal</span>
          <h2 id="payment-dialog-title">
            {editing ? "Edit payment" : "Add one-time payment"}
          </h2>
          <p>
            Only include payments after your balance date that aren't already
            reflected in your outstanding balance.
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close payment editor"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(draft);
        }}
      >
        <div className="form-grid">
          <label className="field">
            <span>Payment date</span>
            <input
              ref={dateInput}
              type="date"
              required
              min={bounds.min}
              max={bounds.max}
              value={draft.date}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  date: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span>Amount (USD)</span>
            <input
              type="number"
              required
              min="0.01"
              max="100000000"
              step="0.01"
              placeholder="0.00"
              value={draft.amount}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  amount: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <p className="lump-sum-editor-note">
          <CalendarDays size={17} />
          <span>
            {application
              ? `Modeled on ${shortDate(application)}, after your regular payment.`
              : "Choose a date to see when this payment will be applied."}
          </span>
        </p>
        <p className="lump-sum-draft-hint">
          Use Save plan after closing this editor to keep your changes.
        </p>
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            {editing ? "Update payment" : "Add payment"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function OneTimePayments({
  payments,
  balanceDate,
  analysis,
  disabled,
  supported,
  canCalculate,
  canSave,
  dirty,
  revision,
  onChange,
}: {
  payments: PaymentDraft[];
  balanceDate: string;
  analysis: MortgageAnalysis | null;
  disabled: boolean;
  supported: boolean;
  canCalculate: boolean;
  canSave: boolean;
  dirty: boolean;
  revision: number;
  onChange: (payments: PaymentDraft[]) => void;
}) {
  const [editor, setEditor] = useState<{
    payment: PaymentDraft;
    editing: boolean;
  } | null>(null);
  const [removed, setRemoved] = useState<
    { payment: PaymentDraft; index: number }[]
  >([]);
  const addButton = useRef<HTMLButtonElement>(null);
  const paymentList = useRef<HTMLUListElement>(null);
  const editorTrigger = useRef<HTMLButtonElement | null>(null);
  const impact = analysis?.oneTimeImpact;
  const results = new Map(
    impact?.payments.map((payment) => [payment.id, payment]),
  );
  const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date));
  useLayoutEffect(() => {
    const list = paymentList.current;
    if (!list) return;
    if (payments.length <= 3) {
      list.style.removeProperty("--lump-sum-list-height");
      return;
    }
    const visibleRows = Array.from(list.children).slice(0, 3);
    function fitThreeRows() {
      const height = visibleRows.reduce(
        (total, row) => total + row.getBoundingClientRect().height,
        0,
      );
      list!.style.setProperty("--lump-sum-list-height", `${height}px`);
    }
    fitThreeRows();
    const observer = new ResizeObserver(fitThreeRows);
    visibleRows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [payments, analysis]);
  useEffect(() => {
    setRemoved([]);
  }, [revision]);
  function closeEditor() {
    setEditor(null);
    requestAnimationFrame(() =>
      editorTrigger.current?.focus({ preventScroll: true }),
    );
  }
  function remove(payment: PaymentDraft) {
    setRemoved((previous) => [
      ...previous,
      { payment, index: payments.findIndex((item) => item.id === payment.id) },
    ]);
    onChange(payments.filter((item) => item.id !== payment.id));
    addButton.current?.focus({ preventScroll: true });
  }
  function undo() {
    const last = removed.at(-1);
    if (!last) return;
    const restored = [...payments];
    restored.splice(last.index, 0, last.payment);
    onChange(restored);
    setRemoved((previous) => previous.slice(0, -1));
    addButton.current?.focus({ preventScroll: true });
  }
  return (
    <section
      id="mortgage-one-time"
      className="panel lump-sum-panel"
      aria-labelledby="one-time-title"
    >
      <header className="lump-sum-heading">
        <div>
          <h2 id="one-time-title">
            One-time payments{" "}
            <span
              className="lump-sum-count"
              aria-label={`${payments.length} payments`}
            >
              {payments.length}
            </span>
          </h2>
        </div>
        <button
          ref={addButton}
          type="button"
          className="secondary-button"
          disabled={disabled || !supported || payments.length >= 500}
          onClick={(event) => {
            editorTrigger.current = event.currentTarget;
            setEditor({
              editing: false,
              payment: {
                id: crypto.randomUUID(),
                date: nextPaymentDate(balanceDate),
                amount: "",
              },
            });
          }}
        >
          <Plus size={16} />
          Add payment
        </button>
      </header>
      {!supported && (
        <p className="form-error" role="alert">
          Restart the Java backend, then reload to enable dated payments and
          safely save this plan.
        </p>
      )}
      {payments.length > 0 ? (
        <>
          <div className="lump-sum-stats">
            <div>
              <span>Total entered</span>
              <strong>
                {money(
                  sum(payments.map((payment) => Number(payment.amount))),
                  2,
                )}
              </strong>
            </div>
            <div>
              <span>Extra interest saved</span>
              <strong>{impact ? money(impact.interestSaved, 2) : "—"}</strong>
            </div>
            <div>
              <span>Additional time saved</span>
              <strong>
                {impact ? (
                  <>
                    {impact.monthsSaved} <em>months</em>
                  </>
                ) : (
                  "—"
                )}
              </strong>
            </div>
          </div>
          <div className="lump-sum-columns" aria-hidden="true">
            <span>Payment date</span>
            <span>Amount</span>
            <span>Balance after</span>
            <span />
          </div>
          <ul
            ref={paymentList}
            className="lump-sum-list"
            aria-label={
              payments.length > 3
                ? "Lump-sum payments, scroll for more"
                : "Lump-sum payments"
            }
            tabIndex={payments.length > 3 ? 0 : undefined}
          >
            {sorted.map((payment) => {
              const result = results.get(payment.id);
              const application =
                result?.applicationDate ||
                modeledPaymentDate(balanceDate, payment.date);
              const label = `${money(Number(payment.amount), 2)} on ${shortDate(payment.date)}`;
              return (
                <li key={payment.id} className="lump-sum-row">
                  <div className="lump-sum-date">
                    <strong>{shortDate(payment.date)}</strong>
                    <small>
                      {application
                        ? `Modeled ${shortDate(application)}`
                        : "Set a balance date"}
                    </small>
                  </div>
                  <div className="lump-sum-amount">
                    <strong>{money(Number(payment.amount), 2)}</strong>
                    {result && result.status !== "APPLIED" && (
                      <small className="one-time-capped">
                        {result.status === "NOT_APPLIED"
                          ? "Not applied, paid off"
                          : `${money(result.applied, 2)} applied`}
                      </small>
                    )}
                  </div>
                  <div className="lump-sum-balance">
                    <span className="lump-sum-mobile-label">
                      Balance after{" "}
                    </span>
                    {result ? money(result.balanceAfter, 2) : "—"}
                  </div>
                  <div className="lump-sum-row-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Edit payment of ${label}`}
                      title="Edit payment"
                      disabled={disabled || !supported}
                      onClick={(event) => {
                        editorTrigger.current = event.currentTarget;
                        setEditor({ payment: { ...payment }, editing: true });
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-button lump-sum-delete"
                      aria-label={`Delete payment of ${label}`}
                      title="Delete payment"
                      disabled={disabled || !supported}
                      onClick={() => remove(payment)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="lump-sum-empty">
          <CalendarDays size={24} />
          <div>
            <strong>No one-time payments yet</strong>
            <p>
              Add a bonus or spare cash to see how much sooner you could pay off
              your mortgage.
            </p>
          </div>
        </div>
      )}
      {payments.length >= 500 && (
        <p className="lump-sum-draft-hint">
          You’ve reached the limit of 500 payments. Edit or remove a payment to
          add another.
        </p>
      )}
      <footer className="lump-sum-footer">
        <p>
          {payments.length === 0
            ? "Only include payments not already reflected in your balance. "
            : !impact
              ? "Calculate again to update savings and balances. "
              : "Savings shown are in addition to your monthly extras. "}
          Payments are modeled on the next scheduled due date.
        </p>
        {removed.length > 0 && (
          <div className="lump-sum-undo" role="status">
            <span>Payment removed from this plan.</span>
            <button
              type="button"
              className="text-button"
              disabled={disabled || !supported || payments.length >= 500}
              onClick={undo}
            >
              <RotateCcw size={13} />
              Undo
            </button>
          </div>
        )}
        {dirty && (
          <div className="lump-sum-save-row">
            <small>Unsaved changes</small>
            <div>
              <button
                form="mortgage-inputs"
                type="submit"
                value="preview"
                className="secondary-button"
                disabled={disabled || !canCalculate}
              >
                <Sparkles size={14} />
                Calculate
              </button>
              <button
                form="mortgage-inputs"
                type="submit"
                value="save"
                className="primary-button"
                disabled={disabled || !canSave}
              >
                <Save size={14} />
                Save plan
              </button>
            </div>
          </div>
        )}
      </footer>
      {editor && (
        <PaymentEditor
          {...editor}
          balanceDate={balanceDate}
          onClose={closeEditor}
          onSubmit={(payment) => {
            onChange(
              editor.editing
                ? payments.map((item) =>
                    item.id === payment.id ? payment : item,
                  )
                : [...payments, payment],
            );
            closeEditor();
          }}
        />
      )}
    </section>
  );
}
