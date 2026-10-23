import { describe, expect, it } from "vitest";
import { estimateHomeSale, saleDraft, saleInput } from "./homeSale";
import type { HomeSale, MortgageAnalysis, MortgageLoan } from "./mortgage";

const loan = { balance: 1000, balanceDate: "2026-10-01" } as MortgageLoan;
const analysis = {
  accelerated: {
    payments: [
      { date: "2026-11-01", balance: 900 },
      { date: "2026-12-01", balance: 0 },
    ],
  },
} as MortgageAnalysis;
const sale: HomeSale = {
  salePrice: 500000,
  closingDate: "2026-11-01",
  payoffOverride: null,
  agentFeePercent: 5,
  closingCosts: 5000,
  buyerCredits: 1000,
  otherLoans: 10000,
  taxEnabled: true,
  taxReserve: 15000,
};

describe("home sale estimate", () => {
  it("uses saved scheduled balances at closing, including the closing-day payment", () => {
    expect(estimateHomeSale(sale, loan, analysis)).toEqual({
      projectedBalance: 900,
      balanceAsOf: "2026-11-01",
      mortgagePayoff: 900,
      agentFee: 25000,
      sellingCosts: 31000,
      cashBeforeTax: 458100,
      taxReserve: 15000,
      cashInHand: 443100,
    });
    expect(
      estimateHomeSale({ ...sale, closingDate: "2026-10-31" }, loan, analysis)
        ?.mortgagePayoff,
    ).toBe(1000);
    expect(
      estimateHomeSale({ ...sale, closingDate: "2027-01-01" }, loan, analysis)
        ?.mortgagePayoff,
    ).toBe(0);
    expect(
      estimateHomeSale({ ...sale, closingDate: "2026-09-01" }, loan, analysis),
    ).toBeNull();
  });
  it("accepts a zero lender quote, retains negative results and rounds fee half-cents", () => {
    expect(
      estimateHomeSale({ ...sale, payoffOverride: 0 }, loan, analysis)
        ?.mortgagePayoff,
    ).toBe(0);
    const result = estimateHomeSale(
      {
        ...sale,
        salePrice: 0.1,
        payoffOverride: 1,
        closingCosts: 0,
        buyerCredits: 0,
        otherLoans: 0,
        taxEnabled: false,
      },
      loan,
      analysis,
    );
    expect(result?.agentFee).toBe(0.01);
    expect(result?.taxReserve).toBe(0);
    expect(result?.cashInHand).toBe(-0.91);
  });
  it("rejects cleared amounts, excess precision, invalid dates and percentages", () => {
    const draft = saleDraft(sale, loan.balanceDate);
    expect(saleInput(draft)).toEqual(sale);
    for (const change of [
      { salePrice: "" },
      { salePrice: "-1" },
      { salePrice: "1.001" },
      { agentFeePercent: "100.01" },
      { closingDate: "2026-02-30" },
      { closingCosts: "" },
      { payoffOverride: "-1" },
    ])
      expect(saleInput({ ...draft, ...change })).toBeNull();
    expect(saleInput({ ...draft, payoffOverride: "0" })?.payoffOverride).toBe(
      0,
    );
    expect(saleDraft(null, loan.balanceDate).salePrice).toBe("");
  });
});
