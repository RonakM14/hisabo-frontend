import { describe, expect, it } from "vitest";
import {
  datedPayments,
  modeledPaymentDate,
  nextPaymentDate,
  paymentDateBounds,
  escrowForMonth,
} from "./mortgage";
import type { MortgageLoan } from "./mortgage";
import type { EscrowDraft } from "./mortgage";

describe("monthly escrow", () => {
  const entries: EscrowDraft[] = [
    { month: "2026-11", amount: "425.50", scope: "FROM_MONTH" },
    { month: "2026-12", amount: "500", scope: "THIS_MONTH" },
    { month: "2027-02", amount: "0", scope: "FROM_MONTH" },
  ];
  it("carries changes across years while one-month exceptions revert", () => {
    expect(escrowForMonth("350", entries, "2026-10")).toEqual({
      amount: "350",
      sourceMonth: null,
      scope: null,
    });
    expect(escrowForMonth("350", entries, "2026-12").amount).toBe("500");
    expect(escrowForMonth("350", entries, "2027-01")).toEqual({
      amount: "425.50",
      sourceMonth: "2026-11",
      scope: "FROM_MONTH",
    });
    expect(escrowForMonth("350", entries, "2027-03").amount).toBe("0");
  });
  it("resetting an override restores the preceding amount without losing other years", () => {
    expect(
      escrowForMonth(
        "350",
        entries.filter((e) => e.month !== "2026-12"),
        "2026-12",
      ).amount,
    ).toBe("425.50");
    expect(
      escrowForMonth(
        "350",
        entries.filter((e) => e.month !== "2026-11"),
        "2027-01",
      ).amount,
    ).toBe("350");
    expect(
      escrowForMonth("350", [...entries].reverse(), "2027-01").amount,
    ).toBe("425.50");
  });
  it("keeps a cleared draft empty rather than silently replacing it with zero", () => {
    expect(
      escrowForMonth(
        "350",
        [{ month: "2026-11", amount: "", scope: "FROM_MONTH" }],
        "2026-12",
      ).amount,
    ).toBe("");
  });
});

const loan: MortgageLoan = {
  startDate: "2020-01-31",
  balanceDate: "2026-01-31",
  balance: 1000,
  annualRate: 12,
  interestConvention: "MONTHLY",
  paymentMode: "PAYMENT",
  monthlyPayment: 200,
  remainingMonths: null,
  monthlyEscrow: 0,
};

describe("dated mortgage payments", () => {
  it("preserves legacy month-only payments on the original due date", () => {
    const payments = datedPayments(loan, {
      monthlyExtra: 0,
      extraStartMonth: null,
      oneTimeExtra: 150,
      oneTimeMonth: "2026-02",
    });
    expect(payments).toEqual([
      {
        id: "00000000-0000-0000-0000-000000000001",
        date: "2026-02-28",
        amount: 150,
      },
    ]);
    expect(
      datedPayments(loan, {
        monthlyExtra: 0,
        extraStartMonth: null,
        oneTimeExtra: 0,
        oneTimeMonth: null,
        oneTimePayments: payments,
      }),
    ).toEqual(payments);
  });
  it("preserves separate same-day entries without mutating saved data", () => {
    const payments = [
      { id: "second", date: "2026-03-01", amount: 100 },
      { id: "first", date: "2026-02-10", amount: 50 },
      { id: "same-day", date: "2026-02-10", amount: 75 },
    ];
    expect(
      datedPayments(loan, {
        monthlyExtra: 0,
        extraStartMonth: null,
        oneTimeExtra: 0,
        oneTimeMonth: null,
        oneTimePayments: payments,
      }).map((p) => p.id),
    ).toEqual(["first", "same-day", "second"]);
    expect(payments[0].id).toBe("second");
  });
  it("shows the next anchored due date across month ends, leap years, and year boundaries", () => {
    expect(nextPaymentDate("2028-01-31")).toBe("2028-02-29");
    expect(modeledPaymentDate("2028-01-31", "2028-02-29")).toBe("2028-02-29");
    expect(modeledPaymentDate("2028-01-31", "2028-03-01")).toBe("2028-03-31");
    expect(modeledPaymentDate("2026-11-15", "2026-12-16")).toBe("2027-01-15");
    expect(modeledPaymentDate("2026-01-15", "2026-01-16")).toBe("2026-02-15");
  });
  it("leaves date hints empty while required dates are unfilled", () => {
    expect(nextPaymentDate("")).toBe("");
    expect(modeledPaymentDate("", "2026-02-10")).toBe("");
    expect(modeledPaymentDate("2026-01-31", "")).toBe("");
  });
});

describe("one-time payment editor date range", () => {
  it("excludes the balance date and crosses year boundaries without timezone shifts", () => {
    expect(paymentDateBounds("2026-12-31")).toEqual({
      min: "2027-01-01",
      max: "2076-12-31",
    });
  });
  it("clamps leap-day dates at the 50-year limit", () => {
    expect(paymentDateBounds("2024-02-29")).toEqual({
      min: "2024-03-01",
      max: "2074-02-28",
    });
  });
  it("honors the supported calendar range and allows setup before a balance date is entered", () => {
    expect(paymentDateBounds("2090-01-01")).toEqual({
      min: "2090-01-02",
      max: "2100-12-31",
    });
    expect(paymentDateBounds("")).toEqual({
      min: "1900-01-01",
      max: "2100-12-31",
    });
  });
});
