import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
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
import { motion } from "motion/react";
import { AnimatedBar, AnimatedNumber, easeOut } from "./motion";
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
const yearsMonths = (months: number) => {
  const years = Math.floor(months / 12),
    rest = months % 12;
  return (
    [
      years ? `${years} ${years === 1 ? "year" : "years"}` : "",
      rest ? `${rest} ${rest === 1 ? "month" : "months"}` : "",
    ]
      .filter(Boolean)
      .join(" ") || "0 months"
  );
};
const shortMonth = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
const monthsBetween = (a: string, b: string) => {
  const [ay, am] = a.split("-").map(Number),
    [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
};
const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: easeOut },
});
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
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const loanStart =
    draft.startDate || view?.loan?.startDate || draft.balanceDate || todayIso;
  const timeline = current
    ? (() => {
        const total = Math.max(
          1,
          monthsBetween(loanStart, current.baseline.payoffDate),
        );
        const clamp = (n: number) => Math.max(0, Math.min(100, n));
        const todayPos = clamp(
          (monthsBetween(loanStart, todayIso) / total) * 100,
        );
        const accPos = clamp(
          (monthsBetween(loanStart, current.accelerated.payoffDate) / total) *
            100,
        );
        return {
          todayPos,
          accPos,
          paid: todayPos,
          remaining: Math.max(0, accPos - todayPos),
          saved: Math.max(0, 100 - accPos),
        };
      })()
    : null;
  const oneTimeTotal = sum(draft.oneTimePayments.map((p) => Number(p.amount)));
  const extraNote = `${
    Number(draft.monthlyExtra) > 0
      ? `${money(Number(draft.monthlyExtra), 0)} a month`
      : "No monthly extra"
  }${oneTimeTotal > 0 ? ` plus ${money(oneTimeTotal, 0)} one-time` : ""}`;
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
      <motion.div className="page-heading" {...rise()}>
        <div>
          <span className="overline">Home and mortgage</span>
          <h1>Mortgage planner</h1>
          <p>
            <strong>{name}</strong>
            {view?.loan
              ? `, ${view.loan.annualRate}% fixed, ${money(
                  view.loan.monthlyPayment ?? view.analysis?.monthlyPayment ?? 0,
                  2,
                )} a month${
                  view.loan.monthlyEscrow
                    ? ` plus ${money(view.loan.monthlyEscrow, 2)} escrow`
                    : ""
                }`
              : ", enter your loan to start planning"}
          </p>
        </div>
        <div className="heading-actions">
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
          {view?.loan && (
            <a className="primary-button" href="#mortgage-one-time">
              <Plus size={17} />
              Add one-time payment
            </a>
          )}
        </div>
      </motion.div>
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
            {current && timeline && (
              <motion.section
                className="payoff-outlook"
                aria-label="Payoff outlook"
                {...rise(0.04)}
              >
                <div className="payoff-outlook-main">
                  <p className="payoff-outlook-label">Debt-free by</p>
                  <strong className="payoff-outlook-date">
                    {shortDate(current.accelerated.payoffDate)}
                  </strong>
                  <p className="payoff-outlook-gain">
                    {current.monthsSaved > 0 ? (
                      <>
                        <span className="payoff-sooner">
                          <CheckCircle2 size={13} aria-hidden="true" />
                          {yearsMonths(current.monthsSaved)} sooner
                        </span>
                        than the standard payoff in{" "}
                        {shortMonth(current.baseline.payoffDate)}
                      </>
                    ) : (
                      "Your payoff date with the payments entered. Add extra principal to bring it closer."
                    )}
                  </p>
                  <div
                    className="payoff-timeline"
                    role="img"
                    aria-label={`Timeline from the loan start in ${shortMonth(loanStart)} to the standard payoff in ${shortMonth(current.baseline.payoffDate)}. Today is ${shortMonth(todayIso)}. With extra payments the loan ends in ${shortMonth(current.accelerated.payoffDate)}.`}
                  >
                    <div className="payoff-timeline-bar">
                      <AnimatedBar percent={timeline.paid} color="#ffffff3a" />
                      <AnimatedBar
                        percent={timeline.remaining}
                        color="linear-gradient(90deg, #4263eb, #93a6fb)"
                      />
                      <AnimatedBar
                        percent={timeline.saved}
                        color="repeating-linear-gradient(135deg, #5bd0b4 0 4px, #2f8f78 4px 8px)"
                      />
                    </div>
                    <i
                      className="payoff-tick today"
                      style={{ left: `${timeline.todayPos}%` }}
                      aria-hidden="true"
                    />
                    {current.monthsSaved > 0 && (
                      <i
                        className="payoff-tick payoff"
                        style={{ left: `${timeline.accPos}%` }}
                        aria-hidden="true"
                      />
                    )}
                    {timeline.todayPos > 12 && (
                      <span className="payoff-lab start" aria-hidden="true">
                        <b>{shortMonth(loanStart)}</b>Loan start
                      </span>
                    )}
                    <span
                      className="payoff-lab today"
                      style={{ left: `${timeline.todayPos}%` }}
                      aria-hidden="true"
                    >
                      <b>Today</b>
                      {shortMonth(todayIso)}
                    </span>
                    {current.monthsSaved > 0 && timeline.accPos < 86 && (
                      <span
                        className="payoff-lab payoff"
                        style={{ left: `${timeline.accPos}%` }}
                        aria-hidden="true"
                      >
                        <b>{shortMonth(current.accelerated.payoffDate)}</b>
                        With extra principal
                      </span>
                    )}
                    <span className="payoff-lab end" aria-hidden="true">
                      <b>{shortMonth(current.baseline.payoffDate)}</b>
                      {current.monthsSaved > 0 ? "Standard payoff" : "Payoff"}
                    </span>
                  </div>
                </div>
                <dl className="payoff-outlook-stats">
                  <div>
                    <dt>Interest saved</dt>
                    <dd className="mint">
                      <AnimatedNumber
                        value={current.interestSaved}
                        format={(n) => money(n, 2)}
                      />
                    </dd>
                    <small>Future interest avoided</small>
                  </div>
                  <div>
                    <dt>Extra principal applied</dt>
                    <dd>
                      <AnimatedNumber
                        value={current.accelerated.extraPrincipal}
                        format={(n) => money(n, 0)}
                      />
                    </dd>
                    <small>{extraNote}</small>
                  </div>
                  <div>
                    <dt>Payments left</dt>
                    <dd>
                      <AnimatedNumber
                        value={current.accelerated.months}
                        format={(n) => String(Math.round(n))}
                      />
                    </dd>
                    <small>{yearsMonths(current.accelerated.months)}</small>
                  </div>
                  <div>
                    <dt>Total interest</dt>
                    <dd>
                      <AnimatedNumber
                        value={current.accelerated.interest}
                        format={(n) => money(n, 0)}
                      />
                    </dd>
                    <small>
                      instead of {money(current.baseline.interest, 0)}
                    </small>
                  </div>
                </dl>
              </motion.section>
            )}
            <motion.div
              className={`mortgage-layout ${analysis ? "has-analysis" : ""}`}
              {...rise(0.1)}
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
                        {detailsLocked
                          ? "Saved from your latest statement"
                          : "Use the principal balance from your latest statement."}
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
                  {detailsLocked && view.loan ? (
                    <div className="loan-summary" id="mortgage-detail-fields">
                      <div className="loan-tiles">
                        <div className="loan-tile">
                          <span>Balance</span>
                          <strong>{money(view.loan.balance, 0)}</strong>
                          <small>as of {shortDate(view.loan.balanceDate)}</small>
                        </div>
                        <div className="loan-tile">
                          <span>Rate</span>
                          <strong>{view.loan.annualRate}%</strong>
                          <small>
                            {view.loan.interestConvention === "MONTHLY"
                              ? "fixed, monthly"
                              : "fixed, semiannual"}
                          </small>
                        </div>
                        <div className="loan-tile">
                          <span>Payment</span>
                          <strong>
                            {money(
                              view.loan.monthlyPayment ??
                                view.analysis?.monthlyPayment ??
                                0,
                              2,
                            )}
                          </strong>
                          <small>principal and interest</small>
                        </div>
                        <div className="loan-tile">
                          <span>Escrow</span>
                          <strong>{money(view.loan.monthlyEscrow, 2)}</strong>
                          <small>taxes and insurance</small>
                        </div>
                      </div>
                      <p className="mortgage-save-hint">
                        From your latest statement.{" "}
                        <button
                          type="button"
                          className="text-link"
                          disabled={busy}
                          onClick={editDetails}
                        >
                          Edit details
                        </button>
                      </p>
                    </div>
                  ) : (
                  <fieldset
                    id="mortgage-detail-fields"
                    className="mortgage-detail-fields"
                    disabled={busy}
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
                          Fixed rate, annual rate divided by 12
                        </option>
                        <option value="CANADIAN_SEMIANNUAL">
                          Fixed rate, Canadian semiannual compounding
                        </option>
                      </select>
                    </Field>
                  </fieldset>
                  )}
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
                      ? "Unsaved inputs. Calculate to preview, or save to keep them."
                      : "Plan saved to this profile and its Excel workbook."}
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
            </motion.div>
            <motion.div {...rise(0.16)}>
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
            </motion.div>
            <motion.section className="panel home-improvements" {...rise(0.22)}>
              <div className="panel-heading">
                <div>
                  <h2>
                    <Hammer size={20} />
                    Home improvements and expansion
                  </h2>
                  <p>Renovation, extension, and repair spending in one place</p>
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
                    placeholder="Kitchen expansion"
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
                    placeholder="Cabinets and installation"
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
                  {shownExpenses.length}{" "}
                  {shownExpenses.length === 1 ? "expense" : "expenses"},{" "}
                  {money(sum(shownExpenses.map((e) => e.amount)), 2)}
                </span>
              </div>
              {shownExpenses.length ? (
                <div className="mortgage-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Project</th>
                        <th>Amount</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
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
                              <div className="expense-actions is-confirming">
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
                Tracked here and in the mortgage workbook. Not added to the
                monthly budget or financed into the loan.
              </p>
            </motion.section>
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
                and{" "}
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
