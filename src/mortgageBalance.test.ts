import { describe, expect, it } from "vitest";
import { interpolateBalance, mortgageBalancePoints } from "./mortgageBalance";
import type { MortgagePayment, MortgageSchedule } from "./mortgage";

function schedule(rows: [string, number, number][]): MortgageSchedule {
  const payments: MortgagePayment[] = rows.map(
    ([date, balance, cumulativeInterest], i) => ({
      number: i + 1,
      date,
      balance,
      cumulativeInterest,
      openingBalance: 0,
      payment: 0,
      interest: 0,
      scheduledPrincipal: 0,
      extraPrincipal: 0,
    }),
  );
  return {
    months: rows.length,
    payoffDate: rows.at(-1)?.[0] ?? "2028-01-31",
    interest: rows.at(-1)?.[2] ?? 0,
    totalPaid: 0,
    extraPrincipal: 0,
    payments,
  };
}
const loan = { balance: 1000, balanceDate: "2028-01-31" };
const baseline = schedule([
  ["2028-02-29", 700, 10],
  ["2028-03-31", 350, 17],
  ["2028-04-30", 0, 20.5],
]);
const accelerated = schedule([
  ["2028-02-29", 450, 10],
  ["2028-03-31", 0, 14.5],
]);

describe("mortgage balance comparison", () => {
  it("starts at the statement balance and retains backend month-end due dates", () => {
    const points = mortgageBalancePoints(loan, { baseline, accelerated });
    expect(points[0]).toEqual({
      date: "2028-01-31",
      standard: 1000,
      extras: 1000,
      interestSaved: 0,
    });
    expect(points.map((p) => p.date)).toEqual([
      "2028-01-31",
      "2028-02-29",
      "2028-03-31",
      "2028-04-30",
    ]);
    expect(points[2].interestSaved).toBe(2.5);
  });
  it("keeps paid-off principal at zero and retains interest already paid until the standard loan ends", () => {
    const points = mortgageBalancePoints(loan, { baseline, accelerated });
    expect(points.at(-1)).toEqual({
      date: "2028-04-30",
      standard: 0,
      extras: 0,
      interestSaved: 6,
    });
    expect(points.at(-1)?.interestSaved).toBeCloseTo(
      baseline.interest - accelerated.interest,
      2,
    );
  });
  it("shows identical paths and no savings when no extras are paid", () => {
    for (const point of mortgageBalancePoints(loan, {
      baseline,
      accelerated: baseline,
    })) {
      expect(point.extras).toBe(point.standard);
      expect(point.interestSaved).toBe(0);
    }
  });
  it("preserves the balance and zero interest when there are no payment rows", () => {
    expect(
      mortgageBalancePoints(loan, {
        baseline: schedule([]),
        accelerated: schedule([]),
      }),
    ).toEqual([
      {
        date: loan.balanceDate,
        standard: 1000,
        extras: 1000,
        interestSaved: 0,
      },
    ]);
  });
  it("aligns hover values between the same two payment dates and clamps chart edges", () => {
    const points = mortgageBalancePoints(loan, { baseline, accelerated });
    expect(interpolateBalance(points, 1.5)).toEqual({
      date: "2028-03-31",
      standard: 525,
      extras: 225,
      interestSaved: 1.25,
    });
    expect(interpolateBalance(points, -10)).toEqual(points[0]);
    expect(interpolateBalance(points, 100)).toEqual(points.at(-1));
  });
});
