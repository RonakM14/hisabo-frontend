export type TransactionType = "INCOME" | "EXPENSE";
export type ExpenseCategory =
  "HOUSING" | "FOOD" | "TRANSPORT" | "SHOPPING" | "LIFESTYLE" | "UTILITIES";
export type Category =
  ExpenseCategory | "SALARY" | "FREELANCE" | "OTHER_INCOME";
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
  number: number;
  budgets: Record<ExpenseCategory, number>;
  transactions: Transaction[];
}
export interface YearLedger {
  year: number;
  currency: string;
  revision: number;
  demo: boolean;
  months: MonthLedger[];
}
export type TransactionDraft = Omit<
  Transaction,
  "id" | "createdAt" | "updatedAt"
>;
