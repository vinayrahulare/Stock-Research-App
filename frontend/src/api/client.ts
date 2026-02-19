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
  page?: number;
  page_size?: number;
}

export interface HoldingsListResponse {
  items: DividendHolding[];
  total: number;
}

export const fetchHoldings = async (
  params?: HoldingsListParams
): Promise<HoldingsListResponse> => {
  const { data } = await apiClient.get<HoldingsListResponse>("/holdings", {
    params: params ?? {},
  });
  return data;
};

export const purgeHoldings = async (): Promise<{ deleted: number }> => {
  const { data } = await apiClient.delete<{ message: string; deleted: number }>(
    "/holdings/purge"
  );
  return { deleted: data.deleted };
};

export const fetchStats = async () => {
  const { data } = await apiClient.get("/stats");
  return data;
};

export const importCsv = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await apiClient.post("/holdings/import-csv", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
};
