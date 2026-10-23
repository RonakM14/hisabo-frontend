import type {
  HomeSale,
  HomeSaleEstimate,
  MortgageLoan,
  MortgageAnalysis,
} from "./mortgage";

export type HomeSaleDraft = {
  [K in keyof Omit<HomeSale, "taxEnabled">]: string;
} & { taxEnabled: boolean };

export function saleDraft(
  saved: HomeSale | null | undefined,
  balanceDate: string,
): HomeSaleDraft {
  const today = new Date().toLocaleDateString("en-CA");
  return {
    salePrice: saved ? String(saved.salePrice) : "",
    closingDate:
      saved?.closingDate ?? (today > balanceDate ? today : balanceDate),
    payoffOverride:
      saved?.payoffOverride == null ? "" : String(saved.payoffOverride),
    agentFeePercent: String(saved?.agentFeePercent ?? 0),
    closingCosts: String(saved?.closingCosts ?? 0),
    buyerCredits: String(saved?.buyerCredits ?? 0),
    otherLoans: String(saved?.otherLoans ?? 0),
    taxEnabled: saved?.taxEnabled ?? false,
    taxReserve: String(saved?.taxReserve ?? 0),
  };
}

export function saleInput(draft: HomeSaleDraft): HomeSale | null {
  const { closingDate } = draft;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(closingDate) ||
    closingDate < "1900-01-01" ||
    closingDate > "2100-12-31"
  )
    return null;
  const parsed = new Date(closingDate + "T12:00:00Z");
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== closingDate
  )
    return null;
  const keys = [
    "salePrice",
    "agentFeePercent",
    "closingCosts",
    "buyerCredits",
    "otherLoans",
    "taxReserve",
  ] as const;
  for (const key of [
    ...keys,
    ...(draft.payoffOverride !== "" ? ["payoffOverride" as const] : []),
  ]) {
    const raw = draft[key].trim();
    if (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) > 100000000) return null;
  }
  if (Number(draft.salePrice) <= 0 || Number(draft.agentFeePercent) > 100)
    return null;
  return {
    salePrice: Number(draft.salePrice),
    closingDate,
    payoffOverride:
      draft.payoffOverride === "" ? null : Number(draft.payoffOverride),
    agentFeePercent: Number(draft.agentFeePercent),
    closingCosts: Number(draft.closingCosts),
    buyerCredits: Number(draft.buyerCredits),
    otherLoans: Number(draft.otherLoans),
    taxEnabled: draft.taxEnabled,
    taxReserve: Number(draft.taxReserve),
  };
}

// Use the backend's saved payment schedule, with integer cents for sale deductions.
export function estimateHomeSale(
  sale: HomeSale,
  loan: MortgageLoan,
  analysis: MortgageAnalysis,
): HomeSaleEstimate | null {
  if (sale.closingDate < loan.balanceDate) return null;
  let projectedBalance = loan.balance,
    balanceAsOf = loan.balanceDate;
  for (const payment of analysis.accelerated.payments) {
    if (payment.date > sale.closingDate) break;
    projectedBalance = payment.balance;
    balanceAsOf = payment.date;
  }
  const cents = (value: number) => Math.round(value * 100);
  const price = cents(sale.salePrice);
  const payoff = cents(sale.payoffOverride ?? projectedBalance);
  const agent = Math.round(
    (price * Math.round(sale.agentFeePercent * 100)) / 10000,
  );
  const sellingCosts =
    agent + cents(sale.closingCosts) + cents(sale.buyerCredits);
  const cashBeforeTax = price - payoff - sellingCosts - cents(sale.otherLoans);
  const reserve = sale.taxEnabled ? cents(sale.taxReserve) : 0;
  return {
    projectedBalance,
    balanceAsOf,
    mortgagePayoff: payoff / 100,
    agentFee: agent / 100,
    sellingCosts: sellingCosts / 100,
    cashBeforeTax: cashBeforeTax / 100,
    taxReserve: reserve / 100,
    cashInHand: (cashBeforeTax - reserve) / 100,
  };
}
