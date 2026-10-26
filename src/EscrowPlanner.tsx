import { Fragment, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Check,
  Pencil,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { money } from "./data";
import {
  escrowForMonth,
  monthName,
  nextPaymentMonth,
  shortDate,
} from "./mortgage";
import type {
  EscrowDraft,
  EscrowScope,
  HousingProjection,
  MortgagePayment,
} from "./mortgage";

export default function EscrowPlanner({
  defaultAmount,
  balanceDate,
  startDate,
  entries,
  projection,
  monthlyHousingPayment,
  payments,
  disabled,
  supported,
  conflict,
  dirty,
  onChange,
}: {
  defaultAmount: string;
  balanceDate: string;
  startDate: string;
  entries: EscrowDraft[];
  projection?: HousingProjection;
  monthlyHousingPayment?: number;
  payments?: MortgagePayment[];
  disabled: boolean;
  supported: boolean;
  conflict: boolean;
  dirty: boolean;
  onChange: (entries: EscrowDraft[]) => void;
}) {
  const [chosenYear, setChosenYear] = useState<number | null>(null);
  const [chosenQuarter, setChosenQuarter] = useState<number | null>(null);
  const [mode, setMode] = useState<"monthly" | "yearly">("monthly");
  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const firstPaymentDate = projection?.months[0]?.date ?? payments?.[0]?.date;
  const firstMonth = nextPaymentMonth(balanceDate);
  const firstYear = Number(firstMonth.slice(0, 4)) || new Date().getFullYear();
  const year = chosenYear ?? firstYear;
  const quarter =
    chosenQuarter ?? Math.ceil((Number(firstMonth.slice(5, 7)) || 1) / 3);
  const minimumYear = Math.min(
    year,
    Number(startDate.slice(0, 4)) || firstYear,
    ...entries.map((e) => Number(e.month.slice(0, 4))),
  );
  const maximumYear = Math.max(
    year,
    Math.min(2100, firstYear + 50),
    ...entries.map((e) => Number(e.month.slice(0, 4))),
  );
  const yearTotal = projection?.years.find((item) => item.year === year);
  const months = new Map(
    projection?.months.map((item) => [item.date.slice(0, 7), item]),
  );
  // Older running backends already return the same balance in the loan schedule.
  const balances = new Map(
    payments?.map((item) => [item.date.slice(0, 7), item.balance]),
  );
  const closingMonth = projection?.months
    .filter((item) => item.date.startsWith(`${year}-`))
    .at(-1);
  const closingBalance =
    closingMonth?.balance ??
    (closingMonth ? balances.get(closingMonth.date.slice(0, 7)) : undefined);
  const shownMonths = Array.from(
    { length: quarter === 0 ? 12 : 3 },
    (_, i) =>
      `${year}-${String((quarter === 0 ? 0 : (quarter - 1) * 3) + i + 1).padStart(2, "0")}`,
  );
  function selectYear(value: number) {
    setChosenYear(value);
    setEditingMonth(null);
  }
  function update(
    month: string,
    patch: Partial<Pick<EscrowDraft, "amount" | "scope">>,
  ) {
    const current = entries.find((entry) => entry.month === month);
    const next = {
      month,
      amount: escrowForMonth(defaultAmount, entries, month).amount,
      scope: "FROM_MONTH" as EscrowScope,
      ...current,
      ...patch,
    };
    onChange(
      [...entries.filter((entry) => entry.month !== month), next].sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
    );
  }
  return (
    <section
      id="mortgage-escrow"
      className="panel escrow-planner"
      aria-labelledby="escrow-heading"
    >
      <div className="panel-heading">
        <div>
          <h2 id="escrow-heading">
            <CalendarDays size={18} />
            Monthly mortgage overview
          </h2>
          <p>Your payment, escrow, and remaining balance in one place</p>
        </div>
        <div
          className="escrow-year-controls"
          aria-label="Browse mortgage years"
        >
          <button
            type="button"
            className="icon-button"
            aria-label="Previous escrow year"
            disabled={disabled || year <= minimumYear}
            onClick={() => selectYear(year - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <select
            aria-label="Escrow year"
            value={year}
            onChange={(e) => selectYear(Number(e.target.value))}
            disabled={disabled}
          >
            {Array.from(
              { length: maximumYear - minimumYear + 1 },
              (_, i) => minimumYear + i,
            ).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-button"
            aria-label="Next escrow year"
            disabled={disabled || year >= maximumYear}
            onClick={() => selectYear(year + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      {!supported && (
        <p className="form-error" role="alert">
          Restart the Java backend and reload the saved plan to enable monthly
          escrow.
        </p>
      )}
      <div
        className="escrow-first-payment"
        aria-label="First projected monthly payment"
      >
        <span>First projected monthly payment</span>
        <strong>
          {firstPaymentDate && monthlyHousingPayment != null
            ? money(monthlyHousingPayment, 2)
            : "—"}
        </strong>
        <small>
          {monthlyHousingPayment == null
            ? "Calculate to update the projection"
            : firstPaymentDate
              ? `${shortDate(firstPaymentDate)}, including escrow, before extras`
              : "No remaining payment in this projection"}
        </small>
      </div>
      <div className="escrow-summary" aria-label={`${year} projected totals`}>
        <div>
          <span>{year} total payments</span>
          <strong>
            {projection ? money(yearTotal?.totalPayment ?? 0, 2) : "—"}
          </strong>
        </div>
        <div>
          <span>{year} escrow</span>
          <strong>{projection ? money(yearTotal?.escrow ?? 0, 2) : "—"}</strong>
        </div>
        <div>
          <span>Balance after {year}'s payments</span>
          <strong>
            {closingBalance == null ? "—" : money(closingBalance, 2)}
          </strong>
        </div>
        <div>
          <span>Escrow through payoff</span>
          <strong>{projection ? money(projection.escrowTotal, 2) : "—"}</strong>
        </div>
      </div>
      <div className="escrow-toolbar">
        <div
          className="escrow-segments"
          role="group"
          aria-label="Mortgage detail view"
        >
          <button
            type="button"
            aria-pressed={mode === "monthly"}
            onClick={() => setMode("monthly")}
          >
            Monthly details
          </button>
          <button
            type="button"
            aria-pressed={mode === "yearly"}
            onClick={() => setMode("yearly")}
          >
            Yearly totals
          </button>
        </div>
        {mode === "monthly" ? (
          <div
            className="escrow-quarters"
            role="group"
            aria-label="Filter months"
          >
            {[0, 1, 2, 3, 4].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={quarter === value}
                onClick={() => {
                  setChosenQuarter(value);
                  setEditingMonth(null);
                }}
              >
                {value === 0 ? "Full year" : `Q${value}`}
              </button>
            ))}
          </div>
        ) : (
          <span className="escrow-toolbar-note">
            Full remaining payment schedule
          </span>
        )}
      </div>
      {mode === "monthly" ? (
        <>
          <div
            className="mortgage-table-scroll escrow-table-window"
            tabIndex={0}
            role="region"
            aria-label="Monthly payment details, scroll for more"
          >
            <table className="escrow-table">
              <caption className="sr-only">
                {year} projected payments and balance after each payment
              </caption>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Principal + interest</th>
                  <th>Extra principal</th>
                  <th>
                    Escrow <Pencil size={11} />
                  </th>
                  <th>Total payment</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {shownMonths.map((month) => {
                  const effective = escrowForMonth(
                      defaultAmount,
                      entries,
                      month,
                    ),
                    explicit = entries.find((entry) => entry.month === month),
                    payment = months.get(month);
                  const balance =
                    payment?.balance ??
                    (payment ? balances.get(month) : undefined);
                  const isEditing = editingMonth === month;
                  const source =
                    effective.sourceMonth === null
                      ? "Loan default"
                      : `${effective.scope === "THIS_MONTH" ? "This month only" : "From"} ${monthName(effective.sourceMonth)}`;
                  const amount =
                    effective.amount.trim() === "" ||
                    !Number.isFinite(Number(effective.amount))
                      ? "Set amount"
                      : money(Number(effective.amount), 2);
                  return (
                    <Fragment key={month}>
                      <tr
                        className={
                          isEditing
                            ? "escrow-month-selected"
                            : explicit
                              ? "escrow-month-edited"
                              : ""
                        }
                      >
                        <th scope="row">
                          {monthName(month).split(" ")[0]}
                          {explicit && (
                            <span
                              className="escrow-change-dot"
                              title={source}
                              aria-label={
                                explicit.scope === "THIS_MONTH"
                                  ? "One-month change"
                                  : "Carry-forward change"
                              }
                            />
                          )}
                        </th>
                        <td>
                          {payment
                            ? money(payment.principalAndInterest, 2)
                            : "—"}
                        </td>
                        <td>
                          {payment ? money(payment.extraPrincipal, 2) : "—"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="escrow-amount-button"
                            aria-label={`Edit escrow for ${monthName(month)}`}
                            aria-expanded={isEditing}
                            aria-controls={
                              isEditing ? `escrow-editor-${month}` : undefined
                            }
                            title={`${source}. Select to edit.`}
                            disabled={disabled || !supported}
                            onClick={() =>
                              setEditingMonth(isEditing ? null : month)
                            }
                          >
                            {amount}
                            <Pencil size={12} />
                          </button>
                        </td>
                        <td className="escrow-total">
                          {payment ? money(payment.totalPayment, 2) : "—"}
                        </td>
                        <td className="escrow-balance">
                          {balance == null ? "—" : money(balance, 2)}
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="escrow-editor-row">
                          <td colSpan={6}>
                            <div
                              id={`escrow-editor-${month}`}
                              className="escrow-inline-editor"
                              role="group"
                              aria-label={`Edit ${monthName(month)} escrow`}
                            >
                              <div className="escrow-editor-caption">
                                <strong>{monthName(month)}</strong>
                                <small>{source}</small>
                              </div>
                              <label>
                                Escrow (USD)
                                <input
                                  autoFocus
                                  form="mortgage-inputs"
                                  type="number"
                                  min="0"
                                  max="1000000"
                                  step="0.01"
                                  required
                                  aria-label={`Escrow for ${monthName(month)}`}
                                  value={effective.amount}
                                  disabled={disabled || !supported}
                                  onChange={(e) =>
                                    update(month, { amount: e.target.value })
                                  }
                                />
                              </label>
                              <label>
                                Apply amount
                                <select
                                  form="mortgage-inputs"
                                  aria-label={`Apply ${monthName(month)} escrow`}
                                  value={explicit?.scope || "FROM_MONTH"}
                                  disabled={disabled || !supported}
                                  onChange={(e) =>
                                    update(month, {
                                      scope: e.target.value as EscrowScope,
                                    })
                                  }
                                >
                                  <option value="FROM_MONTH">
                                    This month onward
                                  </option>
                                  <option value="THIS_MONTH">
                                    This month only
                                  </option>
                                </select>
                              </label>
                              <button
                                className="secondary-button escrow-reset"
                                type="button"
                                aria-label={`Reset ${monthName(month)} escrow`}
                                title="Restore the previous carried amount or loan default"
                                disabled={disabled || !supported || !explicit}
                                onClick={() =>
                                  onChange(
                                    entries.filter(
                                      (entry) => entry.month !== month,
                                    ),
                                  )
                                }
                              >
                                <RotateCcw size={14} />
                                Reset
                              </button>
                              <button
                                className="secondary-button"
                                type="button"
                                disabled={disabled}
                                onClick={() => setEditingMonth(null)}
                              >
                                <Check size={14} />
                                Done
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="escrow-table-hint">
            Select an escrow amount to edit. Changes carry forward by default.
            Balance is after the projected payment.
          </p>
        </>
      ) : (
        <div
          className="mortgage-table-scroll escrow-table-window"
          tabIndex={0}
          role="region"
          aria-label="Yearly payment details, scroll for more"
        >
          <table className="escrow-annual-table">
            <caption className="sr-only">
              Yearly projected housing payments
            </caption>
            <thead>
              <tr>
                <th>Year</th>
                <th>Payments</th>
                <th>Principal + interest</th>
                <th>Extra principal</th>
                <th>Escrow</th>
                <th>Total payment</th>
              </tr>
            </thead>
            <tbody>
              {projection?.years.map((item) => (
                <tr
                  key={item.year}
                  className={item.year === year ? "escrow-month-selected" : ""}
                >
                  <th scope="row">
                    <button
                      type="button"
                      className="escrow-year-link"
                      aria-label={`View ${item.year} monthly details`}
                      onClick={() => {
                        selectYear(item.year);
                        setChosenQuarter(0);
                        setMode("monthly");
                      }}
                    >
                      {item.year}
                      <ChevronRight size={12} />
                    </button>
                  </th>
                  <td>{item.payments}</td>
                  <td>{money(item.principalAndInterest, 2)}</td>
                  <td>{money(item.extraPrincipal, 2)}</td>
                  <td>{money(item.escrow, 2)}</td>
                  <td className="escrow-total">
                    {money(item.totalPayment, 2)}
                  </td>
                </tr>
              ))}
              {!projection?.years.length && (
                <tr>
                  <td colSpan={6} className="escrow-no-results">
                    {projection
                      ? "No remaining loan payments."
                      : "Calculate the plan to see yearly totals."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="escrow-actions">
        <p role="status">
          <span className={`escrow-status-dot ${dirty ? "is-unsaved" : ""}`} />
          {dirty
            ? "Unsaved changes. Calculate or save to update totals."
            : "Saved with this mortgage profile"}
        </p>
        <div>
          <button
            form="mortgage-inputs"
            type="submit"
            value="preview"
            className="secondary-button"
            disabled={disabled || !supported}
          >
            <Sparkles size={15} />
            Calculate
          </button>
          <button
            form="mortgage-inputs"
            type="submit"
            value="save"
            className="primary-button"
            disabled={disabled || !supported || conflict}
          >
            <Save size={15} />
            Save plan & escrow
          </button>
        </div>
      </div>
      <details className="escrow-assumptions">
        <summary>About these projections</summary>
        <p>
          Default escrow: {money(Number(defaultAmount) || 0, 2)}/month. Totals
          cover future payments after the balance snapshot, including extra
          principal. A dash means no projected payment or that results need
          recalculating. Escrow does not reduce principal or change interest
          savings. Taxes and insurance can continue after payoff.
          {projection
            ? ` Total projected housing payments through payoff: ${money(projection.totalPayments, 2)}.`
            : ""}
        </p>
      </details>
    </section>
  );
}
