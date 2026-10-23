import type {
  MortgageAnalysis,
  MortgageLoan,
  MortgagePayment,
} from "./mortgage";

export interface BalancePoint {
  date: string;
  standard: number;
  extras: number;
  interestSaved: number;
}

// Join by due date and carry each schedule's last balance/interest forward after payoff.
// All money comes from the backend schedule; this view does not amortize the loan again.
export function mortgageBalancePoints(
  loan: Pick<MortgageLoan, "balanceDate" | "balance">,
  analysis: Pick<MortgageAnalysis, "baseline" | "accelerated">,
): BalancePoint[] {
  const dates = [
    ...new Set([
      loan.balanceDate,
      ...analysis.baseline.payments.map((p) => p.date),
      ...analysis.accelerated.payments.map((p) => p.date),
    ]),
  ].sort();
  function reader(payments: MortgagePayment[]) {
    const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date));
    let index = 0,
      balance = loan.balance,
      interest = 0;
    return (date: string) => {
      while (index < sorted.length && sorted[index].date <= date) {
        balance = sorted[index].balance;
        interest = sorted[index].cumulativeInterest;
        index++;
      }
      return { balance, interest };
    };
  }
  const baseline = reader(analysis.baseline.payments);
  const accelerated = reader(analysis.accelerated.payments);
  return dates.map((date) => {
    const standard = baseline(date),
      extras = accelerated(date);
    return {
      date,
      standard: standard.balance,
      extras: extras.balance,
      interestSaved:
        Math.round((standard.interest - extras.interest) * 100) / 100,
    };
  });
}

export function interpolateBalance(
  points: BalancePoint[],
  index: number,
): BalancePoint {
  const position = Math.max(0, Math.min(points.length - 1, index));
  const low = Math.floor(position),
    high = Math.ceil(position),
    fraction = position - low;
  const a = points[low],
    b = points[high];
  return {
    date: points[Math.round(position)].date,
    standard: a.standard + (b.standard - a.standard) * fraction,
    extras: a.extras + (b.extras - a.extras) * fraction,
    interestSaved:
      a.interestSaved + (b.interestSaved - a.interestSaved) * fraction,
  };
}
