import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export const apiClient = axios.create({
  baseURL,
  timeout: 8000,
});

export const fetchHoldings = async () => {
  const { data } = await apiClient.get("/holdings");
  return data;
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
