import type {
  Category,
  ExpenseCategory,
  MonthLedger,
  Transaction,
  YearLedger,
} from "./types";
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "HOUSING",
  "FOOD",
  "TRANSPORT",
  "SHOPPING",
  "LIFESTYLE",
  "UTILITIES",
];
export const CATEGORY: Record<Category, { label: string; color: string }> = {
  HOUSING: { label: "Housing", color: "#4263eb" },
  FOOD: { label: "Food & dining", color: "#8b6cef" },
  TRANSPORT: { label: "Transport", color: "#34b4a4" },
  SHOPPING: { label: "Shopping", color: "#f7b45a" },
  LIFESTYLE: { label: "Lifestyle", color: "#e987a4" },
  UTILITIES: { label: "Utilities", color: "#84afd2" },
  SALARY: { label: "Salary", color: "#14a88c" },
  FREELANCE: { label: "Freelance", color: "#55b990" },
  OTHER_INCOME: { label: "Other income", color: "#3eafae" },
};
export const ACCOUNT = {
  CHECKING: "Checking",
  CREDIT: "Credit card",
  CASH: "Cash",
  SAVINGS: "Savings",
};
export const cents = (amount: number) => Math.round(amount * 100);
export const sum = (values: number[]) =>
  values.reduce((total, value) => total + cents(value), 0) / 100;
export const money = (n: number, decimals = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
export function summarize(month: MonthLedger) {
  const income = sum(
      month.transactions
        .filter((t) => t.type === "INCOME")
        .map((t) => t.amount),
    ),
    expense = sum(
      month.transactions
        .filter((t) => t.type === "EXPENSE")
        .map((t) => t.amount),
    ),
    budget = sum(Object.values(month.budgets));
  return {
    income,
    expense,
    budget,
    balance: (cents(income) - cents(expense)) / 100,
    remaining: (cents(budget) - cents(expense)) / 100,
    savingsRate: income ? ((income - expense) / income) * 100 : 0,
  };
}
export function dailySpending(month: MonthLedger, year: number) {
  const days = new Date(year, month.number, 0).getDate();
  return Array.from({ length: days }, (_, i) =>
    sum(
      month.transactions
        .filter(
          (t) => t.type === "EXPENSE" && Number(t.date.slice(8)) === i + 1,
        )
        .map((t) => t.amount),
    ),
  );
}
export function annualSeries(ledger: YearLedger) {
  return ledger.months.map((month) => ({
    month: MONTHS[month.number - 1].slice(0, 3),
    ...summarize(month),
  }));
}
export function filterTransactions(
  rows: Transaction[],
  query: string,
  filter: string,
  sort: "newest" | "oldest" | "amount",
) {
  const q = query.trim().toLowerCase();
  return rows
    .filter(
      (t) =>
        (filter === "ALL" || t.type === filter) &&
        (t.description.toLowerCase().includes(q) ||
          CATEGORY[t.category].label.toLowerCase().includes(q) ||
          ACCOUNT[t.account].toLowerCase().includes(q)),
    )
    .sort((a, b) =>
      sort === "amount"
        ? b.amount - a.amount
        : sort === "oldest"
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date) ||
            b.createdAt.localeCompare(a.createdAt),
    );
}
