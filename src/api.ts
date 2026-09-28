import type { ExpenseCategory, TransactionDraft, YearLedger } from "./types";
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    throw new ApiError(
      "Cannot reach the backend. Start the Java app and try again.",
      0,
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      result?.detail ||
        "The backend could not complete your request. Your changes have not been confirmed.",
      response.status,
    );
  if (result === null)
    throw new ApiError(
      "The backend returned an unexpected response.",
      response.status,
    );
  return result as T;
}
export const api = {
  years: (signal?: AbortSignal) =>
    request<{ years: number[]; currency: string }>("/years", { signal }),
  year: (year: number, signal?: AbortSignal) =>
    request<YearLedger>(`/years/${year}`, { signal }),
  saveTransaction: (
    year: number,
    revision: number,
    transaction: TransactionDraft,
    id?: string,
  ) =>
    request<YearLedger>(`/years/${year}/transactions${id ? "/" + id : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify({ ...transaction, revision }),
    }),
  deleteTransaction: (year: number, revision: number, id: string) =>
    request<YearLedger>(
      `/years/${year}/transactions/${id}?revision=${revision}`,
      { method: "DELETE" },
    ),
  budgets: (
    year: number,
    month: number,
    revision: number,
    budgets: Record<ExpenseCategory, number>,
  ) =>
    request<YearLedger>(`/years/${year}/months/${month}/budgets`, {
      method: "PUT",
      body: JSON.stringify({ revision, budgets }),
    }),
};
