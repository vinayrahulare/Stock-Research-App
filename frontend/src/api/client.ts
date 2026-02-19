import axios from "axios";
import type { DividendHolding } from "../types";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export const apiClient = axios.create({
  baseURL,
  timeout: 8000,
});

export interface HoldingsListParams {
  ticker?: string;
  company?: string;
  sector?: string;
  valuation?: string;
  si_verdict?: string;
  why_it_fits?: string;
  ticker_search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface HoldingsListResponse {
  items: DividendHolding[];
  total: number;
}

export interface HoldingsFilterOptions {
  ticker: string[];
  company: string[];
  sector: string[];
  valuation: string[];
  si_verdict: string[];
  why_it_fits: string[];
}

export interface AuditLogEntry {
  id: number;
  action: string;
  file_name: string | null;
  imported_count: number;
  updated_count: number;
  status: "success" | "failed" | string;
  message: string;
  created_at: string;
}

export const fetchHoldings = async (
  params?: HoldingsListParams
): Promise<HoldingsListResponse> => {
  const { data } = await apiClient.get("/holdings", {
    params: params ?? {},
  });
  // Support both new shape { items, total } and legacy array
  if (Array.isArray(data)) {
    return { items: data, total: data.length };
  }
  if (data && typeof data === "object" && "items" in data && "total" in data) {
    return data as HoldingsListResponse;
  }
  return { items: [], total: 0 };
};

export const purgeHoldings = async (): Promise<{ deleted: number }> => {
  const { data } = await apiClient.delete<{ message: string; deleted: number }>(
    "/holdings/purge"
  );
  return { deleted: data.deleted };
};

export const fetchFilterOptions = async (): Promise<HoldingsFilterOptions> => {
  const { data } = await apiClient.get<HoldingsFilterOptions>(
    "/holdings/filter-options"
  );
  return data;
};

export const exportHoldingsCsv = async (
  params?: HoldingsListParams
): Promise<Blob> => {
  const { data } = await apiClient.get("/holdings/export-csv", {
    params: params ?? {},
    responseType: "blob",
  });
  return data as Blob;
};

export const fetchAuditLogs = async (limit = 100): Promise<AuditLogEntry[]> => {
  const { data } = await apiClient.get<AuditLogEntry[]>("/audit-logs", {
    params: { limit },
  });
  return data;
};

export const fetchStats = async () => {
  const { data } = await apiClient.get("/stats");
  return data;
};

export type DuplicateStrategy = "ask" | "skip" | "replace";

export const importCsv = async (
  file: File,
  duplicateStrategy: DuplicateStrategy = "ask"
) => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post("/holdings/import-csv", formData, {
    params: {
      duplicate_strategy: duplicateStrategy,
    },
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
};
