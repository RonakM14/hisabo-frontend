import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Database,
  FileSpreadsheet,
  House,
  LayoutDashboard,
  Layers3,
  LoaderCircle,
  Moon,
  Sun,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { api, ApiError } from "./api";
import {
  ACCOUNT,
  annualSeries,
  budgetSourceLabel,
  categoryMap,
  categorySpending,
  cents,
  DEFAULT_BUDGET_CATEGORIES,
  visibleBudgetCategories,
  dailySpending,
  filterTransactions,
  isRefund,
  MONTHS,
  money,
  sum,
  summarize,
} from "./data";
import type {
  Account,
  BudgetCategory,
  Category,
  ExpenseCategory,
  MonthLedger,
  Profile,
  Transaction,
  TransactionDraft,
  TransactionType,
  YearLedger,
} from "./types";
import { CashflowChart, Sparkline, SpendingDonut } from "./Charts";

import ProfileManager, { profileInitials } from "./ProfileManager";
import MortgageWorkspace from "./MortgageWorkspace";
import CategoryManager from "./CategoryManager";
import { useTheme } from "./theme";
import { AnimatePresence, motion } from "motion/react";
import {
  AnimatedBar,
  AnimatedNumber,
  easeOut,
  navSpring,
  riseIn,
  staggerGroup,
} from "./motion";
const INCOME_CATEGORIES = ["SALARY", "FREELANCE", "OTHER_INCOME"];

const today = new Date();
type DialogState =
  | { kind: "transaction"; transaction?: Transaction }
  | { kind: "budgets" }
  | { kind: "categories" }
  | { kind: "delete"; transaction: Transaction }
  | null;

function Modal({
  title,
  subtitle,
  onClose,
  busy,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal-shell"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
        transition={{ duration: 0.3 }}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <motion.div
        className="modal-card"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{
          opacity: 0,
          y: 12,
          scale: 0.98,
          transition: { duration: 0.18, ease: "easeIn" },
        }}
        transition={{ duration: 0.38, ease: easeOut }}
      >
        <header className="dialog-heading">
          <div>
            <span className="overline">HISABO WORKSPACE</span>
            <h2 id="dialog-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </motion.div>
    </dialog>
  );
}

function TransactionForm({
  categories,
  transaction,
  year,
  month,
  busy,
  error,
  onSave,
  onClose,
}: {
  categories: BudgetCategory[];
  transaction?: Transaction;
  year: number;
  month: number;
  busy: boolean;
  error: string;
  onSave: (draft: TransactionDraft, id?: string) => void;
  onClose: () => void;
}) {
  const CATEGORY = categoryMap(categories);
  const active = categories.filter((c) => c.active);
  const [amount, setAmount] = useState(String(transaction?.amount ?? ""));
  const [type, setType] = useState<TransactionType>(
    transaction?.type || (active.length ? "EXPENSE" : "INCOME"),
  );
  const [category, setCategory] = useState<Category>(
    transaction?.category || active[0]?.id || "SALARY",
  );
  const day =
    year === today.getFullYear() && month === today.getMonth() + 1
      ? today.getDate()
      : 1;
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (Number(f.get("amount")) === 0) {
      const field = e.currentTarget.elements.namedItem(
        "amount",
      ) as HTMLInputElement;
      field.setCustomValidity(
        "Enter a non-zero amount. Use a negative expense for a refund.",
      );
      field.reportValidity();
      return;
    }
    onSave(
      {
        type,
        description: String(f.get("description")).trim(),
        amount: Number(f.get("amount")),
        category,
        account: f.get("account") as Account,
        date: String(f.get("date")),
      },
      transaction?.id,
    );
  }
  return (
    <form onSubmit={submit}>
      <div className="type-switch" aria-label="Transaction type">
        {(["EXPENSE", "INCOME"] as const).map((v) => (
          <button
            type="button"
            key={v}
            className={type === v ? "selected" : ""}
            onClick={() => {
              setType(v);
              setCategory(
                v === "EXPENSE"
                  ? active[0]?.id || transaction?.category || ""
                  : "SALARY",
              );
            }}
            disabled={
              busy ||
              (v === "EXPENSE" &&
                !active.length &&
                transaction?.type !== "EXPENSE")
            }
          >
            {v === "EXPENSE" ? (
              <ArrowUpRight size={16} />
            ) : (
              <ArrowDownLeft size={16} />
            )}{" "}
            {v === "EXPENSE" ? "Expense" : "Income"}
          </button>
        ))}
      </div>
      <label className="field">
        Description
        <input
          autoFocus
          name="description"
          defaultValue={transaction?.description}
          required
          maxLength={120}
          placeholder="What was this transaction for?"
          disabled={busy}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Amount (USD)
          <input
            name="amount"
            type="number"
            min={type === "EXPENSE" ? "-10000000" : "0.01"}
            max="10000000"
            step="0.01"
            inputMode={type === "EXPENSE" ? "text" : "decimal"}
            required
            value={amount}
            onChange={(e) => {
              e.currentTarget.setCustomValidity("");
              setAmount(e.target.value);
            }}
            aria-describedby={
              type === "EXPENSE" ? "refund-amount-hint" : undefined
            }
            placeholder="0.00"
            disabled={busy}
          />
        </label>
        <label className="field">
          Date
          <input
            name="date"
            type="date"
            required
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            defaultValue={transaction?.date || date}
            disabled={busy}
          />
        </label>
      </div>
      {type === "EXPENSE" && (
        <p
          id="refund-amount-hint"
          className={`transaction-refund-hint ${Number(amount) < 0 ? "is-refund" : ""}`}
        >
          {Number(amount) < 0
            ? `Refund · ${money(Math.abs(Number(amount)), 2)} will reduce ${CATEGORY[category]?.label ?? "this category"} spending.`
            : "Enter a negative amount for a refund to this category."}
        </p>
      )}
      <div className="form-grid">
        <label className="field">
          Category
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            disabled={busy}
          >
            {(type === "EXPENSE"
              ? categories
                  .filter((c) => c.active || c.id === transaction?.category)
                  .map((c) => ({
                    ...c,
                    label: c.label + (c.active ? "" : " (removed)"),
                  }))
              : ["SALARY", "FREELANCE", "OTHER_INCOME"].map((id) => ({
                  id,
                  ...CATEGORY[id],
                }))
            ).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Account
          <select
            name="account"
            defaultValue={transaction?.account || "CHECKING"}
            disabled={busy}
          >
            {Object.entries(ACCOUNT).map(([key, value]) => (
              <option value={key} key={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          <CircleAlert size={17} />
          {error}
        </p>
      )}
      <div className="form-save-note">
        <ShieldCheck size={16} />
        Saved to your {year} ledger on this computer.
      </div>
      <div className="dialog-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button className="primary-button" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Check size={17} />
          )}{" "}
          {transaction ? "Save changes" : "Add transaction"}
        </button>
      </div>
    </form>
  );
}

function BudgetForm({
  categories,
  month,
  busy,
  error,
  onClose,
  onSave,
}: {
  categories: BudgetCategory[];
  month: MonthLedger;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (budgets: Record<ExpenseCategory, number>) => void;
}) {
  const CATEGORY = categoryMap(categories);
  const editable = visibleBudgetCategories(categories, month);
  const [budgets, setBudgets] = useState<Record<ExpenseCategory, string>>(
    Object.fromEntries(
      editable.map(({ id: c }) => [c, String(month.budgets[c] ?? 0)]),
    ) as Record<ExpenseCategory, string>,
  );
  const preview = summarize({
    ...month,
    budgets: Object.fromEntries(
      Object.entries(budgets).map(([id, value]) => [id, Number(value) || 0]),
    ),
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(
          Object.fromEntries(
            editable.map(({ id: c }) => [c, Number(budgets[c])]),
          ) as Record<ExpenseCategory, number>,
        );
      }}
    >
      <div className="budget-fields">
        {editable.map(({ id: c }) => (
          <label key={c}>
            <span>
              <i style={{ background: CATEGORY[c].color }} />
              {CATEGORY[c].label}
              {!categories.find((item) => item.id === c)?.active &&
                " (removed)"}
            </span>
            <div className="currency-input">
              <span>$</span>
              <input
                aria-label={`${CATEGORY[c].label} budget`}
                required
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                value={budgets[c]}
                onChange={(e) =>
                  setBudgets({ ...budgets, [c]: e.target.value })
                }
                disabled={busy}
              />
            </div>
          </label>
        ))}
      </div>
      <div className="budget-total">
        <span>Total monthly allocation</span>
        <strong>{money(sum(Object.values(budgets).map(Number)), 2)}</strong>
      </div>
      <div className="budget-savings-preview">
        <span>
          <PiggyBank size={17} />
          Savings <small>Income not assigned to budgets</small>
        </span>
        <strong>{money(preview.savings, 2)}</strong>
      </div>
      {preview.budgetShortfall > 0 && (
        <p className="budget-plan-warning">
          Your budget is {money(preview.budgetShortfall, 2)} above this month's
          recorded income.
        </p>
      )}
      <p className="budget-repeat-note">
        This plan repeats in the following months until you set a different
        budget. Months with their own plan stay unchanged.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
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
        <button className="primary-button" disabled={busy}>
          {busy ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Check size={17} />
          )}
          Save budgets
        </button>
      </div>
    </form>
  );
}

function SpendingCalendar({
  month,
  year,
}: {
  month: MonthLedger;
  year: number;
}) {
  const daily = dailySpending(month, year),
    start = new Date(year, month.number - 1, 1).getDay(),
    max = Math.max(...daily.map(Math.abs), 1),
    elapsed =
      year < today.getFullYear() ||
      (year === today.getFullYear() && month.number < today.getMonth() + 1)
        ? daily.length
        : year === today.getFullYear() && month.number === today.getMonth() + 1
          ? today.getDate()
          : 0,
    activeDays = daily.slice(0, elapsed).filter((n) => n > 0).length;
  return (
    <motion.section className="panel calendar-panel" variants={riseIn}>
      <div className="panel-heading">
        <div>
          <h2>Spending calendar</h2>
          <p>Hover a day to see its entries</p>
        </div>
        <span className="quiet-badge">
          <CalendarDays size={14} />
          {MONTHS[month.number - 1].slice(0, 3)}
        </span>
      </div>
      <div className="calendar-weekdays">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {Array.from({ length: start }, (_, i) => (
          <span key={`blank-${i}`} className="calendar-empty" />
        ))}
        {daily.map((amount, i) => {
          const intensity = amount
            ? Math.max(0.12, Math.sqrt(Math.abs(amount) / max))
            : 0;
          const entries = month.transactions.filter(
            (t) => t.type === "EXPENSE" && Number(t.date.slice(8)) === i + 1,
          ).length;
          const description =
            amount < 0
              ? `${money(-amount, 2)} net refund`
              : `${money(amount, 2)} net spent`;
          const isToday =
            year === today.getFullYear() &&
            month.number === today.getMonth() + 1 &&
            i + 1 === today.getDate();
          return (
            <div
              className={`calendar-day ${intensity > 0.65 ? "dark-day" : ""} ${isToday ? "today" : ""}`}
              key={i}
              tabIndex={0}
              aria-label={`${MONTHS[month.number - 1]} ${i + 1}, ${description}`}
              style={{
                background: amount
                  ? `rgba(${amount < 0 ? "20,130,108" : "66,99,235"},${intensity})`
                  : "var(--surface-muted, #f5f7fb)",
              }}
            >
              <span>{i + 1}</span>
              {amount !== 0 && (
                <small>
                  {Math.abs(amount) >= 1000
                    ? `${(amount / 1000).toFixed(1)}k`
                    : Math.round(amount)}
                </small>
              )}
              {entries > 0 && (
                <span className="calendar-tip" aria-hidden="true">
                  {entries} {entries === 1 ? "entry" : "entries"},{" "}
                  {money(Math.abs(amount), 2)}
                  {amount < 0 ? " refunded" : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="calendar-footer">
        <span>
          <strong>{activeDays}</strong> spending days,{" "}
          <strong>{elapsed - activeDays}</strong> no-spend days
        </span>
        <div className="heat-legend">
          <span>Less</span>
          {[0.08, 0.25, 0.5, 0.75, 1].map((v) => (
            <i key={v} style={{ background: `rgba(66,99,235,${v})` }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </motion.section>
  );
}

function Transactions({
  categories,
  month,
  year,
  busy,
  quickError,
  onAdd,
  onQuickAdd,
  onEdit,
  onDelete,
}: {
  categories: BudgetCategory[];
  month: MonthLedger;
  year: number;
  busy: boolean;
  quickError: string;
  onAdd: () => void;
  onQuickAdd: (draft: TransactionDraft) => Promise<boolean>;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) {
  const CATEGORY = categoryMap(categories);
  const activeCategories = categories.filter((c) => c.active);
  const defaultDate = () => {
    const day =
      year === today.getFullYear() && month.number === today.getMonth() + 1
        ? today.getDate()
        : 1;
    return `${year}-${String(month.number).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const [quickDescription, setQuickDescription] = useState(""),
    [quickAmount, setQuickAmount] = useState(""),
    [quickCategory, setQuickCategory] = useState(
      activeCategories[0]?.id ?? "SALARY",
    ),
    [quickDate, setQuickDate] = useState(defaultDate),
    [quickHint, setQuickHint] = useState("");
  useEffect(() => {
    setQuickDate(defaultDate());
    setQuickHint("");
    // The default date follows the month being viewed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month.number, year]);
  async function quickAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amount = Number(quickAmount);
    if (!amount) {
      setQuickHint("Enter a non-zero amount. A negative expense is a refund.");
      return;
    }
    setQuickHint("");
    const income = INCOME_CATEGORIES.includes(quickCategory);
    const saved = await onQuickAdd({
      type: income ? "INCOME" : "EXPENSE",
      description: quickDescription.trim(),
      amount: income ? Math.abs(amount) : amount,
      category: quickCategory,
      account: "CHECKING",
      date: quickDate,
    });
    if (saved) {
      setQuickDescription("");
      setQuickAmount("");
    }
  }
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [sort, setSort] = useState<"newest" | "oldest" | "amount">("newest"),
    [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);
  const rows = useMemo(
    () =>
      filterTransactions(
        month.transactions,
        deferredQuery,
        filter,
        sort,
        categories,
      ),
    [month, deferredQuery, filter, sort, categories],
  );
  useEffect(() => setPage(1), [query, filter, sort, month.number, year]);
  const PAGE = 10;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE)),
    current = Math.min(page, pages),
    visible = rows.slice((current - 1) * PAGE, current * PAGE);
  const groups = visible.reduce<{ date: string; rows: Transaction[] }[]>(
    (list, t) => {
      const last = list[list.length - 1];
      if (last && last.date === t.date) last.rows.push(t);
      else list.push({ date: t.date, rows: [t] });
      return list;
    },
    [],
  );
  return (
    <motion.section
      className="panel transactions-panel"
      id="transactions"
      variants={riseIn}
    >
      <div className="panel-heading">
        <div>
          <h2>
            Transaction activity{" "}
            <span className="count-pill">{month.transactions.length}</span>
          </h2>
          <p>Grouped by day, newest first</p>
        </div>
        <button className="text-button" onClick={onAdd}>
          <Plus size={16} />
          Add transaction
        </button>
      </div>
      <div className="transaction-toolbar">
        <div className="table-tabs" aria-label="Transaction type filter">
          {["ALL", "EXPENSE", "INCOME"].map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {value === "ALL"
                ? "All transactions"
                : value === "EXPENSE"
                  ? "Expenses"
                  : "Income"}
            </button>
          ))}
        </div>
        <div className="table-tools">
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label="Search transactions"
              placeholder="Search transactions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={14} />
              </button>
            )}
          </label>
          <label className="sort-select">
            <SlidersHorizontal size={15} />
            <select
              aria-label="Sort transactions"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="amount">Amount</option>
            </select>
          </label>
        </div>
      </div>
      <form className="quick-add" aria-label="Quick add" onSubmit={quickAdd}>
        <label>
          Description
          <input
            required
            maxLength={120}
            placeholder="What was this for?"
            value={quickDescription}
            onChange={(e) => setQuickDescription(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Category
          <select
            value={quickCategory}
            onChange={(e) => setQuickCategory(e.target.value)}
            disabled={busy}
          >
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
            {INCOME_CATEGORIES.map((id) => (
              <option key={id} value={id}>
                {CATEGORY[id].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Amount
          <input
            required
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0.00"
            value={quickAmount}
            onChange={(e) => setQuickAmount(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Date
          <input
            required
            type="date"
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            value={quickDate}
            onChange={(e) => setQuickDate(e.target.value)}
            disabled={busy}
          />
        </label>
        <button className="primary-button" disabled={busy}>
          {busy ? <LoaderCircle size={16} className="spin" /> : <Plus size={16} />}
          Add
        </button>
        {(quickHint || quickError) && (
          <p className="quick-add-error" role="alert">
            {quickHint || quickError}
          </p>
        )}
      </form>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Category</th>
              <th>Account</th>
              <th className="text-right">Amount</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <motion.tbody
            key={`${year}-${month.number}-${current}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {groups.map((group) => [
              <tr className="day-row" key={`day-${group.date}`}>
                <td colSpan={5}>
                  {new Date(`${group.date}T12:00:00`).toLocaleDateString(
                    "en-US",
                    { weekday: "short", month: "short", day: "numeric" },
                  )}
                </td>
              </tr>,
              ...group.rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <div className="merchant">
                    <span
                      className="merchant-icon"
                      style={{
                        background: `${CATEGORY[t.category].color}12`,
                        color: CATEGORY[t.category].color,
                      }}
                    >
                      {t.type === "INCOME" ? (
                        <ArrowDownLeft size={20} />
                      ) : (
                        t.description.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <div>
                      <strong>{t.description}</strong>
                      <span>
                        {t.type === "INCOME"
                          ? "Money received"
                          : isRefund(t)
                            ? "Refund"
                            : "Payment"}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="category-tag">
                    <i style={{ background: CATEGORY[t.category].color }} />
                    {CATEGORY[t.category].label}
                  </span>
                </td>
                <td>
                  <span className="account-name">{ACCOUNT[t.account]}</span>
                </td>
                <td
                  className={`amount-cell ${t.type === "INCOME" || isRefund(t) ? "income-amount" : ""}`}
                >
                  {t.type === "INCOME" || isRefund(t) ? "+" : "−"}
                  {money(Math.abs(t.amount), 2)}
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${t.description}`}
                      onClick={() => onEdit(t)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button delete-action"
                      aria-label={`Delete ${t.description}`}
                      onClick={() => onDelete(t)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
              )),
            ])}
          </motion.tbody>
        </table>
        {!rows.length && (
          <div className="empty-state">
            <Search size={28} />
            <h3>
              {month.transactions.length
                ? "No matching transactions"
                : "Your month starts here"}
            </h3>
            <p>
              {month.transactions.length
                ? "Try another search or filter."
                : "Add your first transaction to bring your dashboard to life."}
            </p>
            {!month.transactions.length && (
              <button className="primary-button" onClick={onAdd}>
                <Plus size={16} />
                Add transaction
              </button>
            )}
          </div>
        )}
      </div>
      <div className="table-footer">
        <span>
          {rows.length
            ? `${(current - 1) * PAGE + 1} to ${Math.min(current * PAGE, rows.length)} of ${rows.length} transactions`
            : "0 transactions"}
        </span>
        <div className="pagination">
          <button
            className="icon-button"
            aria-label="Previous page"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            {current} / {pages}
          </span>
          <button
            className="icon-button"
            aria-label="Next page"
            disabled={current >= pages}
            onClick={() => setPage(current + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
    </motion.section>
  );
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [year, setYear] = useState(today.getFullYear()),
    [month, setMonth] = useState(today.getMonth() + 1),
    [ledger, setLedger] = useState<YearLedger | null>(null),
    [years, setYears] = useState<number[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [dialogError, setDialogError] = useState(""),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<DialogState>(null),
    [range, setRange] = useState<"six" | "year">("six"),
    [toast, setToast] = useState(""),
    [navigation, setNavigation] = useState("overview"),
    [hoverCategory, setHoverCategory] = useState<string | null>(null),
    [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState(() => {
    try {
      return localStorage.getItem("hisabo.activeProfile") || "default";
    } catch {
      return "default";
    }
  });
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const loadVersion = useRef(0);
  const activeProfile = profiles.find((profile) => profile.id === profileId);
  const profileName = activeProfile?.name || "Personal";
  const [mortgageBusy, setMortgageBusy] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<"budget" | "mortgage">(
    "budget",
  );
  const isMortgage = activeProfile?.template === "MORTGAGE";
  const showMortgage = isMortgage && workspaceView === "mortgage";
  useEffect(() => {
    setWorkspaceView(
      activeProfile?.template === "MORTGAGE" ? "mortgage" : "budget",
    );
  }, [profileId, activeProfile?.template]);
  const controlsBusy = busy || profileBusy || downloading || mortgageBusy;
  const monthsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = monthsRef.current;
    if (!container) return;
    const scroll = () => {
      const active = container.querySelector<HTMLElement>(
        '[aria-selected="true"]',
      );
      if (active) {
        container.scrollLeft =
          active.offsetLeft -
          container.clientWidth / 2 +
          active.clientWidth / 2;
      }
    };
    const observer = new ResizeObserver(scroll);
    observer.observe(container);
    scroll();
    return () => observer.disconnect();
  }, [month]);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const version = ++loadVersion.current;
      setLoading(true);
      setError("");
      try {
        const profileList = await api.profiles(signal);
        if (signal?.aborted || version !== loadVersion.current) return;
        setProfiles(profileList);
        if (!profileList.some((profile) => profile.id === profileId)) {
          setProfileId("default");
          try {
            localStorage.removeItem("hisabo.activeProfile");
          } catch {
            /* Selection is optional. */
          }
          return;
        }
        const [data, list] = await Promise.all([
          api.year(profileId, year, signal),
          api.years(profileId, signal),
        ]);
        if (signal?.aborted || version !== loadVersion.current) return;
        setLedger(data);
        setYears(list.years);
      } catch (e) {
        if (!signal?.aborted && version === loadVersion.current)
          setError(
            e instanceof ApiError && e.status === 404
              ? "Restart the Java backend in IntelliJ to enable profiles, then click Refresh."
              : e instanceof Error
                ? e.message
                : "Unable to load your ledger.",
          );
      } finally {
        if (!signal?.aborted && version === loadVersion.current)
          setLoading(false);
      }
    },
    [year, profileId],
  );
  function selectProfile(profile: Profile) {
    loadVersion.current++;
    setLedger(null);
    setYears([]);
    setLastSaved(null);
    setDownloadError("");
    setDialog(null);
    setProfilesOpen(false);
    setLoading(true);
    setError("");
    try {
      localStorage.setItem("hisabo.activeProfile", profile.id);
    } catch {
      /* No ledger data is stored in the browser. */
    }
    if (profile.id === profileId) void load();
    else setProfileId(profile.id);
  }
  function profileSaved(profile: Profile, created: boolean) {
    setProfiles((previous) =>
      created
        ? [...previous, profile]
        : previous.map((item) => (item.id === profile.id ? profile : item)),
    );
    selectProfile(profile);
    setToast(
      profile.workbookWarning ||
        (created
          ? `${profile.name} is ready. Start with your first transaction.`
          : `Profile renamed to ${profile.name}.`),
    );
  }
  async function downloadExcel() {
    if (!ledger?.workbook) return;
    setDownloading(true);
    setDownloadError("");
    try {
      const blob = await api.download(profileId, year);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = ledger.workbook.fileName;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setLedger((previous) =>
        previous?.workbook
          ? { ...previous, workbook: { ...previous.workbook, warning: null } }
          : previous,
      );
      setToast(`Downloaded ${ledger.workbook.fileName}`);
    } catch (e) {
      setDownloadError(
        e instanceof Error ? e.message : "Could not download Excel.",
      );
    } finally {
      setDownloading(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    setLedger(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  function openDialog(value: DialogState) {
    if (loading || controlsBusy) return;
    setDialogError("");
    setDialog(value);
  }
  async function mutate(action: () => Promise<YearLedger>, message: string) {
    setBusy(true);
    setDialogError("");
    try {
      const result = await action();
      setLedger(result);
      setLastSaved(new Date());
      setDialog(null);
      setToast(message);
      setYears((previous) =>
        [...new Set([...previous, result.year])].sort((a, b) => b - a),
      );
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to save.";
      setDialogError(message);
      if (e instanceof ApiError && e.status === 409) {
        try {
          setLedger(await api.year(profileId, year));
        } catch {
          /* Preserve the form and show the original conflict. */
        }
      }
      return false;
    } finally {
      setBusy(false);
    }
  }
  const current = ledger?.months.find((m) => m.number === month),
    summary = current ? summarize(current) : null,
    series = ledger ? annualSeries(ledger) : [],
    yearOptions = [
      ...new Set([
        ...years,
        ...Array.from({ length: 101 }, (_, i) => 2000 + i),
      ]),
    ].sort((a, b) => b - a);
  const categories = ledger?.categories?.entries ?? DEFAULT_BUDGET_CATEGORIES;
  const CATEGORY = categoryMap(categories);
  const expenses = current
    ? visibleBudgetCategories(categories, current).map(({ id: c, active }) => ({
        active,
        category: c,
        total: categorySpending(current, c),
      }))
    : [];
  const positiveSpending = sum(expenses.map((c) => Math.max(0, c.total)));
  const hasNetRefunds = expenses.some((c) => c.total < 0);
  const previous =
    ledger && month > 1 ? summarize(ledger.months[month - 2]) : null;
  const change =
    previous && previous.expense > 0 && summary
      ? ((summary.expense - previous.expense) / previous.expense) * 100
      : null;
  const budgetUsed =
    summary && summary.budget > 0
      ? (summary.expense / summary.budget) * 100
      : 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthState =
    year < today.getFullYear() ||
    (year === today.getFullYear() && month < today.getMonth() + 1)
      ? "past"
      : year === today.getFullYear() && month === today.getMonth() + 1
        ? "current"
        : "future";
  const dayOfMonth =
    monthState === "current"
      ? today.getDate()
      : monthState === "past"
        ? daysInMonth
        : 0;
  const dayShare = (dayOfMonth / daysInMonth) * 100;
  const pace = summary
    ? {
        marker: monthState === "current" ? dayShare : null,
        text:
          summary.expense < 0
            ? `${money(-summary.expense, 2)} net refund this month`
            : !summary.budget
              ? "Set a monthly budget to get started"
              : monthState === "current"
                ? `${Math.round(budgetUsed)}% used by day ${dayOfMonth} of ${daysInMonth}, ${
                    budgetUsed > dayShare + 5
                      ? "ahead of pace"
                      : budgetUsed < dayShare - 5
                        ? "behind pace"
                        : "on pace"
                  }`
                : monthState === "past"
                  ? `${Math.round(budgetUsed)}% of ${money(summary.budget)} used`
                  : `${money(summary.budget)} planned for this month`,
      }
    : { marker: null, text: "" };
  const spentShare =
    summary && summary.income > 0
      ? Math.max(0, Math.min(100, (summary.expense / summary.income) * 100))
      : 0;
  const keptShare = summary && summary.income > 0 ? 100 - spentShare : 0;
  const budgetRows = current
    ? expenses
        .map((e) => {
          const limit = current.budgets[e.category] ?? 0;
          return { ...e, limit, left: (cents(limit) - cents(e.total)) / 100 };
        })
        .sort((a, b) => b.left - a.left)
    : [];
  const hovered = hoverCategory
    ? expenses.find((e) => e.category === hoverCategory)
    : undefined;
  useEffect(() => setHoverCategory(null), [month, year, profileId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        dialog ||
        profilesOpen ||
        showMortgage ||
        controlsBusy ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (
        target &&
        (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) ||
          target.isContentEditable ||
          target.closest('[role="tablist"]'))
      )
        return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        openDialog({ kind: "transaction" });
      } else if (e.key === "ArrowLeft")
        setMonth((m) => (m === 1 ? 12 : m - 1));
      else if (e.key === "ArrowRight")
        setMonth((m) => (m === 12 ? 1 : m + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // openDialog reads the latest state through closure each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog, profilesOpen, showMortgage, controlsBusy, loading]);
  const navigate = (id: string) => {
    if (controlsBusy) return;
    setWorkspaceView("budget");
    setNavigation(id);
    if (id === "cashflow") setRange("year");
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          onClick={() => setNavigation("overview")}
        >
          <span className="brand-mark">
            <svg
              width="23"
              height="23"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 4v16M19 4v16M5 12h14"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </span>
          Hisabo
        </a>
        <button
          className="workspace-switch"
          onClick={() => setProfilesOpen(true)}
          disabled={controlsBusy || !!dialog || profiles.length === 0}
          aria-label="Manage profiles"
        >
          <span className="workspace-icon">
            <Building2 size={20} />
          </span>
          <div>
            <strong>{profileName}</strong>
            <small>Switch or add a profile</small>
          </div>
          <ChevronDown size={14} />
        </button>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {isMortgage && (
            <button
              className={showMortgage ? "nav-item active" : "nav-item"}
              disabled={controlsBusy}
              onClick={() => setWorkspaceView("mortgage")}
            >
              {showMortgage && (
                <motion.span
                  className="nav-active-bg"
                  layoutId="nav-active"
                  transition={navSpring}
                />
              )}
              <House size={19} />
              <span>Mortgage planner</span>
              {showMortgage && (
                <motion.i layoutId="nav-dot" transition={navSpring} />
              )}
            </button>
          )}
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "transactions", label: "Transactions", icon: ArrowRight },
            { id: "budgets", label: "Budgets", icon: Wallet },
            { id: "cashflow", label: "Year in review", icon: BarChart3 },
          ].map((item) => (
            <button
              key={item.id}
              className={
                !showMortgage && navigation === item.id
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() => navigate(item.id)}
            >
              {!showMortgage && navigation === item.id && (
                <motion.span
                  className="nav-active-bg"
                  layoutId="nav-active"
                  transition={navSpring}
                />
              )}
              <item.icon size={19} />
              <span>{item.label}</span>
              {!showMortgage && navigation === item.id && (
                <motion.i layoutId="nav-dot" transition={navSpring} />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="ledger-card">
            <div className="ledger-card-icon">
              <ShieldCheck size={21} />
            </div>
            <strong>Your money. Your data.</strong>
            <p>
              One year. One ledger.
              <br />
              Always on your computer.
            </p>
            <div>
              <Database size={13} />
              <span>XML + Excel workbooks</span>
            </div>
          </div>
          <div className="local-profile">
            <span className="profile-avatar">
              {profileInitials(profileName)}
            </span>
            <div>
              <strong>{profileName}</strong>
              <small>Saved on your computer</small>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>
              {showMortgage ? "Mortgage planner" : "Financial overview"}
            </strong>
          </div>
          <div className="topbar-right">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
            <span className={`connection-status ${error ? "offline" : ""}`}>
              <i />
              {loading
                ? "Connecting…"
                : error
                  ? "Connection unavailable"
                  : "Backend connected"}
            </span>
            <span className="topbar-divider" />
            <button
              className="topbar-profile"
              onClick={() => setProfilesOpen(true)}
              disabled={controlsBusy || !!dialog || profiles.length === 0}
              aria-label={`Profiles: ${profileName}`}
            >
              <span className="profile-circle">
                {profileInitials(profileName)}
              </span>
              <span className="topbar-profile-name">{profileName}</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <div className="main-content" id="overview">
          {isMortgage && (
            <div className="profile-view-tabs" aria-label="Profile workspace">
              <button
                className={showMortgage ? "active" : ""}
                disabled={controlsBusy}
                onClick={() => setWorkspaceView("mortgage")}
              >
                <House size={17} />
                Mortgage planner
              </button>
              <button
                className={!showMortgage ? "active" : ""}
                disabled={controlsBusy}
                onClick={() => setWorkspaceView("budget")}
              >
                <Wallet size={17} />
                Monthly budget
              </button>
            </div>
          )}
          {isMortgage && (
            <div hidden={!showMortgage}>
              <MortgageWorkspace
                key={profileId}
                profileId={profileId}
                name={profileName}
                onBusyChange={setMortgageBusy}
              />
            </div>
          )}
          <div hidden={showMortgage}>
            <motion.div
              className="page-heading"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeOut }}
            >
              <div>
                <span className="overline">Your financial workspace</span>
                <h1>Financial overview</h1>
                <p>
                  <strong className="overview-profile-name">
                    {profileName}
                  </strong>
                  , saved on this computer
                </p>
              </div>
              <div className="heading-actions">
                <button
                  className="secondary-button refresh-button"
                  aria-label="Refresh from backend"
                  onClick={() => void load()}
                  disabled={loading || controlsBusy}
                >
                  <RefreshCw size={17} className={loading ? "spin" : ""} />
                  <span>Refresh</span>
                </button>
                <button
                  className="primary-button"
                  title="New transaction (N)"
                  onClick={() => openDialog({ kind: "transaction" })}
                  disabled={!ledger || loading || controlsBusy}
                >
                  <Plus size={18} />
                  New transaction
                </button>
              </div>
            </motion.div>
            <motion.div
              className="period-bar"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: easeOut }}
            >
              <label className="year-select">
                <CalendarDays size={17} />
                <select
                  aria-label="Ledger year"
                  value={year}
                  onChange={(e) => {
                    loadVersion.current++;
                    setLedger(null);
                    setLastSaved(null);
                    setDownloadError("");
                    setYear(Number(e.target.value));
                  }}
                  disabled={controlsBusy}
                >
                  {yearOptions.map((y) => (
                    <option value={y} key={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <div
                ref={monthsRef}
                className="month-tabs"
                role="tablist"
                aria-label="Months"
                onKeyDown={(e) => {
                  if (busy) return;
                  let next = month;
                  if (e.key === "ArrowRight")
                    next = month === 12 ? 1 : month + 1;
                  else if (e.key === "ArrowLeft")
                    next = month === 1 ? 12 : month - 1;
                  else if (e.key === "Home") next = 1;
                  else if (e.key === "End") next = 12;
                  else return;
                  e.preventDefault();
                  setMonth(next);
                  document.getElementById(`month-tab-${next}`)?.focus();
                }}
              >
                {MONTHS.map((name, index) => (
                  <button
                    role="tab"
                    tabIndex={month === index + 1 ? 0 : -1}
                    aria-selected={month === index + 1}
                    aria-controls="month-content"
                    id={`month-tab-${index + 1}`}
                    key={name}
                    onClick={() => setMonth(index + 1)}
                    className={month === index + 1 ? "active" : ""}
                    disabled={busy}
                  >
                    {name.slice(0, 3)}
                    {month === index + 1 && (
                      <motion.span
                        className="month-underline"
                        layoutId="month-underline"
                        transition={navSpring}
                      />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
            {(ledger?.workbook?.warning || downloadError) && (
              <div className="error-banner" role="alert">
                <CircleAlert size={21} />
                <div>
                  <strong>Excel needs attention</strong>
                  <p>{downloadError || ledger?.workbook?.warning}</p>
                </div>
              </div>
            )}
            {error && (
              <div className="error-banner" role="alert">
                <CircleAlert size={21} />
                <div>
                  <strong>We couldn’t load your ledger</strong>
                  <p>{error}</p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => void load()}
                >
                  Retry
                </button>
              </div>
            )}
            <AnimatePresence mode="wait">
            {loading && !ledger && (
              <motion.div
                key="skeleton"
                className="loading-grid"
                aria-live="polite"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="loading-message">
                  <LoaderCircle size={24} className="spin" />
                  Opening your {year} ledger…
                </div>
                {[1, 2, 3, 4].map((n) => (
                  <div className="skeleton-card" key={n} />
                ))}
                <div className="skeleton-panel" />
              </motion.div>
            )}
            {ledger && current && summary && (
              <motion.div
                key={`${profileId}-${year}`}
                id="month-content"
                role="tabpanel"
                aria-labelledby={`month-tab-${month}`}
                className={`dashboard-content ${loading ? "refreshing" : ""}`}
                variants={staggerGroup}
                initial="hidden"
                animate="show"
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
              >
                <motion.div className="profile-workbook-bar" variants={riseIn}>
                  <div>
                    <span className="workbook-icon">
                      <FileSpreadsheet size={20} />
                    </span>
                    <span>
                      <strong>
                        {ledger.workbook?.fileName ||
                          `${profileName} · ${year}`}
                      </strong>
                      <small>Your workbook, with a tab for each month</small>
                    </span>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={controlsBusy || loading || !ledger.workbook}
                    onClick={() => void downloadExcel()}
                  >
                    {downloading ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      <FileSpreadsheet size={16} />
                    )}
                    <span>{downloading ? "Preparing…" : "Download Excel"}</span>
                  </button>
                </motion.div>
                <motion.div className="period-caption" variants={riseIn}>
                  <h2>
                    <motion.span
                      key={`${year}-${month}`}
                      className="period-month"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, ease: easeOut }}
                    >
                      {MONTHS[month - 1]}
                    </motion.span>{" "}
                    <span>{year}</span>
                  </h2>
                  <div>
                    <span className="save-status">
                      <CheckCircle2 size={14} />
                      {lastSaved
                        ? `Saved at ${lastSaved.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                        : "Loaded from your ledger"}
                    </span>
                    {ledger.demo && (
                      <span className="demo-pill">Sample ledger</span>
                    )}
                  </div>
                </motion.div>
                {current.transactions.length ? (
                <>
                <motion.section
                  className="metrics-grid"
                  aria-label="Monthly financial totals"
                  variants={staggerGroup}
                >
                  <motion.article
                    className="metric-card balance-metric hero-metric"
                    variants={riseIn}
                  >
                    <div className="metric-label">
                      Net cash flow
                      <span>
                        <Wallet size={17} />
                      </span>
                    </div>
                    <div className="metric-value">
                      <AnimatedNumber
                        value={summary.balance}
                        format={(n) => money(n, 2)}
                      />
                    </div>
                    <div className="split-bar" aria-hidden="true">
                      <AnimatedBar
                        percent={spentShare}
                        color="var(--chart-expense, #24aa97)"
                      />
                      <AnimatedBar percent={keptShare} color="#93b4ff" />
                    </div>
                    <div className="split-detail">
                      <span>
                        Spent{" "}
                        <strong>
                          <AnimatedNumber
                            value={summary.expense}
                            format={(n) => money(n, 2)}
                          />
                        </strong>{" "}
                        <em>of income</em>{" "}
                        <strong>
                          <AnimatedNumber
                            value={summary.income}
                            format={(n) => money(n, 2)}
                          />
                        </strong>
                      </span>
                      <span>
                        <i />
                        {summary.income
                          ? `Kept ${summary.savingsRate.toFixed(1)}%`
                          : "No income recorded"}
                      </span>
                    </div>
                  </motion.article>
                  <motion.article className="metric-card" variants={riseIn}>
                    <div className="metric-label">
                      Monthly spending
                      <span className="metric-icon lavender">
                        <ArrowUpRight size={18} />
                      </span>
                    </div>
                    <div className="metric-value">
                      <AnimatedNumber
                        value={summary.expense}
                        format={(n) => money(n, 2)}
                      />
                    </div>
                    <div className="metric-bottom">
                      <span
                        className={
                          change !== null && change > 0
                            ? "change-amber"
                            : "change-green"
                        }
                      >
                        {change === null
                          ? "No earlier month to compare"
                          : `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs. ${MONTHS[month - 2].slice(0, 3)}`}
                      </span>
                      <Sparkline
                        values={series.slice(0, month).map((s) => s.expense)}
                        color="#8b6cef"
                      />
                    </div>
                    <div className="metric-footnote">
                      {
                        current.transactions.filter((t) => t.type === "EXPENSE")
                          .length
                      }{" "}
                      expense transactions
                    </div>
                  </motion.article>
                  <motion.article className="metric-card" variants={riseIn}>
                    <div className="metric-label">
                      Budget remaining
                      <span className="metric-icon blue">
                        <Target size={18} />
                      </span>
                    </div>
                    <div
                      className={`metric-value ${summary.remaining < 0 ? "over-budget" : ""}`}
                    >
                      <AnimatedNumber
                        value={summary.remaining}
                        format={(n) => money(n, 2)}
                      />
                    </div>
                    <div className="pace-ruler">
                      <div className="budget-mini-track">
                        <AnimatedBar
                          percent={budgetUsed}
                          color={budgetUsed > 100 ? "#df7469" : undefined}
                        />
                      </div>
                      {pace.marker !== null && (
                        <>
                          <i
                            className="pace-today"
                            style={{ left: `${pace.marker}%` }}
                            aria-hidden="true"
                          />
                          <span
                            className="pace-today-label"
                            style={{ left: `${pace.marker}%` }}
                          >
                            Today
                          </span>
                        </>
                      )}
                    </div>
                    <div className="metric-footnote">{pace.text}</div>
                  </motion.article>
                  <motion.article className="metric-card" variants={riseIn}>
                    <div className="metric-label">
                      Savings rate
                      <span className="metric-icon mint">
                        <TrendingUp size={18} />
                      </span>
                    </div>
                    <div className="metric-value">
                      {summary.income ? (
                        <AnimatedNumber
                          value={summary.savingsRate}
                          format={(n) => n.toFixed(1)}
                        />
                      ) : (
                        "—"
                      )}
                      <small>{summary.income ? "%" : ""}</small>
                    </div>
                    <div className="metric-bottom">
                      <span className="change-green">
                        {summary.income
                          ? `${money(summary.balance)} kept`
                          : "Add income to calculate"}
                      </span>
                      <Sparkline
                        values={series
                          .slice(0, month)
                          .map((s) => s.savingsRate)}
                        color="#20aa91"
                      />
                    </div>
                    <div className="metric-footnote">
                      Unspent income as a share of income
                    </div>
                  </motion.article>
                </motion.section>
                <motion.div className="charts-row" variants={staggerGroup}>
                  <motion.section
                    className="panel cashflow-panel"
                    id="cashflow"
                    variants={riseIn}
                  >
                    <div className="panel-heading">
                      <div>
                        <h2>Cash flow</h2>
                        <p>Income and spending by month</p>
                      </div>
                      <div className="segmented-control">
                        <button
                          className={range === "six" ? "selected" : ""}
                          onClick={() => setRange("six")}
                        >
                          6 months
                        </button>
                        <button
                          className={range === "year" ? "selected" : ""}
                          onClick={() => setRange("year")}
                        >
                          Full year
                        </button>
                      </div>
                    </div>
                    <div className="cashflow-summary">
                      <div>
                        <span>
                          Income{" "}
                          <i
                            style={{
                              background: "var(--chart-income, #4263eb)",
                            }}
                          />
                        </span>
                        <strong>
                          <AnimatedNumber
                            format={money}
                            value={sum(
                              series
                                .slice(
                                  range === "six" ? Math.max(0, month - 6) : 0,
                                  range === "six" ? month : 12,
                                )
                                .map((s) => s.income),
                            )}
                          />
                        </strong>
                      </div>
                      <div>
                        <span>
                          Expenses{" "}
                          <i
                            style={{
                              background: "var(--chart-expense, #24aa97)",
                            }}
                          />
                        </span>
                        <strong>
                          <AnimatedNumber
                            format={money}
                            value={sum(
                              series
                                .slice(
                                  range === "six" ? Math.max(0, month - 6) : 0,
                                  range === "six" ? month : 12,
                                )
                                .map((s) => s.expense),
                            )}
                          />
                        </strong>
                      </div>
                      <span className="chart-period">
                        {range === "year"
                          ? `Jan to Dec ${year}`
                          : `${MONTHS[Math.max(0, month - 6)].slice(0, 3)} to ${MONTHS[month - 1].slice(0, 3)} ${year}`}
                      </span>
                    </div>
                    <CashflowChart
                      ledger={ledger}
                      month={month}
                      range={range}
                    />
                  </motion.section>
                  <motion.section
                    className="panel breakdown-panel"
                    variants={riseIn}
                  >
                    <div className="panel-heading">
                      <div>
                        <h2>Spending breakdown</h2>
                        <p>Hover a category to see its share</p>
                      </div>
                      <span className="soft-icon">
                        <Layers3 size={18} />
                      </span>
                    </div>
                    <div className="donut-container">
                      <SpendingDonut
                        month={current}
                        categories={categories}
                        highlighted={hoverCategory}
                        onHover={setHoverCategory}
                      />
                      <div className="donut-label">
                        <span>
                          {hovered ? CATEGORY[hovered.category].label : "Net expenses"}
                        </span>
                        <strong>
                          {hovered ? (
                            money(hovered.total, 2)
                          ) : (
                            <AnimatedNumber value={summary.expense} format={money} />
                          )}
                        </strong>
                        <small>
                          {hovered
                            ? hovered.total < 0
                              ? "Net refund"
                              : `${positiveSpending ? Math.round((hovered.total / positiveSpending) * 100) : 0}% of spending`
                            : `${expenses.filter((c) => c.total > 0).length} categories`}
                        </small>
                      </div>
                    </div>
                    <div className="category-legend">
                      {expenses.map(({ category: c, total }) => (
                        <div
                          key={c}
                          className={
                            hoverCategory && hoverCategory !== c ? "dim" : ""
                          }
                          onMouseEnter={() => setHoverCategory(c)}
                          onMouseLeave={() => setHoverCategory(null)}
                        >
                          <span>
                            <i style={{ background: CATEGORY[c].color }} />
                            {CATEGORY[c].label}
                          </span>
                          <strong>{money(total)}</strong>
                          <small>
                            {total < 0
                              ? "Refund"
                              : `${positiveSpending ? Math.round((total / positiveSpending) * 100) : 0}%`}
                          </small>
                        </div>
                      ))}
                    </div>
                    {hasNetRefunds && (
                      <p className="refund-chart-note">
                        Refund credits are included in the total. The ring shows
                        categories with net spending.
                      </p>
                    )}
                  </motion.section>
                </motion.div>
                <motion.div className="detail-row" variants={staggerGroup}>
                  <motion.section
                    className="panel budgets-panel"
                    id="budgets"
                    variants={riseIn}
                  >
                    <div className="panel-heading">
                      <div>
                        <h2>Budget performance</h2>
                        <p>Sorted by what's left this month</p>
                      </div>
                      <div className="budget-header-actions">
                        <button
                          className="text-button"
                          onClick={() => openDialog({ kind: "budgets" })}
                        >
                          <Pencil size={15} />
                          Edit budgets
                        </button>
                        <button
                          className="text-button"
                          onClick={() => openDialog({ kind: "categories" })}
                        >
                          <SlidersHorizontal size={15} />
                          Manage categories
                        </button>
                      </div>
                    </div>
                    <p className="budget-carry-note">
                      <RefreshCw size={13} />
                      {current.budgetOrigin === "CARRIED" &&
                      current.budgetSource
                        ? `Carried from ${budgetSourceLabel(current.budgetSource)}. Edit for this month.`
                        : current.budgetOrigin === "MANUAL"
                          ? "This plan repeats in following months"
                          : "Set a budget once. It repeats each month."}
                    </p>
                    <div className="budget-table-header">
                      <span>Category</span>
                      <span>Left this month</span>
                    </div>
                    {!expenses.length && (
                      <div className="category-empty">
                        <Layers3 size={24} />
                        <p>Add a category to start planning your budget.</p>
                        <button
                          className="secondary-button"
                          onClick={() => openDialog({ kind: "categories" })}
                        >
                          Add a category
                        </button>
                      </div>
                    )}
                    <div className="budget-rows">
                      {budgetRows.map(({ category: c, total, active, limit, left }) => {
                        const used = limit
                          ? (total / limit) * 100
                          : total > 0
                            ? 100
                            : 0;
                        return (
                          <button
                            key={c}
                            className="budget-row"
                            onClick={() => openDialog({ kind: "budgets" })}
                            aria-label={`Edit ${CATEGORY[c].label} budget, ${money(total)} spent of ${money(limit)}`}
                          >
                            <div className="budget-row-title">
                              <span
                                className="category-square"
                                style={{
                                  color: CATEGORY[c].color,
                                  background: `${CATEGORY[c].color}14`,
                                }}
                              >
                                {CATEGORY[c].label.slice(0, 1)}
                              </span>
                              <strong>
                                {CATEGORY[c].label}
                                {!active && (
                                  <small className="removed-category-label">
                                    Removed · history kept
                                  </small>
                                )}
                              </strong>
                              <span
                                className={
                                  left < 0 || (left === 0 && total > 0)
                                    ? "over-budget"
                                    : ""
                                }
                              >
                                {total < 0
                                  ? "Credit"
                                  : left > 0
                                    ? `${money(left, 2)} left`
                                    : limit
                                      ? left === 0
                                        ? "Nothing left"
                                        : `Over by ${money(-left, 2)}`
                                      : total
                                        ? "No budget set"
                                        : "—"}
                              </span>
                            </div>
                            <div className="budget-row-bottom">
                              <div className="progress-track">
                                <AnimatedBar
                                  percent={used}
                                  color={
                                    total > limit ? "#df7469" : CATEGORY[c].color
                                  }
                                />
                              </div>
                              <span>
                                {money(total)} / {money(limit)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="budget-savings-row">
                      <span className="budget-savings-icon">
                        <PiggyBank size={21} />
                      </span>
                      <div>
                        <strong>Savings</strong>
                        <small>Income not assigned to category budgets</small>
                      </div>
                      <strong>
                        <AnimatedNumber
                          value={summary.savings}
                          format={(n) => money(n, 2)}
                        />
                      </strong>
                    </div>
                    {summary.budgetShortfall > 0 && (
                      <p className="budget-plan-warning budget-panel-warning">
                        Budget allocations exceed recorded income by{" "}
                        {money(summary.budgetShortfall, 2)}.
                      </p>
                    )}
                    {!summary.income && (
                      <p className="budget-savings-help">
                        Add this month's income to calculate unassigned savings.
                      </p>
                    )}
                    <div
                      className={`budget-insight ${summary.remaining < 0 ? "warning" : ""}`}
                    >
                      <Sparkles size={17} />
                      <span>
                        {summary.budget === 0
                          ? "Give every dollar a purpose. Set your first budget."
                          : summary.remaining >= 0
                            ? `${money(summary.remaining)} of breathing room in your monthly plan.`
                            : `Spending is ${money(-summary.remaining)} above your monthly plan.`}
                      </span>
                    </div>
                  </motion.section>
                  <SpendingCalendar month={current} year={year} />
                </motion.div>
                <Transactions
                  categories={categories}
                  month={current}
                  year={year}
                  busy={busy}
                  quickError={dialog ? "" : dialogError}
                  onAdd={() => openDialog({ kind: "transaction" })}
                  onQuickAdd={(draft) =>
                    mutate(
                      () =>
                        api.saveTransaction(
                          profileId,
                          year,
                          ledger.revision,
                          draft,
                        ),
                      "Transaction added and saved.",
                    )
                  }
                  onEdit={(transaction) =>
                    openDialog({ kind: "transaction", transaction })
                  }
                  onDelete={(transaction) =>
                    openDialog({ kind: "delete", transaction })
                  }
                />
                </>
                ) : (
                  <motion.section
                    className="panel empty-month"
                    variants={riseIn}
                    aria-label="Empty month"
                  >
                    <span className="soft-icon">
                      <CalendarPlus size={26} />
                    </span>
                    <h2>{MONTHS[month - 1]} has no entries yet</h2>
                    <p>
                      {summary.budget
                        ? `Your ${money(summary.budget)} budget plan${
                            current.budgetOrigin === "CARRIED" &&
                            current.budgetSource
                              ? ` from ${budgetSourceLabel(current.budgetSource)}`
                              : ""
                          } carries into this month. Add the first transaction to bring the overview to life.`
                        : "Add the first transaction to bring the overview to life, then set a budget to plan the month."}
                    </p>
                    <div className="empty-month-actions">
                      <button
                        className="primary-button"
                        onClick={() => openDialog({ kind: "transaction" })}
                        disabled={controlsBusy}
                      >
                        <Plus size={17} />
                        Add first transaction
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => openDialog({ kind: "budgets" })}
                        disabled={controlsBusy}
                      >
                        Edit this month's budget
                      </button>
                    </div>
                  </motion.section>
                )}
                <motion.footer className="page-footer" variants={riseIn}>
                  <span>
                    <ShieldCheck size={15} />
                    Your data stays on your computer.
                  </span>
                  <span>Hisabo, {year} ledger, USD</span>
                </motion.footer>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </main>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {[
          { id: "overview", label: "Overview", icon: LayoutDashboard },
          { id: "transactions", label: "Activity", icon: ArrowRight },
          { id: "budgets", label: "Budgets", icon: Wallet },
        ].map((item) => (
          <button
            key={item.id}
            className={navigation === item.id ? "active" : ""}
            onClick={() => navigate(item.id)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <AnimatePresence>
      {profilesOpen && (
        <Modal
          key="profiles"
          title="Your profiles"
          subtitle="One app. A separate space for each budget."
          busy={profileBusy}
          onClose={() => setProfilesOpen(false)}
        >
          <ProfileManager
            profiles={profiles}
            activeId={profileId}
            busy={profileBusy}
            setBusy={setProfileBusy}
            onSelect={selectProfile}
            onSaved={profileSaved}
          />
        </Modal>
      )}
      </AnimatePresence>
      <AnimatePresence>
      {dialog && ledger && current && (
        <Modal
          key="dialog"
          title={
            dialog.kind === "transaction"
              ? dialog.transaction
                ? "Edit transaction"
                : "New transaction"
              : dialog.kind === "categories"
                ? "Manage categories"
                : dialog.kind === "budgets"
                  ? "Shape your monthly budget"
                  : "Delete transaction?"
          }
          subtitle={
            dialog.kind === "transaction"
              ? "A clear record starts with the details."
              : dialog.kind === "categories"
                ? `${profileName} · Categories apply across all months and years`
                : dialog.kind === "budgets"
                  ? `${MONTHS[month - 1]} ${year} · Spending limits in USD`
                  : "This removes the transaction from your saved ledger."
          }
          busy={busy}
          onClose={() => setDialog(null)}
        >
          {dialog.kind === "transaction" ? (
            <TransactionForm
              categories={categories}
              transaction={dialog.transaction}
              year={year}
              month={month}
              busy={busy}
              error={dialogError}
              onClose={() => setDialog(null)}
              onSave={(draft, id) =>
                void mutate(
                  () =>
                    api.saveTransaction(
                      profileId,
                      year,
                      ledger.revision,
                      draft,
                      id,
                    ),
                  id
                    ? "Transaction updated and saved."
                    : "Transaction added and saved.",
                )
              }
            />
          ) : dialog.kind === "categories" ? (
            <CategoryManager
              supported={!!ledger.categories}
              catalog={
                ledger.categories ?? { revision: 0, entries: categories }
              }
              busy={busy}
              error={dialogError}
              onClose={() => setDialog(null)}
              onSave={(catalog) =>
                void mutate(
                  () => api.categories(profileId, year, catalog),
                  "Budget categories saved for this profile.",
                )
              }
            />
          ) : dialog.kind === "budgets" ? (
            <BudgetForm
              categories={categories}
              month={current}
              busy={busy}
              error={dialogError}
              onClose={() => setDialog(null)}
              onSave={(budgets) =>
                void mutate(
                  () =>
                    api.budgets(
                      profileId,
                      year,
                      month,
                      ledger.revision,
                      budgets,
                    ),
                  "Budget saved. Following months will use this plan unless they have their own budget.",
                )
              }
            />
          ) : (
            <div>
              <div className="delete-summary">
                <span>{dialog.transaction.description}</span>
                <strong>{money(dialog.transaction.amount, 2)}</strong>
              </div>
              {dialogError && (
                <p className="form-error" role="alert">
                  {dialogError}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  className="secondary-button"
                  onClick={() => setDialog(null)}
                  disabled={busy}
                >
                  Keep transaction
                </button>
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={() =>
                    void mutate(
                      () =>
                        api.deleteTransaction(
                          profileId,
                          year,
                          ledger.revision,
                          dialog.transaction.id,
                        ),
                      "Transaction deleted and ledger saved.",
                    )
                  }
                >
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  Delete transaction
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 18, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 10, x: "-50%", transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            <CheckCircle2 size={20} />
            {toast}
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
