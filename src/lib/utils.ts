import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(n: number): string {
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR" });
}

export function formatDateHelper(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return dateStr; // fallback to original if parsing fails
  const day = String(dateObj.getDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();
  return `${day}-${month}-${year}`;
}
