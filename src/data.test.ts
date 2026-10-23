import { describe, it, expect } from "vitest";
import {
  dailySpending,
  filterTransactions,
  sum,
  summarize,
  visibleBudgetCategories,
} from "./data";
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

describe("custom budget categories", () => {
  const categories = [
    { id: "FOOD", label: "Meals", color: "#112233", active: false },
    { id: "CUSTOM_travel", label: "Travel", color: "#445566", active: true },
    { id: "SHOPPING", label: "Shopping", color: "#778899", active: false },
  ];
  it("searches custom and renamed category labels", () => {
    const rows = [
      ...month.transactions,
      { ...expense, id: "custom", category: "CUSTOM_travel" },
    ];
    expect(
      filterTransactions(rows, "travel", "EXPENSE", "newest", categories).map(
        (t) => t.id,
      ),
    ).toEqual(["custom"]);
    expect(
      filterTransactions(rows, "meals", "EXPENSE", "newest", categories),
    ).toHaveLength(2);
  });
  it("shows removed categories with history and hides unused removed categories", () => {
    expect(visibleBudgetCategories(categories, month).map((c) => c.id)).toEqual(
      ["FOOD", "CUSTOM_travel"],
    );
    expect(
      visibleBudgetCategories(categories, {
        number: 1,
        budgets: {},
        transactions: [],
      }).map((c) => c.id),
    ).toEqual(["CUSTOM_travel"]);
  });
  it("keeps removed and custom amounts in financial totals", () => {
    expect(
      summarize({
        number: 1,
        budgets: { FOOD: 10, CUSTOM_travel: 20 },
        transactions: [
          expense,
          { ...expense, id: "2", amount: 5, category: "CUSTOM_travel" },
        ],
      }),
    ).toMatchObject({ budget: 30, expense: 5.1, remaining: 24.9 });
  });
});

describe("unassigned budget savings", () => {
  it("uses allocated budgets rather than spending and does not create transactions", () => {
    const sample: MonthLedger = {
      number: 10,
      budgets: { FOOD: 600.05 },
      transactions: [
        { ...expense, type: "INCOME", category: "SALARY", amount: 1000.1 },
        { ...expense, amount: 20 },
      ],
    };
    expect(summarize(sample)).toMatchObject({
      savings: 400.05,
      budgetShortfall: 0,
      balance: 980.1,
    });
    expect(sample.transactions).toHaveLength(2);
  });
  it("never displays negative savings and exposes an overallocated plan", () => {
    expect(
      summarize({
        number: 10,
        budgets: { FOOD: 150 },
        transactions: [
          { ...expense, type: "INCOME", category: "SALARY", amount: 100 },
        ],
      }),
    ).toMatchObject({ savings: 0, budgetShortfall: 50 });
    expect(
      summarize({ number: 11, budgets: { FOOD: 150 }, transactions: [] }),
    ).toMatchObject({ savings: 0, budgetShortfall: 150 });
  });
  it("assigns all income to savings when no category has a budget", () => {
    expect(
      summarize({
        number: 10,
        budgets: {},
        transactions: [
          { ...expense, type: "INCOME", category: "SALARY", amount: 500 },
        ],
      }).savings,
    ).toBe(500);
  });
});
