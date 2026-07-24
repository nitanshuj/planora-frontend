export const API_BASE_URL =
  (import.meta as any).env?.VITE_BACKEND_API_URL ||
  (typeof process !== "undefined" && process.env?.BACKEND_API_URL) ||
  "http://localhost:8000";
