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
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Database,
  LayoutDashboard,
  Layers3,
  LoaderCircle,
  Pencil,
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
  CATEGORY,
  dailySpending,
  EXPENSE_CATEGORIES,
  filterTransactions,
  MONTHS,
  money,
  sum,
  summarize,
} from "./data";
import type {
  Account,
  Category,
  ExpenseCategory,
  MonthLedger,
  Transaction,
  TransactionDraft,
  TransactionType,
  YearLedger,
} from "./types";
import { CashflowChart, Sparkline, SpendingDonut } from "./Charts";

const today = new Date();
type DialogState =
  | { kind: "transaction"; transaction?: Transaction }
  | { kind: "budgets" }
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
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) {
          const b = ref.current!.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            onClose();
        }
      }}
    >
      <header className="dialog-heading">
        <div>
          <span className="overline">LEDGERONE WORKSPACE</span>
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
    </dialog>
  );
}

function TransactionForm({
  transaction,
  year,
  month,
  busy,
  error,
  onSave,
  onClose,
}: {
  transaction?: Transaction;
  year: number;
  month: number;
  busy: boolean;
  error: string;
  onSave: (draft: TransactionDraft, id?: string) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<TransactionType>(
    transaction?.type || "EXPENSE",
  );
  const [category, setCategory] = useState<Category>(
    transaction?.category || "FOOD",
  );
  const day =
    year === today.getFullYear() && month === today.getMonth() + 1
      ? today.getDate()
      : 1;
  const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
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
              setCategory(v === "EXPENSE" ? "FOOD" : "SALARY");
            }}
            disabled={busy}
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
            min="0.01"
            max="10000000"
            step="0.01"
            inputMode="decimal"
            required
            defaultValue={transaction?.amount}
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
      <div className="form-grid">
        <label className="field">
          Category
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            disabled={busy}
          >
            {Object.entries(CATEGORY)
              .filter(([key]) =>
                type === "EXPENSE"
                  ? EXPENSE_CATEGORIES.includes(key as ExpenseCategory)
                  : !EXPENSE_CATEGORIES.includes(key as ExpenseCategory),
              )
              .map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
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
  month,
  busy,
  error,
  onClose,
  onSave,
}: {
  month: MonthLedger;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (budgets: Record<ExpenseCategory, number>) => void;
}) {
  const [budgets, setBudgets] = useState<Record<ExpenseCategory, string>>(
    Object.fromEntries(
      EXPENSE_CATEGORIES.map((c) => [c, String(month.budgets[c])]),
    ) as Record<ExpenseCategory, string>,
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(
          Object.fromEntries(
            EXPENSE_CATEGORIES.map((c) => [c, Number(budgets[c])]),
          ) as Record<ExpenseCategory, number>,
        );
      }}
    >
      <div className="budget-fields">
        {EXPENSE_CATEGORIES.map((c) => (
          <label key={c}>
            <span>
              <i style={{ background: CATEGORY[c].color }} />
              {CATEGORY[c].label}
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
    max = Math.max(...daily, 1),
    elapsed =
      year < today.getFullYear() ||
      (year === today.getFullYear() && month.number < today.getMonth() + 1)
        ? daily.length
        : year === today.getFullYear() && month.number === today.getMonth() + 1
          ? today.getDate()
          : 0,
    activeDays = daily.slice(0, elapsed).filter((n) => n > 0).length;
  return (
    <section className="panel calendar-panel">
      <div className="panel-heading">
        <div>
          <h2>Spending calendar</h2>
          <p>A daily view of where your money goes.</p>
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
            ? Math.max(0.12, Math.sqrt(amount / max))
            : 0;
          return (
            <div
              className={`calendar-day ${intensity > 0.65 ? "dark-day" : ""}`}
              key={i}
              tabIndex={0}
              title={`${MONTHS[month.number - 1]} ${i + 1}: ${money(amount, 2)} spent`}
              aria-label={`${MONTHS[month.number - 1]} ${i + 1}, ${money(amount, 2)} spent`}
              style={{
                background: amount ? `rgba(66,99,235,${intensity})` : "#f5f7fb",
              }}
            >
              <span>{i + 1}</span>
              {amount > 0 && (
                <small>
                  {amount >= 1000
                    ? `${(amount / 1000).toFixed(1)}k`
                    : Math.round(amount)}
                </small>
              )}
            </div>
          );
        })}
      </div>
      <div className="calendar-footer">
        <span>
          <strong>{activeDays}</strong> spending days{" "}
          <span className="separator-dot">·</span>{" "}
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
    </section>
  );
}

function Transactions({
  month,
  year,
  onAdd,
  onEdit,
  onDelete,
}: {
  month: MonthLedger;
  year: number;
  onAdd: () => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("ALL"),
    [sort, setSort] = useState<"newest" | "oldest" | "amount">("newest"),
    [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);
  const rows = useMemo(
    () => filterTransactions(month.transactions, deferredQuery, filter, sort),
    [month, deferredQuery, filter, sort],
  );
  useEffect(() => setPage(1), [query, filter, sort, month.number, year]);
  const pages = Math.max(1, Math.ceil(rows.length / 7)),
    current = Math.min(page, pages),
    visible = rows.slice((current - 1) * 7, current * 7);
  return (
    <section className="panel transactions-panel" id="transactions">
      <div className="panel-heading">
        <div>
          <h2>
            Transaction activity{" "}
            <span className="count-pill">{month.transactions.length}</span>
          </h2>
          <p>Every movement, in one place.</p>
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
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>TRANSACTION</th>
              <th>CATEGORY</th>
              <th>ACCOUNT</th>
              <th>DATE</th>
              <th className="text-right">AMOUNT</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => (
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
                        {t.type === "INCOME" ? "Money received" : "Payment"}
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
                <td className="date-cell">
                  {new Date(`${t.date}T12:00:00`).toLocaleDateString("en-US", {
                    month: "short",
                    day: "2-digit",
                  })}
                </td>
                <td
                  className={`amount-cell ${t.type === "INCOME" ? "income-amount" : ""}`}
                >
                  {t.type === "INCOME" ? "+" : "−"}
                  {money(t.amount, 2)}
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
            ))}
          </tbody>
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
            ? `${(current - 1) * 7 + 1}–${Math.min(current * 7, rows.length)} of ${rows.length} transactions`
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
    </section>
  );
}

export default function App() {
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
    [lastSaved, setLastSaved] = useState<Date | null>(null);
  const monthsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = monthsRef.current;
    if (!container) return;
    const scroll = () => {
      const active = container.querySelector<HTMLElement>(
        '[aria-selected="true"]',
      );
      if (active)
        container.scrollTo({
          left:
            active.offsetLeft -
            container.offsetLeft -
            container.clientWidth / 2 +
            active.clientWidth / 2,
          behavior: "instant",
        });
    };
    const observer = new ResizeObserver(scroll);
    observer.observe(container);
    scroll();
    return () => observer.disconnect();
  }, [month]);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const [data, list] = await Promise.all([
          api.year(year, signal),
          api.years(signal),
        ]);
        setLedger(data);
        setYears(list.years);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError"))
          setError(
            e instanceof Error ? e.message : "Unable to load your ledger.",
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [year],
  );
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
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unable to save.";
      setDialogError(message);
      if (e instanceof ApiError && e.status === 409) {
        try {
          setLedger(await api.year(year));
        } catch {
          /* Preserve the form and show the original conflict. */
        }
      }
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
  const expenses = current
    ? EXPENSE_CATEGORIES.map((c) => ({
        category: c,
        total: sum(
          current.transactions
            .filter((t) => t.category === c)
            .map((t) => t.amount),
        ),
      }))
    : [];
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
  const navigate = (id: string) => {
    setNavigation(id);
    if (id === "cashflow") setRange("year");
    document
      .getElementById(id)
      ?.scrollIntoView({
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
            <Layers3 size={23} />
          </span>
          Ledger<span>One</span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-icon">
            <Building2 size={20} />
          </span>
          <div>
            <strong>Personal workspace</strong>
            <small>Your financial command center</small>
          </div>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {[
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "transactions", label: "Transactions", icon: ArrowRight },
            { id: "budgets", label: "Budgets", icon: Wallet },
            { id: "cashflow", label: "Year in review", icon: BarChart3 },
          ].map((item) => (
            <button
              key={item.id}
              className={
                navigation === item.id ? "nav-item active" : "nav-item"
              }
              onClick={() => navigate(item.id)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {navigation === item.id && <i />}
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
              <span>XML persistence</span>
            </div>
          </div>
          <div className="local-profile">
            <span className="profile-avatar">L</span>
            <div>
              <strong>Local workspace</strong>
              <small>Personal edition</small>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>Financial overview</strong>
          </div>
          <div className="topbar-right">
            <span className={`connection-status ${error ? "offline" : ""}`}>
              <i />
              {loading
                ? "Connecting…"
                : error
                  ? "Connection unavailable"
                  : "Backend connected"}
            </span>
            <span className="topbar-divider" />
            <span className="profile-circle">L</span>
          </div>
        </header>
        <div className="main-content" id="overview">
          <div className="page-heading">
            <div>
              <span className="overline">YOUR FINANCIAL WORKSPACE</span>
              <h1>
                Financial overview<span>.</span>
              </h1>
              <p>Clarity today. Confidence for what’s next.</p>
            </div>
            <div className="heading-actions">
              <button
                className="secondary-button refresh-button"
                aria-label="Refresh from backend"
                onClick={() => void load()}
                disabled={loading || busy}
              >
                <RefreshCw size={17} className={loading ? "spin" : ""} />
                <span>Refresh</span>
              </button>
              <button
                className="primary-button"
                onClick={() => openDialog({ kind: "transaction" })}
                disabled={!ledger || loading || busy}
              >
                <Plus size={18} />
                New transaction
              </button>
            </div>
          </div>
          <div className="period-bar">
            <label className="year-select">
              <CalendarDays size={17} />
              <select
                aria-label="Ledger year"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                disabled={busy}
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
                if (e.key === "ArrowRight") next = month === 12 ? 1 : month + 1;
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
                </button>
              ))}
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <CircleAlert size={21} />
              <div>
                <strong>We couldn’t load your ledger</strong>
                <p>{error}</p>
              </div>
              <button className="secondary-button" onClick={() => void load()}>
                Retry
              </button>
            </div>
          )}
          {loading && !ledger && (
            <div className="loading-grid" aria-live="polite">
              <div className="loading-message">
                <LoaderCircle size={24} className="spin" />
                Opening your {year} ledger…
              </div>
              {[1, 2, 3, 4].map((n) => (
                <div className="skeleton-card" key={n} />
              ))}
              <div className="skeleton-panel" />
            </div>
          )}
          {ledger && current && summary && (
            <div
              id="month-content"
              role="tabpanel"
              aria-labelledby={`month-tab-${month}`}
              className={`dashboard-content ${loading ? "refreshing" : ""}`}
            >
              <div className="period-caption">
                <h2>
                  {MONTHS[month - 1]} <span>{year}</span>
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
              </div>
              <section
                className="metrics-grid"
                aria-label="Monthly financial totals"
              >
                <article className="metric-card balance-metric">
                  <div className="metric-label">
                    Net cash flow
                    <span>
                      <Wallet size={17} />
                    </span>
                  </div>
                  <div className="metric-value">
                    {money(summary.balance, 2)}
                  </div>
                  <div className="metric-bottom">
                    <span>
                      <i />
                      Income minus expenses
                    </span>
                    <Sparkline
                      values={series.slice(0, month).map((s) => s.balance)}
                      color="#93b4ff"
                    />
                  </div>
                  <div className="balance-detail">
                    <span>
                      Income<strong>{money(summary.income)}</strong>
                    </span>
                    <span>
                      Expenses<strong>{money(summary.expense)}</strong>
                    </span>
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-label">
                    Monthly spending
                    <span className="metric-icon lavender">
                      <ArrowUpRight size={18} />
                    </span>
                  </div>
                  <div className="metric-value">
                    {money(summary.expense, 2)}
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
                        ? "No prior month comparison"
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
                    expense transactions this month
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-label">
                    Budget remaining
                    <span className="metric-icon blue">
                      <Target size={18} />
                    </span>
                  </div>
                  <div
                    className={`metric-value ${summary.remaining < 0 ? "over-budget" : ""}`}
                  >
                    {money(summary.remaining, 2)}
                  </div>
                  <div className="budget-mini-track">
                    <span
                      style={{
                        width: `${Math.min(100, budgetUsed)}%`,
                        background: budgetUsed > 100 ? "#df7469" : undefined,
                      }}
                    />
                  </div>
                  <div className="metric-footnote">
                    {summary.budget
                      ? `${Math.round(budgetUsed)}% of ${money(summary.budget)} allocated`
                      : "Set a monthly budget to get started"}
                  </div>
                </article>
                <article className="metric-card">
                  <div className="metric-label">
                    Savings rate
                    <span className="metric-icon mint">
                      <TrendingUp size={18} />
                    </span>
                  </div>
                  <div className="metric-value">
                    {summary.income ? summary.savingsRate.toFixed(1) : "—"}
                    <small>{summary.income ? "%" : ""}</small>
                  </div>
                  <div className="metric-bottom">
                    <span className="change-green">
                      {summary.income
                        ? `${money(summary.balance)} retained`
                        : "Add income to calculate"}
                    </span>
                    <Sparkline
                      values={series.slice(0, month).map((s) => s.savingsRate)}
                      color="#20aa91"
                    />
                  </div>
                  <div className="metric-footnote">
                    Unspent income as a share of income
                  </div>
                </article>
              </section>
              <div className="charts-row">
                <section className="panel cashflow-panel" id="cashflow">
                  <div className="panel-heading">
                    <div>
                      <h2>Cash flow</h2>
                      <p>See the bigger picture, month by month.</p>
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
                        Income <i style={{ background: "#4263eb" }} />
                      </span>
                      <strong>
                        {money(
                          sum(
                            series
                              .slice(
                                range === "six" ? Math.max(0, month - 6) : 0,
                                range === "six" ? month : 12,
                              )
                              .map((s) => s.income),
                          ),
                        )}
                      </strong>
                    </div>
                    <div>
                      <span>
                        Expenses <i style={{ background: "#24aa97" }} />
                      </span>
                      <strong>
                        {money(
                          sum(
                            series
                              .slice(
                                range === "six" ? Math.max(0, month - 6) : 0,
                                range === "six" ? month : 12,
                              )
                              .map((s) => s.expense),
                          ),
                        )}
                      </strong>
                    </div>
                    <span className="chart-period">
                      {range === "year"
                        ? `Jan – Dec ${year}`
                        : `${MONTHS[Math.max(0, month - 6)].slice(0, 3)} – ${MONTHS[month - 1].slice(0, 3)} ${year}`}
                    </span>
                  </div>
                  <CashflowChart ledger={ledger} month={month} range={range} />
                </section>
                <section className="panel breakdown-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Spending breakdown</h2>
                      <p>Every category, accounted for.</p>
                    </div>
                    <span className="soft-icon">
                      <Layers3 size={18} />
                    </span>
                  </div>
                  <div className="donut-container">
                    <SpendingDonut month={current} />
                    <div className="donut-label">
                      <span>Total expenses</span>
                      <strong>{money(summary.expense)}</strong>
                      <small>
                        {expenses.filter((c) => c.total > 0).length} categories
                      </small>
                    </div>
                  </div>
                  <div className="category-legend">
                    {expenses.map(({ category: c, total }) => (
                      <div key={c}>
                        <span>
                          <i style={{ background: CATEGORY[c].color }} />
                          {CATEGORY[c].label}
                        </span>
                        <strong>{money(total)}</strong>
                        <small>
                          {summary.expense
                            ? Math.round((total / summary.expense) * 100)
                            : 0}
                          %
                        </small>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <div className="detail-row">
                <section className="panel budgets-panel" id="budgets">
                  <div className="panel-heading">
                    <div>
                      <h2>Budget performance</h2>
                      <p>Your plan, in progress.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => openDialog({ kind: "budgets" })}
                    >
                      <Pencil size={15} />
                      Edit budgets
                    </button>
                  </div>
                  <div className="budget-table-header">
                    <span>CATEGORY</span>
                    <span>SPENT / BUDGET</span>
                  </div>
                  <div className="budget-rows">
                    {expenses.map(({ category: c, total }) => {
                      const limit = current.budgets[c],
                        used = limit ? (total / limit) * 100 : total ? 100 : 0;
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
                            <strong>{CATEGORY[c].label}</strong>
                            <span
                              className={total > limit ? "over-budget" : ""}
                            >
                              {money(total)} <small>/ {money(limit)}</small>
                            </span>
                          </div>
                          <div className="budget-row-bottom">
                            <div className="progress-track">
                              <span
                                style={{
                                  width: `${Math.min(100, used)}%`,
                                  background:
                                    total > limit
                                      ? "#df7469"
                                      : CATEGORY[c].color,
                                }}
                              />
                            </div>
                            <span>
                              {limit
                                ? `${Math.round(used)}%`
                                : total
                                  ? "Over"
                                  : "—"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
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
                </section>
                <SpendingCalendar month={current} year={year} />
              </div>
              <Transactions
                month={current}
                year={year}
                onAdd={() => openDialog({ kind: "transaction" })}
                onEdit={(transaction) =>
                  openDialog({ kind: "transaction", transaction })
                }
                onDelete={(transaction) =>
                  openDialog({ kind: "delete", transaction })
                }
              />
              <footer className="page-footer">
                <span>
                  <ShieldCheck size={15} />
                  Your data stays on your computer.
                </span>
                <span>
                  LedgerOne <span>·</span> {year} ledger <span>·</span> USD
                </span>
              </footer>
            </div>
          )}
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
      {dialog && ledger && current && (
        <Modal
          title={
            dialog.kind === "transaction"
              ? dialog.transaction
                ? "Edit transaction"
                : "New transaction"
              : dialog.kind === "budgets"
                ? "Shape your monthly budget"
                : "Delete transaction?"
          }
          subtitle={
            dialog.kind === "transaction"
              ? "A clear record starts with the details."
              : dialog.kind === "budgets"
                ? `${MONTHS[month - 1]} ${year} · Spending limits in USD`
                : "This removes the transaction from your saved ledger."
          }
          busy={busy}
          onClose={() => setDialog(null)}
        >
          {dialog.kind === "transaction" ? (
            <TransactionForm
              transaction={dialog.transaction}
              year={year}
              month={month}
              busy={busy}
              error={dialogError}
              onClose={() => setDialog(null)}
              onSave={(draft, id) =>
                void mutate(
                  () => api.saveTransaction(year, ledger.revision, draft, id),
                  id
                    ? "Transaction updated and saved."
                    : "Transaction added and saved.",
                )
              }
            />
          ) : dialog.kind === "budgets" ? (
            <BudgetForm
              month={current}
              busy={busy}
              error={dialogError}
              onClose={() => setDialog(null)}
              onSave={(budgets) =>
                void mutate(
                  () => api.budgets(year, month, ledger.revision, budgets),
                  "Monthly budgets saved.",
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
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={20} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
