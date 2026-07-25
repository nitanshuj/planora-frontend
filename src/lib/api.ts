const rawUrl =
  (import.meta as any).env?.VITE_BACKEND_API_URL ||
  (import.meta as any).env?.VITE_API_BASE_URL ||
  "http://localhost:8000";

export const API_BASE_URL = rawUrl.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
