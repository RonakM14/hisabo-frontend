import type {
  ProfileTemplate,
  MortgageInput,
  MortgageView,
  MortgageAnalysis,
  HomeImprovement,
  HomeSale,
} from "./mortgage";
import type {
  ExpenseCategory,
  CategoryCatalog,
  Profile,
  TransactionDraft,
  YearLedger,
} from "./types";
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
const profilePath = (id: string) => `/profiles/${encodeURIComponent(id)}`;
export const api = {
  profiles: (signal?: AbortSignal) =>
    request<Profile[]>("/profiles", { signal }),
  createProfile: (name: string, template: ProfileTemplate = "BUDGET") =>
    request<Profile>("/profiles", {
      method: "POST",
      body: JSON.stringify({ name, template }),
    }),
  renameProfile: (id: string, name: string) =>
    request<Profile>(profilePath(id), {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  years: (profile: string, signal?: AbortSignal) =>
    request<{ years: number[]; currency: string }>(
      `${profilePath(profile)}/years`,
      { signal },
    ),
  year: (profile: string, year: number, signal?: AbortSignal) =>
    request<YearLedger>(`${profilePath(profile)}/years/${year}`, { signal }),
  saveTransaction: (
    profile: string,
    year: number,
    revision: number,
    transaction: TransactionDraft,
    id?: string,
  ) =>
    request<YearLedger>(
      `${profilePath(profile)}/years/${year}/transactions${id ? "/" + id : ""}`,
      {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({ ...transaction, revision }),
      },
    ),
  deleteTransaction: (
    profile: string,
    year: number,
    revision: number,
    id: string,
  ) =>
    request<YearLedger>(
      `${profilePath(profile)}/years/${year}/transactions/${id}?revision=${revision}`,
      { method: "DELETE" },
    ),
  budgets: (
    profile: string,
    year: number,
    month: number,
    revision: number,
    budgets: Record<ExpenseCategory, number>,
  ) =>
    request<YearLedger>(
      `${profilePath(profile)}/years/${year}/months/${month}/budgets`,
      {
        method: "PUT",
        body: JSON.stringify({ revision, budgets }),
      },
    ),
  categories: (profile: string, year: number, catalog: CategoryCatalog) =>
    request<YearLedger>(
      `${profilePath(profile)}/budget-categories?year=${year}`,
      {
        method: "PUT",
        body: JSON.stringify(catalog),
      },
    ),
  mortgage: (profile: string, signal?: AbortSignal) =>
    request<MortgageView>(`${profilePath(profile)}/mortgage`, { signal }),
  previewMortgage: (profile: string, input: MortgageInput) =>
    request<MortgageAnalysis>(`${profilePath(profile)}/mortgage/preview`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  saveMortgage: (profile: string, revision: number, input: MortgageInput) =>
    request<MortgageView>(`${profilePath(profile)}/mortgage`, {
      method: "PUT",
      body: JSON.stringify({ ...input, revision }),
    }),
  saveHomeSale: (profile: string, revision: number, homeSale: HomeSale) =>
    request<MortgageView>(`${profilePath(profile)}/mortgage/home-sale`, {
      method: "PUT",
      body: JSON.stringify({ revision, homeSale }),
    }),
  saveImprovement: (
    profile: string,
    revision: number,
    input: Omit<HomeImprovement, "id">,
    id?: string,
  ) =>
    request<MortgageView>(
      `${profilePath(profile)}/mortgage/improvements${id ? "/" + id : ""}`,
      {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({ ...input, revision }),
      },
    ),
  deleteImprovement: (profile: string, revision: number, id: string) =>
    request<MortgageView>(
      `${profilePath(profile)}/mortgage/improvements/${id}?revision=${revision}`,
      { method: "DELETE" },
    ),
  mortgageExcel: async (profile: string): Promise<Blob> => {
    const response = await fetch(`/api${profilePath(profile)}/mortgage/excel`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => null);
      throw new ApiError(
        problem?.detail || "Could not download the mortgage workbook.",
        response.status,
      );
    }
    return response.blob();
  },
  download: async (profile: string, year: number): Promise<Blob> => {
    let response: Response;
    try {
      response = await fetch(
        `/api${profilePath(profile)}/years/${year}/excel`,
        { signal: AbortSignal.timeout(30000) },
      );
    } catch {
      throw new ApiError(
        "Could not download Excel. Check that the backend is running and try again.",
        0,
      );
    }
    if (!response.ok) {
      const problem = await response.json().catch(() => null);
      throw new ApiError(
        problem?.detail || "Could not create the Excel workbook.",
        response.status,
      );
    }
    return response.blob();
  },
};
