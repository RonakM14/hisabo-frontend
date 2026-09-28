import { describe, it, expect } from "vitest";
import { dailySpending, filterTransactions, sum, summarize } from "./data";
import type { MonthLedger, Transaction } from "./types";
const expense: Transaction = {
  id: "1",
  type: "EXPENSE",
  description: "Coffee & pastry",
  amount: 0.1,
  category: "FOOD",
  account: "CASH",
  date: "2028-02-29",
  createdAt: "2028-02-29T12:00:00Z",
  updatedAt: "2028-02-29T12:00:00Z",
};
const month: MonthLedger = {
  number: 2,
  budgets: {
    HOUSING: 0,
    FOOD: 1,
    TRANSPORT: 0,
    SHOPPING: 0,
    LIFESTYLE: 0,
    UTILITIES: 0,
  },
  transactions: [
    expense,
    { ...expense, id: "2", amount: 0.2 },
    { ...expense, id: "3", type: "INCOME", category: "SALARY", amount: 10 },
  ],
};
describe("ledger calculations", () => {
  it("uses cents for exact transaction sums", () =>
    expect(sum([0.1, 0.2])).toBe(0.3));
  it("keeps income separate from expenses", () =>
    expect(summarize(month)).toMatchObject({
      income: 10,
      expense: 0.3,
      budget: 1,
      balance: 9.7,
      remaining: 0.7,
      savingsRate: 97,
    }));
  it("includes leap day and excludes income in the calendar", () => {
    const days = dailySpending(month, 2028);
    expect(days).toHaveLength(29);
    expect(days[28]).toBe(0.3);
  });
  it("filters by transaction type and category or description", () => {
    expect(
      filterTransactions(month.transactions, "food", "EXPENSE", "newest"),
    ).toHaveLength(2);
    expect(
      filterTransactions(month.transactions, "salary", "INCOME", "amount"),
    ).toHaveLength(1);
    expect(
      filterTransactions(month.transactions, "absent", "ALL", "newest"),
    ).toHaveLength(0);
  });
  it("sorts amounts numerically", () =>
    expect(
      filterTransactions(month.transactions, "", "ALL", "amount").map(
        (t) => t.amount,
      ),
    ).toEqual([10, 0.2, 0.1]));
});
