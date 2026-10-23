import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FileSpreadsheet,
  Hammer,
  House,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { api, ApiError } from "./api";
import MortgageBalanceChart from "./MortgageBalanceChart";
import EscrowPlanner from "./EscrowPlanner";
import OneTimePayments from "./OneTimePayments";
import HomeSaleCalculator from "./HomeSaleCalculator";
import { money, sum } from "./data";
import type {
  MortgageAnalysis,
  MortgageInput,
  MortgageView,
  EscrowDraft,
  HomeSale,
} from "./mortgage";
import {
  datedPayments,
  downloadBlob,
  nextPaymentMonth,
  shortDate,
} from "./mortgage";

interface Draft {
  startDate: string;
  balanceDate: string;
  balance: string;
  annualRate: string;
  interestConvention: "MONTHLY" | "CANADIAN_SEMIANNUAL";
  paymentMode: "PAYMENT" | "TERM";
  monthlyPayment: string;
  remainingMonths: string;
  monthlyEscrow: string;
  monthlyExtra: string;
  extraStartMonth: string;
  oneTimePayments: { id: string; date: string; amount: string }[];
  escrowChanges: EscrowDraft[];
}
const emptyDraft: Draft = {
  startDate: "",
  balanceDate: "",
  balance: "",
  annualRate: "",
  interestConvention: "MONTHLY",
  paymentMode: "PAYMENT",
  monthlyPayment: "",
  remainingMonths: "",
  monthlyEscrow: "0",
  monthlyExtra: "0",
  extraStartMonth: "",
  oneTimePayments: [],
  escrowChanges: [],
};
function draftFrom(view: MortgageView): Draft {
  if (!view.loan) return { ...emptyDraft };
  const l = view.loan,
    s = view.scenario;
  return {
    startDate: l.startDate,
    balanceDate: l.balanceDate,
    balance: String(l.balance),
    annualRate: String(l.annualRate),
    interestConvention: l.interestConvention,
    paymentMode: l.paymentMode,
    monthlyPayment: l.monthlyPayment == null ? "" : String(l.monthlyPayment),
    remainingMonths: l.remainingMonths == null ? "" : String(l.remainingMonths),
    monthlyEscrow: String(l.monthlyEscrow),
    monthlyExtra: String(s.monthlyExtra),
    extraStartMonth: s.extraStartMonth || "",
    oneTimePayments: datedPayments(l, s).map((p) => ({
      ...p,
      amount: String(p.amount),
    })),
    escrowChanges: (s.escrowChanges || []).map((entry) => ({
      ...entry,
      amount: String(entry.amount),
    })),
  };
}
function inputFrom(draft: Draft): MortgageInput {
  return {
    loan: {
      startDate: draft.startDate,
      balanceDate: draft.balanceDate,
      balance: Number(draft.balance),
      annualRate: Number(draft.annualRate),
      interestConvention: draft.interestConvention,
      paymentMode: draft.paymentMode,
      monthlyPayment:
        draft.paymentMode === "PAYMENT" ? Number(draft.monthlyPayment) : null,
      remainingMonths:
        draft.paymentMode === "TERM" ? Number(draft.remainingMonths) : null,
      monthlyEscrow: Number(draft.monthlyEscrow),
    },
    scenario: {
      monthlyExtra: Number(draft.monthlyExtra),
      extraStartMonth:
        Number(draft.monthlyExtra) > 0
          ? draft.extraStartMonth || nextPaymentMonth(draft.balanceDate)
          : null,
      oneTimeExtra: 0,
      oneTimeMonth: null,
      oneTimePayments: draft.oneTimePayments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
      escrowChanges: draft.escrowChanges.map((entry) => ({
        ...entry,
        amount: entry.amount.trim() === "" ? NaN : Number(entry.amount),
      })),
    },
  };
}
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field mortgage-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export default function MortgageWorkspace({
  profileId,
  name,
  onBusyChange,
}: {
  profileId: string;
  name: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const [view, setView] = useState<MortgageView | null>(null);
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
  const [editingDetails, setEditingDetails] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const [analysis, setAnalysis] = useState<MortgageAnalysis | null>(null);
  const [analyzedInput, setAnalyzedInput] = useState("");
  const [savedInput, setSavedInput] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) {
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);
  const [conflict, setConflict] = useState(false),
    [reload, setReload] = useState(0);
  const [expenseDraft, setExpenseDraft] = useState({
    date: "",
    project: "",
    description: "",
    amount: "",
  });
  const [editingExpense, setEditingExpense] = useState<string | undefined>();
  const [deletingExpense, setDeletingExpense] = useState<string | null>(null);
  const [expenseYear, setExpenseYear] = useState("all");
  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .mortgage(profileId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const loadedDraft = draftFrom(result),
          fingerprint = JSON.stringify(inputFrom(loadedDraft));
        setView(result);
        setDraft(loadedDraft);
        setEditingDetails(!result.loan);
        setAnalysis(result.analysis);
        setSavedInput(result.loan ? fingerprint : "");
        setAnalyzedInput(result.loan ? fingerprint : "");
        setConflict(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof ApiError && e.status === 404
              ? "Restart the Java backend to enable the mortgage template, then reload."
              : e.message || "Could not load the mortgage plan.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [profileId, reload]);
  const input = inputFrom(draft),
    fingerprint = JSON.stringify(input);
  const current = fingerprint === analyzedInput ? analysis : null;
  const dirty = fingerprint !== savedInput;
  const detailsLocked = !!view?.loan && !editingDetails;
  function editDetails() {
    setEditingDetails(true);
    setStatus("");
    requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      startDateRef.current?.focus({ preventScroll: true });
    });
  }
  function cancelDetailChanges() {
    if (!view?.loan) return;
    const saved = draftFrom(view);
    setDraft((previous) => ({
      ...saved,
      monthlyExtra: previous.monthlyExtra,
      extraStartMonth: previous.extraStartMonth,
      oneTimePayments: previous.oneTimePayments,
      escrowChanges: previous.escrowChanges,
    }));
    setEditingDetails(false);
    setAnalysis(view.analysis);
    setAnalyzedInput(JSON.stringify(inputFrom(saved)));
    setError("");
    setStatus(
      "Saved mortgage details restored. Your extra-payment and escrow inputs are kept.",
    );
  }
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setStatus("");
  }
  function failure(e: unknown) {
    setError(
      e instanceof Error ? e.message : "Could not complete this request.",
    );
    if (e instanceof ApiError && e.status === 409) setConflict(true);
  }
  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!view?.supportsDatedPayments || !view.supportsMonthlyEscrow) {
      setError(
        "Restart the Java backend and reload the saved plan to enable monthly escrow and dated payments.",
      );
      return;
    }
    if (
      draft.escrowChanges.some(
        (entry) =>
          entry.amount.trim() === "" || !Number.isFinite(Number(entry.amount)),
      )
    ) {
      setError(
        "Enter an escrow amount for every edited month, or reset the month to use the previous amount.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    const save =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "save";
    try {
      if (save && view) {
        const result = await api.saveMortgage(profileId, view.revision, input);
        setView(result);
        const savedDraft = draftFrom(result);
        const savedFingerprint = JSON.stringify(inputFrom(savedDraft));
        setDraft(savedDraft);
        setEditingDetails(false);
        setAnalysis(result.analysis);
        setSavedInput(savedFingerprint);
        setAnalyzedInput(savedFingerprint);
        setConflict(false);
        setStatus(
          result.workbookWarning
            ? "Mortgage plan saved. Excel needs attention; see the warning above."
            : "Mortgage plan saved. Your Excel workbook is up to date.",
        );
      } else {
        setAnalysis(await api.previewMortgage(profileId, input));
        setAnalyzedInput(fingerprint);
        setStatus(
          "Scenario calculated. Save the plan to keep these inputs and update Excel.",
        );
      }
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!view) return;
    setBusy(true);
    setError("");
    try {
      downloadBlob(await api.mortgageExcel(profileId), view.fileName);
      setStatus(`Downloaded ${view.fileName}`);
      setView((previous) =>
        previous ? { ...previous, workbookWarning: null } : previous,
      );
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function saveHomeSale(homeSale: HomeSale) {
    if (!view) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.saveHomeSale(profileId, view.revision, homeSale);
      setView(result);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) failure(e);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  function acceptExpenseView(result: MortgageView) {
    setView(result);
    setAnalysis((previous) =>
      previous
        ? {
            ...previous,
            improvementTotal: sum(
              result.improvements.map((item) => item.amount),
            ),
          }
        : previous,
    );
    setExpenseDraft({ date: "", project: "", description: "", amount: "" });
    setEditingExpense(undefined);
    setDeletingExpense(null);
  }
  async function saveExpense(event: FormEvent) {
    event.preventDefault();
    if (!view) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.saveImprovement(
        profileId,
        view.revision,
        { ...expenseDraft, amount: Number(expenseDraft.amount) },
        editingExpense,
      );
      acceptExpenseView(result);
      setStatus("Home improvement expense saved.");
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  async function deleteExpense(id: string) {
    if (!view) return;
    setBusy(true);
    setError("");
    try {
      acceptExpenseView(
        await api.deleteImprovement(profileId, view.revision, id),
      );
      setStatus("Home improvement expense removed.");
    } catch (e) {
      failure(e);
    } finally {
      setBusy(false);
    }
  }
  const expenseYears = [
    ...new Set(view?.improvements.map((item) => item.date.slice(0, 4)) || []),
  ]
    .sort()
    .reverse();
  const shownExpenses = (view?.improvements || [])
    .filter(
      (item) => expenseYear === "all" || item.date.startsWith(expenseYear),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const numberInput = (
    key: Exclude<keyof Draft, "oneTimePayments" | "escrowChanges">,
    extra: {
      min?: string;
      max?: string;
      step?: string;
      required?: boolean;
    } = {},
  ) => (
    <input
      type="number"
      min="0"
      max="100000000"
      step="0.01"
      required
      value={draft[key]}
      onChange={(e) => change(key, e.target.value as never)}
      disabled={busy}
      {...extra}
    />
  );
  return (
    <section className="mortgage-workspace" aria-label="Mortgage planner">
      <div className="page-heading">
        <div>
          <span className="overline">HOME & MORTGAGE</span>
          <h1>
            A clearer path to <span>paid off.</span>
          </h1>
          <p>
            <strong>{name}</strong> · Plan your payoff. Make room for what’s
            next.
          </p>
        </div>
        <div className="heading-actions">
          <a className="secondary-button" href="#mortgage-escrow">
            <CalendarDays size={16} />
            Monthly escrow
          </a>
          <a className="secondary-button" href="#mortgage-one-time">
            <Plus size={16} />
            One-time payments
          </a>
          {view?.loan && (
            <button
              className="secondary-button"
              type="button"
              disabled={busy || loading || editingDetails}
              onClick={editDetails}
              aria-controls="mortgage-detail-fields"
            >
              <Pencil size={16} />
              {editingDetails ? "Editing details" : "Edit details"}
            </button>
          )}
          <button
            className="secondary-button"
            disabled={busy || !view || !view.loan || dirty}
            onClick={() => void download()}
            title={
              dirty
                ? "Save the plan before downloading updated results"
                : view?.fileName
            }
          >
            <FileSpreadsheet size={17} />
            Mortgage Excel
          </button>
        </div>
      </div>
      {error && (
        <div className="error-banner" role="alert" ref={errorRef} tabIndex={-1}>
          <CircleAlert size={20} />
          <div>
            <strong>Check your mortgage plan</strong>
            <p>{error}</p>
          </div>
          {(conflict || !view) && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setReload((v) => v + 1);
                setStatus("");
              }}
            >
              Reload saved plan
            </button>
          )}
        </div>
      )}
      {view?.workbookWarning && (
        <p className="form-error" role="alert">
          {view.workbookWarning}
        </p>
      )}
      {status && (
        <p className="mortgage-status" role="status">
          <CheckCircle2 size={17} />
          {status}
        </p>
      )}
      {loading ? (
        <p className="loading-message">
          <LoaderCircle size={22} className="spin" />
          Opening your mortgage workspace…
        </p>
      ) : (
        view && (
          <>
            <div
              className={`mortgage-layout ${analysis ? "has-analysis" : ""}`}
            >
              <div className="mortgage-inputs panel">
                <form
                  id="mortgage-inputs"
                  onSubmit={(event) => void calculate(event)}
                >
                  <div
                    className="mortgage-section-title mortgage-details-heading"
                    ref={detailsRef}
                  >
                    <span>
                      <House size={20} />
                    </span>
                    <div>
                      <h2 id="mortgage-details-title">Your mortgage details</h2>
                      <p>
                        Use the principal balance from your latest statement.
                      </p>
                    </div>
                  </div>
                  {!detailsLocked && (
                    <div className="mortgage-details-state" aria-live="polite">
                      <div>
                        <Pencil size={16} />
                        <span>
                          <strong>
                            {view.loan
                              ? "Editing mortgage details"
                              : "Set up your mortgage"}
                          </strong>
                          <small>
                            Save plan to keep your details and lock them.
                          </small>
                        </span>
                      </div>
                      {view.loan && editingDetails && (
                        <button
                          type="button"
                          className="text-button"
                          disabled={busy}
                          onClick={cancelDetailChanges}
                        >
                          Cancel changes
                        </button>
                      )}
                    </div>
                  )}
                  <fieldset
                    id="mortgage-detail-fields"
                    className="mortgage-detail-fields"
                    disabled={busy || detailsLocked}
                    aria-labelledby="mortgage-details-title"
                  >
                    <div className="form-grid">
                      <Field label="Mortgage start date">
                        <input
                          type="date"
                          min="1900-01-01"
                          max="2100-12-31"
                          required
                          ref={startDateRef}
                          value={draft.startDate}
                          disabled={busy}
                          onChange={(e) => change("startDate", e.target.value)}
                        />
                      </Field>
                      <Field
                        label="Balance date"
                        hint="Just after your last monthly payment."
                      >
                        <input
                          type="date"
                          min={draft.startDate || "1900-01-01"}
                          max="2100-12-31"
                          required
                          value={draft.balanceDate}
                          disabled={busy}
                          onChange={(e) =>
                            change("balanceDate", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="Outstanding principal (USD)">
                        {numberInput("balance")}
                      </Field>
                      <Field
                        label="Annual interest rate (%)"
                        hint="Use the loan interest rate, not APR."
                      >
                        {numberInput("annualRate", {
                          max: "30",
                          step: "0.000001",
                        })}
                      </Field>
                    </div>
                    <Field label="How should we calculate the payment?">
                      <select
                        value={draft.paymentMode}
                        disabled={busy}
                        onChange={(e) =>
                          change(
                            "paymentMode",
                            e.target.value as Draft["paymentMode"],
                          )
                        }
                      >
                        <option value="PAYMENT">
                          I know my monthly principal + interest
                        </option>
                        <option value="TERM">
                          Calculate from the remaining term
                        </option>
                      </select>
                    </Field>
                    <div className="form-grid">
                      {draft.paymentMode === "PAYMENT" ? (
                        <Field
                          label="Monthly principal + interest (USD)"
                          hint="Exclude taxes, insurance, and extra payments."
                        >
                          {numberInput("monthlyPayment", { min: "0.01" })}
                        </Field>
                      ) : (
                        <Field
                          label="Remaining term (months)"
                          hint="For example, 25 years = 300 months."
                        >
                          {numberInput("remainingMonths", {
                            min: "1",
                            max: "600",
                            step: "1",
                          })}
                        </Field>
                      )}
                      <Field
                        label="Default escrow (USD)"
                        hint="Starting amount. Update individual months in Monthly escrow."
                      >
                        {numberInput("monthlyEscrow", { max: "1000000" })}
                      </Field>
                    </div>
                    <Field label="Interest calculation">
                      <select
                        value={draft.interestConvention}
                        disabled={busy}
                        onChange={(e) =>
                          change(
                            "interestConvention",
                            e.target.value as Draft["interestConvention"],
                          )
                        }
                      >
                        <option value="MONTHLY">
                          Fixed rate · annual rate ÷ 12
                        </option>
                        <option value="CANADIAN_SEMIANNUAL">
                          Fixed rate · Canadian semiannual compounding
                        </option>
                      </select>
                    </Field>
                  </fieldset>
                  <div className="mortgage-section-title extra-title">
                    <span>
                      <Sparkles size={20} />
                    </span>
                    <div>
                      <h2>What if you pay a little more?</h2>
                      <p>Extra payments go straight to principal.</p>
                    </div>
                  </div>
                  <div className="form-grid monthly-extra-fields">
                    <Field label="Extra principal each month (USD)">
                      {numberInput("monthlyExtra")}
                    </Field>
                    <Field label="Start monthly extras">
                      <input
                        type="month"
                        min={nextPaymentMonth(draft.balanceDate)}
                        value={
                          draft.extraStartMonth ||
                          nextPaymentMonth(draft.balanceDate)
                        }
                        disabled={busy || Number(draft.monthlyExtra) === 0}
                        onChange={(e) =>
                          change("extraStartMonth", e.target.value)
                        }
                        required={Number(draft.monthlyExtra) > 0}
                      />
                    </Field>
                  </div>
                  <div className="mortgage-form-actions">
                    <button
                      className="secondary-button"
                      type="submit"
                      value="preview"
                      disabled={
                        busy ||
                        !view.supportsDatedPayments ||
                        !view.supportsMonthlyEscrow
                      }
                    >
                      <Sparkles size={16} />
                      Calculate
                    </button>
                    <button
                      className="primary-button"
                      type="submit"
                      value="save"
                      disabled={
                        busy ||
                        conflict ||
                        !view.supportsDatedPayments ||
                        !view.supportsMonthlyEscrow
                      }
                    >
                      {busy ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <Save size={16} />
                      )}
                      Save plan
                    </button>
                  </div>
                  <p className="mortgage-save-hint">
                    {dirty
                      ? "Unsaved inputs · calculate to preview, or save to keep them."
                      : "Plan saved to this profile’s XML and Excel workbook."}
                  </p>
                </form>
                {view.loan && view.analysis && (
                  <HomeSaleCalculator
                    key={profileId}
                    view={view}
                    disabled={busy || conflict}
                    onSave={saveHomeSale}
                  />
                )}
              </div>
              <div className="mortgage-results">
                {current && (
                  <section
                    className="payoff-hero"
                    aria-label="Mortgage payoff summary"
                  >
                    <div className="payoff-hero-main">
                      <h2 className="payoff-hero-heading">
                        <House size={19} aria-hidden="true" />
                        Your projected debt-free day
                      </h2>
                      <strong className="payoff-hero-date">
                        {shortDate(current.accelerated.payoffDate)}
                      </strong>
                      <p className="payoff-hero-gain">
                        {current.monthsSaved > 0 && (
                          <Sparkles size={15} aria-hidden="true" />
                        )}
                        <span>
                          {current.monthsSaved > 0
                            ? `${Math.floor(current.monthsSaved / 12)} years and ${current.monthsSaved % 12} months sooner with extra principal.`
                            : "Your payoff date with the payments entered."}
                        </span>
                      </p>
                      <dl className="payoff-hero-footer">
                        <div>
                          <dt>Standard payoff</dt>
                          <dd>{shortDate(current.baseline.payoffDate)}</dd>
                        </div>
                        <div>
                          <dt>Extra principal applied</dt>
                          <dd>
                            {money(current.accelerated.extraPrincipal, 2)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="payoff-hero-savings">
                      <span className="mortgage-estimate">Estimate</span>
                      <div className="payoff-interest-saved">
                        <span
                          className="payoff-savings-icon"
                          aria-hidden="true"
                        >
                          <ArrowDownRight size={19} />
                        </span>
                        <span>Interest saved</span>
                        <strong>{money(current.interestSaved, 2)}</strong>
                        <small>Future interest avoided</small>
                      </div>
                    </div>
                  </section>
                )}
                <OneTimePayments
                  key={profileId}
                  payments={draft.oneTimePayments}
                  balanceDate={draft.balanceDate}
                  analysis={current}
                  disabled={busy}
                  supported={!!view.supportsDatedPayments}
                  canCalculate={
                    !!view.supportsDatedPayments && !!view.supportsMonthlyEscrow
                  }
                  canSave={
                    !conflict &&
                    !!view.supportsDatedPayments &&
                    !!view.supportsMonthlyEscrow
                  }
                  dirty={dirty}
                  revision={view.revision}
                  onChange={(payments) => change("oneTimePayments", payments)}
                />
                {current ? (
                  <MortgageBalanceChart
                    key={`${profileId}:${analyzedInput}`}
                    loan={input.loan}
                    analysis={current}
                  />
                ) : (
                  <div className="mortgage-empty panel">
                    <div>
                      <House size={36} />
                    </div>
                    <span className="overline">YOUR HOME. YOUR PLAN.</span>
                    <h2>
                      {analysis
                        ? "Ready to compare your new scenario?"
                        : "Every extra dollar can bring the finish line closer."}
                    </h2>
                    <p>
                      {analysis
                        ? "Your inputs changed. Calculate again to see the updated payoff date and savings."
                        : "Enter your statement details and calculate your path to being mortgage-free. Try extra payments to see how the timeline changes."}
                    </p>
                    <div className="mortgage-empty-steps">
                      <span>
                        1 <b>Add your loan</b>
                      </span>
                      <span>
                        2 <b>Explore extras</b>
                      </span>
                      <span>
                        3 <b>See the savings</b>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <EscrowPlanner
              defaultAmount={draft.monthlyEscrow}
              startDate={draft.startDate}
              balanceDate={draft.balanceDate}
              entries={draft.escrowChanges}
              projection={current?.housing}
              monthlyHousingPayment={current?.monthlyHousingPayment}
              payments={current?.accelerated.payments}
              disabled={busy}
              supported={!!view.supportsMonthlyEscrow}
              conflict={conflict}
              dirty={dirty}
              onChange={(entries) => change("escrowChanges", entries)}
            />
            <section className="panel home-improvements">
              <div className="panel-heading">
                <div>
                  <h2>
                    <Hammer size={20} />
                    Home improvements & expansion
                  </h2>
                  <p>
                    Keep renovation, extension, and repair spending in one
                    place.
                  </p>
                </div>
                <div className="improvement-total">
                  <small>All-time spending</small>
                  <strong>
                    {money(sum(view.improvements.map((e) => e.amount)), 2)}
                  </strong>
                </div>
              </div>
              <form
                className="improvement-form"
                onSubmit={(event) => void saveExpense(event)}
              >
                <Field label="Expense date">
                  <input
                    type="date"
                    min="1900-01-01"
                    max="2100-12-31"
                    value={expenseDraft.date}
                    required
                    disabled={busy}
                    onChange={(e) =>
                      setExpenseDraft((v) => ({ ...v, date: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Project">
                  <input
                    value={expenseDraft.project}
                    maxLength={80}
                    placeholder="e.g. Kitchen expansion"
                    required
                    disabled={busy}
                    onChange={(e) =>
                      setExpenseDraft((v) => ({
                        ...v,
                        project: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Description">
                  <input
                    value={expenseDraft.description}
                    maxLength={160}
                    placeholder="e.g. Cabinets and installation"
                    required
                    disabled={busy}
                    onChange={(e) =>
                      setExpenseDraft((v) => ({
                        ...v,
                        description: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Amount (USD)">
                  <input
                    type="number"
                    min="0.01"
                    max="100000000"
                    step="0.01"
                    value={expenseDraft.amount}
                    required
                    disabled={busy}
                    onChange={(e) =>
                      setExpenseDraft((v) => ({ ...v, amount: e.target.value }))
                    }
                  />
                </Field>
                <button className="primary-button" disabled={busy || conflict}>
                  <Plus size={17} />
                  {editingExpense ? "Save expense" : "Add expense"}
                </button>
                {editingExpense && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Cancel expense edit"
                    disabled={busy}
                    onClick={() => {
                      setEditingExpense(undefined);
                      setExpenseDraft({
                        date: "",
                        project: "",
                        description: "",
                        amount: "",
                      });
                    }}
                  >
                    <X size={17} />
                  </button>
                )}
              </form>
              <div className="improvement-filters">
                <label>
                  Expense year{" "}
                  <select
                    aria-label="Home expense year"
                    value={expenseYear}
                    onChange={(e) => setExpenseYear(e.target.value)}
                  >
                    <option value="all">All years</option>
                    {expenseYears.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </label>
                <span>
                  {shownExpenses.length} expenses ·{" "}
                  {money(sum(shownExpenses.map((e) => e.amount)), 2)}
                </span>
              </div>
              {shownExpenses.length ? (
                <div className="mortgage-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Project / description</th>
                        <th>Amount</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownExpenses.map((item) => (
                        <tr key={item.id}>
                          <td>{shortDate(item.date)}</td>
                          <td>
                            <strong>{item.project}</strong>
                            <small>{item.description}</small>
                          </td>
                          <td>{money(item.amount, 2)}</td>
                          <td>
                            {deletingExpense === item.id ? (
                              <div className="expense-actions">
                                <button
                                  className="danger-button"
                                  disabled={busy}
                                  onClick={() => void deleteExpense(item.id)}
                                >
                                  Remove expense
                                </button>
                                <button
                                  className="secondary-button"
                                  disabled={busy}
                                  onClick={() => setDeletingExpense(null)}
                                >
                                  Keep
                                </button>
                              </div>
                            ) : (
                              <div className="expense-actions">
                                <button
                                  className="icon-button"
                                  aria-label={`Edit ${item.project}`}
                                  disabled={busy}
                                  onClick={() => {
                                    setEditingExpense(item.id);
                                    setExpenseDraft({
                                      date: item.date,
                                      project: item.project,
                                      description: item.description,
                                      amount: String(item.amount),
                                    });
                                  }}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={`Delete ${item.project}`}
                                  disabled={busy}
                                  onClick={() => setDeletingExpense(item.id)}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="improvements-empty">
                  Add your first home improvement expense above. It stays
                  separate from your mortgage balance.
                </p>
              )}
              <p className="mortgage-save-hint">
                These costs are tracked here and in the mortgage workbook. They
                are not automatically added to the monthly budget or financed
                into the loan.
              </p>
            </section>
            <details className="mortgage-assumptions">
              <summary>How this estimate works</summary>
              {(
                current?.notes || [
                  "Fixed-rate mortgage with monthly payments. The outstanding balance is entered after a regular payment, with the next full payment one month later.",
                  "Extra payments go to principal on the selected monthly due date. Taxes, insurance, fees, prepayment penalties, and home improvement costs do not affect the payoff calculation.",
                  "The start date records when the mortgage began. We calculate future interest from your balance date, not historical interest.",
                ]
              ).map((note) => (
                <p key={note}>{note}</p>
              ))}
              <p>
                Confirm the principal balance, payment amount, interest
                convention, and any prepayment limits with your lender. This
                projection is not a lender payoff quote.{" "}
                <a
                  href="https://www.consumerfinance.gov/ask-cfpb/how-does-paying-down-a-mortgage-work-en-1943/"
                  target="_blank"
                  rel="noreferrer"
                >
                  How mortgage amortization works
                </a>{" "}
                ·{" "}
                <a
                  href="https://www.consumerfinance.gov/ask-cfpb/what-is-a-prepayment-penalty-en-1957/"
                  target="_blank"
                  rel="noreferrer"
                >
                  About prepayment penalties
                </a>
              </p>
            </details>
          </>
        )
      )}
    </section>
  );
}
