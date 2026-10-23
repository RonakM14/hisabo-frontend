export type TransactionType = "INCOME" | "EXPENSE";
export type ExpenseCategory = string;
export type Category = string;
export interface BudgetCategory {
  id: string;
  label: string;
  color: string;
  active: boolean;
}
export interface CategoryCatalog {
  revision: number;
  entries: BudgetCategory[];
}
export type Account = "CHECKING" | "CREDIT" | "CASH" | "SAVINGS";
export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  category: Category;
  account: Account;
  date: string;
  createdAt: string;
  updatedAt: string;
}
export interface MonthLedger {
  budgetOrigin?: "UNSET" | "MANUAL" | "CARRIED";
  budgetSource?: string | null;
  budgetSummary?: {
    income: number;
    allocated: number;
    savings: number;
    shortfall: number;
  };
  number: number;
  budgets: Record<ExpenseCategory, number>;
  transactions: Transaction[];
}
export interface YearLedger {
  categories?: CategoryCatalog;
  year: number;
  currency: string;
  revision: number;
  demo: boolean;
  months: MonthLedger[];
  workbook?: { fileName: string; warning: string | null };
}
export type TransactionDraft = Omit<
  Transaction,
  "id" | "createdAt" | "updatedAt"
>;

export interface Profile {
  template?: import("./mortgage").ProfileTemplate;
  id: string;
  name: string;
  workbookWarning?: string | null;
}
