import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, House, LoaderCircle, Save, X } from "lucide-react";
import { ApiError } from "./api";
import { money } from "./data";
import { shortDate } from "./mortgage";
import type { HomeSale, MortgageView } from "./mortgage";
import { estimateHomeSale, saleDraft, saleInput } from "./homeSale";
import type { HomeSaleDraft } from "./homeSale";

const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export default function HomeSaleCalculator({
  view,
  disabled,
  onSave,
}: {
  view: MortgageView;
  disabled: boolean;
  onSave: (sale: HomeSale) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() =>
    saleDraft(view.homeSale, view.loan!.balanceDate),
  );
  const [editor, setEditor] = useState<HomeSaleDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const open = editor !== null;
  const savedFingerprint = JSON.stringify(view.homeSale ?? null);
  useEffect(() => {
    setDraft(saleDraft(view.homeSale, view.loan!.balanceDate));
    setStale(false);
    setError("");
  }, [savedFingerprint]);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      opener.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const input = saleInput(draft);
  const estimate =
    input && view.loan && view.analysis
      ? estimateHomeSale(input, view.loan, view.analysis)
      : null;
  const editingInput = editor && saleInput(editor);
  const editingEstimate =
    editingInput && view.loan && view.analysis
      ? estimateHomeSale(editingInput, view.loan, view.analysis)
      : null;
  const dirty = !!draft.salePrice && JSON.stringify(input) !== savedFingerprint;
  const working = disabled || saving;
  const unsupported = !view.supportsHomeSale;
  const active = editor ?? draft;
  const outdatedDate = active.closingDate < view.loan!.balanceDate;
  const hasPrice = draft.salePrice !== "";
  const shortfall = (estimate?.cashInHand ?? 0) < 0;
  const taxStatus = draft.taxEnabled ? "After tax reserve" : "Before tax";

  async function save(value: HomeSale | null, closeEditor: boolean) {
    if (!value || working || stale) return;
    setSaving(true);
    setError("");
    try {
      await onSave(value);
      setDraft(saleDraft(value, view.loan!.balanceDate));
      if (closeEditor) setEditor(null);
    } catch (e) {
      setStale(e instanceof ApiError && e.status === 409);
      setError(
        e instanceof Error
          ? e.message
          : "Could not save this estimate. Your inputs are kept; try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  function edit() {
    setError("");
    setEditor({ ...draft });
  }
  function close() {
    if (!saving) setEditor(null);
  }
  function update<K extends keyof HomeSaleDraft>(
    key: K,
    value: HomeSaleDraft[K],
  ) {
    setEditor((previous) =>
      previous ? { ...previous, [key]: value } : previous,
    );
    setError("");
  }
  function field(
    key: Exclude<keyof HomeSaleDraft, "taxEnabled" | "closingDate">,
    label: string,
    optional = false,
  ) {
    return (
      <label className="field">
        <span>{label}</span>
        <input
          type="number"
          inputMode="decimal"
          min={key === "salePrice" ? "0.01" : "0"}
          max={key === "agentFeePercent" ? "100" : "100000000"}
          step="0.01"
          required={!optional}
          value={editor![key]}
          placeholder={optional ? "Use projected principal" : "0.00"}
          onChange={(event) => update(key, event.target.value)}
          disabled={working}
        />
      </label>
    );
  }

  return (
    <section className="home-sale-card" aria-labelledby="home-sale-title">
      <header className="home-sale-heading">
        <House size={16} aria-hidden="true" />
        <h3 id="home-sale-title">Home sale estimate</h3>
      </header>
      <div className="home-sale-main">
        <label className="home-sale-price" htmlFor="home-sale-price">
          Selling price
          <span>
            <span aria-hidden="true">$</span>
            <input
              id="home-sale-price"
              type="number"
              inputMode="decimal"
              min="0.01"
              max="100000000"
              step="0.01"
              placeholder="Enter price"
              value={draft.salePrice}
              disabled={working || unsupported}
              aria-describedby="home-sale-status"
              aria-invalid={hasPrice && !input}
              onChange={(event) => {
                setDraft((previous) => ({
                  ...previous,
                  salePrice: event.target.value,
                }));
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void save(input, false);
                }
              }}
            />
          </span>
        </label>
        <div
          className={`home-sale-result${shortfall ? " is-shortfall" : ""}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span>{shortfall ? "Amount needed" : "Cash in hand"}</span>
          <strong>
            {estimate ? money(Math.abs(estimate.cashInHand)) : "—"}
          </strong>
        </div>
      </div>
      <div className="home-sale-deductions">
        <span>
          Mortgage{" "}
          <b>
            {compactMoney.format(
              estimate?.mortgagePayoff ?? view.loan!.balance,
            )}
          </b>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Costs + loans{" "}
          <b>
            {estimate
              ? compactMoney.format(
                  estimate.sellingCosts + (input?.otherLoans ?? 0),
                )
              : "—"}
          </b>
        </span>
      </div>
      <footer className="home-sale-footer">
        <span id="home-sale-status" role="status">
          {saving ? (
            "Saving…"
          ) : dirty ? (
            <button
              type="button"
              className="home-sale-save"
              disabled={working || !estimate || stale || unsupported}
              onClick={() => void save(input, false)}
            >
              <Save size={12} />
              Save estimate
            </button>
          ) : (
            `${taxStatus} · Estimate`
          )}
        </span>
        <button
          ref={opener}
          type="button"
          className="home-sale-link"
          disabled={working || unsupported}
          onClick={edit}
        >
          Costs &amp; taxes <ChevronRight size={14} />
        </button>
      </footer>
      {!open &&
        (error || outdatedDate || (hasPrice && !input) || unsupported) && (
          <p className="home-sale-error" role="alert">
            {unsupported
              ? "Restart the Java backend to enable sale estimates."
              : error ||
                (outdatedDate
                  ? "Update the closing date in Costs & taxes to match your latest balance."
                  : "Enter valid amounts with up to two decimal places.")}
          </p>
        )}
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            className="home-sale-dialog"
            aria-labelledby="home-sale-dialog-title"
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
          >
            <header className="dialog-heading">
              <div>
                <span className="overline">HOME SALE ESTIMATE</span>
                <h2 id="home-sale-dialog-title">Costs &amp; taxes</h2>
                <p>Adjust the details. See what you could take home.</p>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close sale estimate"
                onClick={close}
                disabled={saving}
              >
                <X size={18} />
              </button>
            </header>
          <form
            aria-busy={saving}
              onSubmit={(event) => {
                event.preventDefault();
                void save(editingInput, true);
              }}
            >
              <div className="form-grid">
                {field("salePrice", "Selling price (USD)")}
                <label className="field">
                  <span>Expected closing date</span>
                  <input
                    type="date"
                    min={view.loan!.balanceDate}
                    max="2100-12-31"
                    required
                    value={editor.closingDate}
                    onChange={(event) =>
                      update("closingDate", event.target.value)
                    }
                    disabled={working}
                  />
                </label>
              </div>
              <div className="home-sale-payoff-note">
                <span>Projected principal at closing</span>
                <strong>
                  {editingEstimate
                    ? money(editingEstimate.projectedBalance, 2)
                    : "—"}
                </strong>
              </div>
              {field(
                "payoffOverride",
                "Lender payoff quote (USD, optional)",
                true,
              )}
              <p className="home-sale-help">
                Leave blank to use your saved mortgage plan’s principal after
                payments due on or before closing
                {editingEstimate
                  ? ` (balance as of ${shortDate(editingEstimate.balanceAsOf)})`
                  : ""}
                . Daily payoff interest and lender fees are excluded; use a
                lender quote for an accurate payoff. Escrow refunds are
                excluded.
              </p>
              <div className="form-grid">
                {field("agentFeePercent", "Agent fee (%)")}
                {field("closingCosts", "Other closing costs (USD)")}
                {field("buyerCredits", "Buyer credits (USD)")}
                {field("otherLoans", "Other secured loans (USD)")}
              </div>
              <label className="home-sale-tax-toggle">
                <input
                  type="checkbox"
                  checked={editor.taxEnabled}
                  onChange={(event) =>
                    update("taxEnabled", event.target.checked)
                  }
                  disabled={working}
                />
                <span>Set aside money for tax</span>
              </label>
              {editor.taxEnabled && (
                <div>
                  {field("taxReserve", "Your estimated tax reserve (USD)")}
                  <p className="home-sale-help">
                    Enter your own estimate of federal and state taxes. Hisabo
                    does not calculate capital-gains tax.
                  </p>
                </div>
              )}
              <dl className="home-sale-receipt">
                <div>
                  <dt>Mortgage payoff</dt>
                  <dd>
                    {editingEstimate
                      ? money(editingEstimate.mortgagePayoff, 2)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Selling costs + other loans</dt>
                  <dd>
                    {editingEstimate
                      ? money(
                          editingEstimate.sellingCosts +
                            (editingInput?.otherLoans ?? 0),
                          2,
                        )
                      : "—"}
                  </dd>
                </div>
                {editor.taxEnabled && (
                  <>
                    <div>
                      <dt>Cash before tax reserve</dt>
                      <dd>
                        {editingEstimate
                          ? money(editingEstimate.cashBeforeTax, 2)
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Tax reserve</dt>
                      <dd>
                        {editingEstimate
                          ? money(editingEstimate.taxReserve, 2)
                          : "—"}
                      </dd>
                    </div>
                  </>
                )}
                <div
                  className={`home-sale-receipt-total${editingEstimate && editingEstimate.cashInHand < 0 ? " is-shortfall" : ""}`}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <dt>
                    {editingEstimate && editingEstimate.cashInHand < 0
                      ? "Amount needed"
                      : "Cash in hand"}
                    <small>
                      {editor.taxEnabled ? "After tax reserve" : "Before tax"}
                    </small>
                  </dt>
                  <dd>
                    {editingEstimate
                      ? money(Math.abs(editingEstimate.cashInHand), 2)
                      : "—"}
                  </dd>
                </div>
              </dl>
              {(error || outdatedDate) && (
                <p className="form-error" role="alert">
                  {error ||
                    "Closing date must be on or after your mortgage balance date."}
                  {stale &&
                    " Close this dialog and reload the saved plan before editing again."}
                </p>
              )}
              <p className="home-sale-help">
                Use estimate saves these details to this profile’s XML and Excel
                workbook.
              </p>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={close}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={working || !editingEstimate || stale}
                >
                  {saving ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Save size={16} />
                  )}
                {saving ? "Saving…" : "Use estimate"}
                </button>
              </div>
            </form>
          </dialog>,
          document.body,
        )}
    </section>
  );
}
