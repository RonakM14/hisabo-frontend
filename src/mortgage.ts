export type ProfileTemplate = "BUDGET" | "MORTGAGE";
export interface MortgageLoan {
  startDate: string;
  balanceDate: string;
  balance: number;
  annualRate: number;
  interestConvention: "MONTHLY" | "CANADIAN_SEMIANNUAL";
  paymentMode: "PAYMENT" | "TERM";
  monthlyPayment: number | null;
  remainingMonths: number | null;
  monthlyEscrow: number;
}
export interface MortgageScenario {
  monthlyExtra: number;
  extraStartMonth: string | null;
  oneTimeExtra: number;
  oneTimeMonth: string | null;
  oneTimePayments?: MortgageOneTimePayment[];
  escrowChanges?: EscrowChange[];
}
export type EscrowScope = "FROM_MONTH" | "THIS_MONTH";
export interface EscrowChange {
  month: string;
  amount: number;
  scope: EscrowScope;
}
export interface EscrowDraft {
  month: string;
  amount: string;
  scope: EscrowScope;
}
export interface HousingMonth {
  date: string;
  principalAndInterest: number;
  extraPrincipal: number;
  escrow: number;
  totalPayment: number;
  balance?: number;
  escrowSourceMonth: string | null;
  escrowScope: EscrowScope | null;
}
export interface HousingYear {
  year: number;
  payments: number;
  principalAndInterest: number;
  extraPrincipal: number;
  escrow: number;
  totalPayment: number;
}
export interface HousingProjection {
  escrowTotal: number;
  totalPayments: number;
  months: HousingMonth[];
  years: HousingYear[];
}
export interface MortgageOneTimePayment {
  id: string;
  date: string;
  amount: number;
}
export interface OneTimePaymentResult {
  id: string;
  date: string;
  applicationDate: string;
  requested: number;
  applied: number;
  balanceAfter: number;
  status: "APPLIED" | "PARTIALLY_APPLIED" | "NOT_APPLIED";
}
export interface OneTimeImpact {
  requested: number;
  applied: number;
  interestSaved: number;
  monthsSaved: number;
  payments: OneTimePaymentResult[];
}
export interface HomeImprovement {
  id: string;
  date: string;
  project: string;
  description: string;
  amount: number;
}
export interface MortgagePayment {
  number: number;
  date: string;
  openingBalance: number;
  payment: number;
  interest: number;
  scheduledPrincipal: number;
  extraPrincipal: number;
  balance: number;
  cumulativeInterest: number;
}
export interface MortgageSchedule {
  months: number;
  payoffDate: string;
  interest: number;
  totalPaid: number;
  extraPrincipal: number;
  payments: MortgagePayment[];
}
export interface MortgageAnalysis {
  monthlyPayment: number;
  monthlyHousingPayment: number;
  baseline: MortgageSchedule;
  accelerated: MortgageSchedule;
  interestSaved: number;
  monthsSaved: number;
  improvementTotal: number;
  oneTimeImpact?: OneTimeImpact;
  housing?: HousingProjection;
  notes: string[];
}
export interface MortgageView {
  supportsHomeSale?: boolean;
  homeSale?: HomeSale | null;
  homeSaleEstimate?: HomeSaleEstimate | null;
  supportsDatedPayments?: boolean;
  supportsMonthlyEscrow?: boolean;
  revision: number;
  loan: MortgageLoan | null;
  scenario: MortgageScenario;
  improvements: HomeImprovement[];
  analysis: MortgageAnalysis | null;
  fileName: string;
  workbookWarning: string | null;
}
export interface MortgageInput {
  loan: MortgageLoan;
  scenario: MortgageScenario;
}
export interface HomeSale {
  salePrice: number;
  closingDate: string;
  payoffOverride: number | null;
  agentFeePercent: number;
  closingCosts: number;
  buyerCredits: number;
  otherLoans: number;
  taxEnabled: boolean;
  taxReserve: number;
}
export interface HomeSaleEstimate {
  projectedBalance: number;
  balanceAsOf: string;
  mortgagePayoff: number;
  agentFee: number;
  sellingCosts: number;
  cashBeforeTax: number;
  taxReserve: number;
  cashInHand: number;
}
export function escrowForMonth(
  defaultAmount: string,
  entries: EscrowDraft[],
  month: string,
) {
  const exact = entries.find((entry) => entry.month === month);
  const carried = entries
    .filter((entry) => entry.scope === "FROM_MONTH" && entry.month < month)
    .sort((a, b) => b.month.localeCompare(a.month))[0];
  const source = exact || carried;
  return {
    amount: source?.amount ?? defaultAmount,
    sourceMonth: source?.month ?? null,
    scope: source?.scope ?? null,
  };
}
export function monthName(month: string): string {
  return new Date(month + "-01T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
export function nextPaymentMonth(balanceDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(balanceDate)) return "";
  const [year, month] = balanceDate.split("-").map(Number);
  return `${year + (month === 12 ? 1 : 0)}-${String((month % 12) + 1).padStart(2, "0")}`;
}
function anchoredDate(balanceDate: string, months: number): string {
  const [year, month, day] = balanceDate.split("-").map(Number);
  const end = new Date(Date.UTC(year, month + months, 0));
  const date = new Date(
    Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      Math.min(day, end.getUTCDate()),
    ),
  );
  return date.toISOString().slice(0, 10);
}
export function nextPaymentDate(balanceDate: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(balanceDate)
    ? anchoredDate(balanceDate, 1)
    : "";
}
export function paymentDateBounds(balanceDate: string): {
  min: string;
  max: string;
} {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(balanceDate) ||
    !Number.isFinite(Date.parse(balanceDate))
  ) {
    return { min: "1900-01-01", max: "2100-12-31" };
  }
  const dayAfter = new Date(balanceDate + "T00:00:00Z");
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  return {
    min: dayAfter.toISOString().slice(0, 10),
    max: [anchoredDate(balanceDate, 600), "2100-12-31"].sort()[0],
  };
}
export function modeledPaymentDate(balanceDate: string, date: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(balanceDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  )
    return "";
  const [year, month] = balanceDate.split("-").map(Number);
  const [paymentYear, paymentMonth] = date.split("-").map(Number);
  const months = Math.max(1, (paymentYear - year) * 12 + paymentMonth - month);
  const due = anchoredDate(balanceDate, months);
  return due < date ? anchoredDate(balanceDate, months + 1) : due;
}
export function datedPayments(
  loan: MortgageLoan,
  scenario: MortgageScenario,
): MortgageOneTimePayment[] {
  const payments = [...(scenario.oneTimePayments || [])];
  if (scenario.oneTimeExtra > 0 && scenario.oneTimeMonth) {
    const [year, month] = loan.balanceDate.split("-").map(Number);
    const [paymentYear, paymentMonth] = scenario.oneTimeMonth
      .split("-")
      .map(Number);
    payments.push({
      id: "00000000-0000-0000-0000-000000000001",
      date: anchoredDate(
        loan.balanceDate,
        (paymentYear - year) * 12 + paymentMonth - month,
      ),
      amount: scenario.oneTimeExtra,
    });
  }
  return payments.sort((a, b) => a.date.localeCompare(b.date));
}
export function shortDate(value: string): string {
  return new Date(value + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
