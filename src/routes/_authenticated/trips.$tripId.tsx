import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  Plane,
  Hotel,
  Bus,
  Car,
  Train,
  MapPin,
  Sparkles,
  Activity,
  Package,
  Upload,
  CheckCircle2,
  Clock3,
  Navigation,
  BookMarked,
  Plus,
  Trash2,
  ReceiptText,
  Wallet,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  UtensilsCrossed,
  AlertTriangle,
  Calendar,
  Home,
  PieChart,
  Pencil,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/api";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Line,
  ComposedChart,
  Legend,
} from "recharts";


// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
type BookingStatus = "planned" | "booked" | "paid";
type TripStatus = "planning" | "active" | "completed";

interface TripCategory {
  id: string;
  user_id: string | null;
  name: string;
  slug: string;
  icon_name: string;
  color_class: string;
  bg_class: string;
  is_system: boolean;
}

interface TripItem {
  id: string;
  trip_id: string;
  category_type: string; // slug of category
  title: string;
  estimated_cost: number;
  actual_cost: number | null;
  booking_status: BookingStatus;
  payment_method: string | null;
  expense_date: string | null;
  travel_date: string | null;
  check_in_date: string | null;
  check_out_date: string | null;
  receipt_id: string | null;
  company: string | null;
  details: Record<string, any>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface TripFinancialSummary {
  trip_id: string;
  total_budget: number;
  total_estimated_cost: number;
  total_actual_spent: number;
  remaining_budget: number;
  forecast_variance: number;
}

interface TripDetail {
  id: string;
  user_id: string;
  title: string;
  destination: string | null;
  start_date: string;
  end_date: string;
  total_budget: number;
  status: TripStatus;
  items: TripItem[];
  summary: TripFinancialSummary | null;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export const Route = createFileRoute("/_authenticated/trips/$tripId")({
  loader: async ({ params }) => {
    const trip: TripDetail = await apiFetch(`/trips/${params.tripId}`);
    return { trip };
  },
  component: TripDetailPage,
});

// ---------------------------------------------------------------------------
// Helpers & Icon Resolver
// ---------------------------------------------------------------------------
const ICON_MAP: Record<string, React.ElementType> = {
  Plane,
  Hotel,
  Car,
  Bus,
  Train,
  UtensilsCrossed,
  MapPin,
  Activity,
  Package,
  Wallet,
  Sparkles,
};

function getCategoryIcon(iconName: string): React.ElementType {
  return ICON_MAP[iconName] || Package;
}

const BOOKING_STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  planned: { label: "PLANNED", className: "text-amber-500 bg-amber-500/10", icon: Clock3 },
  booked: { label: "BOOKED", className: "text-sky-500 bg-sky-500/10", icon: BookMarked },
  paid: { label: "PAID", className: "text-emerald-500 bg-emerald-500/10", icon: CheckCircle2 },
};

const TRIP_STATUS_CYCLE: TripStatus[] = ["planning", "active", "completed"];

function fmt(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtShortDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// KPI Bar
// ---------------------------------------------------------------------------
function KpiBar({
  summary,
  totalBudget,
}: {
  summary: TripFinancialSummary | null;
  totalBudget: number;
}) {
  const budget = summary?.total_budget ?? totalBudget;
  const estimated = summary?.total_estimated_cost ?? 0;
  const spent = summary?.total_actual_spent ?? 0;
  const remaining = budget - spent;
  const spentPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Budget", value: fmt(budget), icon: Wallet, color: "text-foreground" },
          { label: "Estimated", value: fmt(estimated), icon: TrendingUp, color: "text-amber-500" },
          { label: "Spent", value: fmt(spent), icon: TrendingDown, color: "text-primary" },
          {
            label: "Remaining",
            value: fmt(remaining),
            icon: Wallet,
            color: remaining < 0 ? "text-destructive" : "text-emerald-500",
          },
        ].map((k) => (
          <div key={k.label} className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <k.icon className="h-3 w-3" />
              {k.label}
            </div>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>
      {/* Spent progress bar */}
      <div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${spentPct}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{spentPct.toFixed(1)}% of budget spent</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AIScannerPanel Component (Category-aware)
// ---------------------------------------------------------------------------
function AIScannerPanel({
  tripId,
  categories,
  onItemLogged,
}: {
  tripId: string;
  categories: TripCategory[];
  onItemLogged: (item: TripItem) => void;
}) {
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>(categories[0]?.slug || "flight");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState<{
    title: string;
    company: string;
    amount: string;
    expense_date: string;
    payment_method: string;
    travel_date: string;
    check_in_date: string;
    check_out_date: string;
    notes: string;
    departure_city: string;
    arrival_city: string;
    source_city: string;
    destination_city: string;
    departure_time: string;
    arrival_time: string;
    hotel_address: string;
    hotel_city: string;
    hotel_state: string;
    hotel_country: string;
  } | null>(null);
  const [logging, setLogging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isFlight = selectedCategorySlug === "flight";
  const isHotel = selectedCategorySlug === "hotel";
  const isTrain = selectedCategorySlug === "train";
  const isTravel = isFlight || isTrain || ["cab", "transport"].includes(selectedCategorySlug);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);
      setReviewForm(null);
      setReceiptId(null);
      try {
        const token = localStorage.getItem("auth_token");
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(
          `${API_BASE_URL}/api/v1/receipts/trip-upload?trip_id=${tripId}&category_type=${selectedCategorySlug}`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `Upload failed (${res.status})`);
        }
        const data = await res.json();
        const raw = data.draft_item || {};

        setReceiptId(data.receipt_id);
        setReviewForm({
          title: raw.hotel_name || raw.item_name || (isFlight ? "Flight Booking" : isHotel ? "Hotel Stay" : "Receipt Item"),
          company: raw.company || "",
          amount: String(raw.amount || 0),
          expense_date: raw.expense_date || new Date().toISOString().slice(0, 10),
          payment_method: raw.payment_method || "Cash",
          travel_date: raw.travel_date || "",
          check_in_date: raw.check_in_date || "",
          check_out_date: raw.check_out_date || "",
          notes: raw.remarks || "",
          departure_city: raw.departure_city || "",
          arrival_city: raw.arrival_city || "",
          source_city: raw.source_city || "",
          destination_city: raw.destination_city || "",
          departure_time: raw.departure_time || "",
          arrival_time: raw.arrival_time || "",
          hotel_address: raw.hotel_address || "",
          hotel_city: raw.hotel_city || "",
          hotel_state: raw.hotel_state || "",
          hotel_country: raw.hotel_country || "India",
        });
      } catch (err: any) {
        setError(err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [tripId, selectedCategorySlug, isFlight, isHotel],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const logExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm) return;
    setLogging(true);
    setError(null);
    try {
      const amt = parseFloat(reviewForm.amount);
      const details: Record<string, any> = {};

      if (isFlight) {
        if (reviewForm.departure_city) details.departure_city = reviewForm.departure_city;
        if (reviewForm.arrival_city) details.arrival_city = reviewForm.arrival_city;
        if (reviewForm.departure_time) details.departure_time = reviewForm.departure_time;
        if (reviewForm.arrival_time) details.arrival_time = reviewForm.arrival_time;
      } else if (isTrain) {
        if (reviewForm.source_city) details.source_city = reviewForm.source_city;
        if (reviewForm.destination_city) details.destination_city = reviewForm.destination_city;
        if (reviewForm.departure_time) details.departure_time = reviewForm.departure_time;
        if (reviewForm.arrival_time) details.arrival_time = reviewForm.arrival_time;
      } else if (isHotel) {
        if (reviewForm.hotel_address) details.hotel_address = reviewForm.hotel_address;
        if (reviewForm.hotel_city) details.hotel_city = reviewForm.hotel_city;
        if (reviewForm.hotel_state) details.hotel_state = reviewForm.hotel_state;
        if (reviewForm.hotel_country) details.hotel_country = reviewForm.hotel_country;
      }

      const item = await apiFetch<TripItem>(`/trips/${tripId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_type: selectedCategorySlug,
          title: reviewForm.title,
          company: reviewForm.company || null,
          estimated_cost: amt,
          actual_cost: amt,
          booking_status: "paid",
          payment_method: reviewForm.payment_method,
          expense_date: reviewForm.expense_date,
          travel_date: reviewForm.travel_date || null,
          check_in_date: reviewForm.check_in_date || null,
          check_out_date: reviewForm.check_out_date || null,
          receipt_id: receiptId,
          details,
          notes: reviewForm.notes || null,
        }),
      });
      onItemLogged(item);
      setReviewForm(null);
    } catch (err: any) {
      setError(err.message || "Failed to log expense");
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold">AI Receipt & Invoice Scanner</h3>
          <p className="text-xs text-muted-foreground">Select a category, upload receipt, review & save</p>
        </div>
      </div>

      {/* Pre-upload Category Selector */}
      {!reviewForm && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground block">1. Target Expense Category *</label>
          <select
            value={selectedCategorySlug}
            onChange={(e) => setSelectedCategorySlug(e.target.value)}
            disabled={uploading}
            className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Drop Zone */}
      {!reviewForm && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground block">2. Upload Receipt / Invoice *</label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer py-10 px-4 transition-colors ${
              dragging ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40 hover:bg-accent/30"
            }`}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
            <div className="text-center">
              <p className="text-sm font-semibold">{uploading ? "AI Reading Receipt…" : "Drop receipt here or click to browse"}</p>
              <p className="text-xs text-muted-foreground mt-1">JPEG · PNG · WebP · HEIC (Max 10MB)</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
            />
          </div>
        </div>
      )}

      {/* Post-scan Review & Edit Form */}
      {reviewForm && (
        <form onSubmit={logExpense} className="space-y-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-bold text-foreground">Review Extracted Data</h4>
            </div>
            <button type="button" onClick={() => setReviewForm(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                {isHotel ? "Hotel Name *" : isFlight ? "Flight Service *" : isTrain ? "Train Service *" : "Service *"}
              </label>
              <input required type="text" value={reviewForm.title} onChange={(e) => setReviewForm((p) => p && ({ ...p, title: e.target.value }))}
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Company (Optional)</label>
              <input type="text" value={reviewForm.company} onChange={(e) => setReviewForm((p) => p && ({ ...p, company: e.target.value }))} placeholder="Airline / Vendor / Hotel"
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Amount Paid (₹) *</label>
              <input required type="number" min="0" value={reviewForm.amount} onChange={(e) => setReviewForm((p) => p && ({ ...p, amount: e.target.value }))}
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-xs font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Date of Payment *</label>
              <input required type="date" value={reviewForm.expense_date} onChange={(e) => setReviewForm((p) => p && ({ ...p, expense_date: e.target.value }))}
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Payment Method</label>
            <select value={reviewForm.payment_method} onChange={(e) => setReviewForm((p) => p && ({ ...p, payment_method: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40">
              {["Cash", "UPI", "Debit Card", "Credit Card", "Netbanking", "Cheque"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          {/* Flights Extracted Details */}
          {isFlight && (
            <div className="space-y-3 rounded-xl bg-background/80 border border-border/40 p-3">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Flight Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Departure City</label>
                  <input type="text" value={reviewForm.departure_city} onChange={(e) => setReviewForm((p) => p && ({ ...p, departure_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Arrival City</label>
                  <input type="text" value={reviewForm.arrival_city} onChange={(e) => setReviewForm((p) => p && ({ ...p, arrival_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Date of Journey</label>
                  <input type="date" value={reviewForm.travel_date} onChange={(e) => setReviewForm((p) => p && ({ ...p, travel_date: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Dep Time (24h)</label>
                  <input type="time" value={reviewForm.departure_time} onChange={(e) => setReviewForm((p) => p && ({ ...p, departure_time: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Arr Time (24h)</label>
                  <input type="time" value={reviewForm.arrival_time} onChange={(e) => setReviewForm((p) => p && ({ ...p, arrival_time: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
            </div>
          )}

          {/* Trains Extracted Details */}
          {isTrain && (
            <div className="space-y-3 rounded-xl bg-background/80 border border-border/40 p-3">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Train Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Source City</label>
                  <input type="text" value={reviewForm.source_city} onChange={(e) => setReviewForm((p) => p && ({ ...p, source_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Destination City</label>
                  <input type="text" value={reviewForm.destination_city} onChange={(e) => setReviewForm((p) => p && ({ ...p, destination_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Date of Journey</label>
                  <input type="date" value={reviewForm.travel_date} onChange={(e) => setReviewForm((p) => p && ({ ...p, travel_date: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Dep Time (24h)</label>
                  <input type="time" value={reviewForm.departure_time} onChange={(e) => setReviewForm((p) => p && ({ ...p, departure_time: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Arr Time (24h)</label>
                  <input type="time" value={reviewForm.arrival_time} onChange={(e) => setReviewForm((p) => p && ({ ...p, arrival_time: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
            </div>
          )}

          {/* Hotels Extracted Details */}
          {isHotel && (
            <div className="space-y-3 rounded-xl bg-background/80 border border-border/40 p-3">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Hotel Location & Booking</p>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Hotel Address</label>
                <input type="text" value={reviewForm.hotel_address} onChange={(e) => setReviewForm((p) => p && ({ ...p, hotel_address: e.target.value }))}
                  className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">City</label>
                  <input type="text" value={reviewForm.hotel_city} onChange={(e) => setReviewForm((p) => p && ({ ...p, hotel_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">State</label>
                  <input type="text" value={reviewForm.hotel_state} onChange={(e) => setReviewForm((p) => p && ({ ...p, hotel_state: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Country</label>
                  <input type="text" value={reviewForm.hotel_country} onChange={(e) => setReviewForm((p) => p && ({ ...p, hotel_country: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Check-in Date</label>
                  <input type="date" value={reviewForm.check_in_date} onChange={(e) => setReviewForm((p) => p && ({ ...p, check_in_date: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Check-out Date</label>
                  <input type="date" value={reviewForm.check_out_date} min={reviewForm.check_in_date} onChange={(e) => setReviewForm((p) => p && ({ ...p, check_out_date: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Remarks (Optional)</label>
            <input type="text" value={reviewForm.notes} onChange={(e) => setReviewForm((p) => p && ({ ...p, notes: e.target.value }))} placeholder="Optional notes"
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <button
            type="submit"
            disabled={logging}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {logging ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
            {logging ? "Saving Expense…" : "Confirm & Save Expense"}
          </button>
        </form>
      )}

      {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Log Expense Modal
// ---------------------------------------------------------------------------
function QuickLogModal({
  open,
  tripId,
  category,
  onClose,
  onLogged,
}: {
  open: boolean;
  tripId: string;
  category: TripCategory;
  onClose: () => void;
  onLogged: (item: TripItem) => void;
}) {
  const isFlight = category.slug === "flight";
  const isHotel = category.slug === "hotel";
  const isTrain = category.slug === "train";
  const isTravel = isFlight || isTrain || ["cab", "transport"].includes(category.slug);

  const [form, setForm] = useState({
    title: "",
    company: "",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    travel_date: "",
    check_in_date: "",
    check_out_date: "",
    payment_method: "Cash",
    notes: "",
    // Category Details JSONB
    departure_city: "",
    arrival_city: "",
    source_city: "",
    destination_city: "",
    departure_time: "",
    arrival_time: "",
    hotel_address: "",
    hotel_city: "",
    hotel_state: "",
    hotel_country: "India",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const amt = parseFloat(form.amount);
      const details: Record<string, any> = {};

      if (isFlight) {
        if (form.departure_city) details.departure_city = form.departure_city;
        if (form.arrival_city) details.arrival_city = form.arrival_city;
        if (form.departure_time) details.departure_time = form.departure_time;
        if (form.arrival_time) details.arrival_time = form.arrival_time;
      } else if (isTrain) {
        if (form.source_city) details.source_city = form.source_city;
        if (form.destination_city) details.destination_city = form.destination_city;
        if (form.departure_time) details.departure_time = form.departure_time;
        if (form.arrival_time) details.arrival_time = form.arrival_time;
      } else if (isHotel) {
        if (form.hotel_address) details.hotel_address = form.hotel_address;
        if (form.hotel_city) details.hotel_city = form.hotel_city;
        if (form.hotel_state) details.hotel_state = form.hotel_state;
        if (form.hotel_country) details.hotel_country = form.hotel_country;
      }

      const item = await apiFetch<TripItem>(`/trips/${tripId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_type: category.slug,
          title: form.title,
          company: form.company || null,
          estimated_cost: amt,
          actual_cost: amt,
          booking_status: "paid",
          payment_method: form.payment_method,
          expense_date: form.expense_date,
          travel_date: form.travel_date || null,
          check_in_date: form.check_in_date || null,
          check_out_date: form.check_out_date || null,
          details,
          notes: form.notes || null,
        }),
      });
      onLogged(item);
      onClose();
      setForm({
        title: "",
        company: "",
        amount: "",
        expense_date: new Date().toISOString().slice(0, 10),
        travel_date: "",
        check_in_date: "",
        check_out_date: "",
        payment_method: "Cash",
        notes: "",
        departure_city: "",
        arrival_city: "",
        source_city: "",
        destination_city: "",
        departure_time: "",
        arrival_time: "",
        hotel_address: "",
        hotel_city: "",
        hotel_state: "",
        hotel_country: "India",
      });
    } catch (err: any) {
      setError(err.message || "Failed to log cost");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md my-8 rounded-2xl border border-border/60 bg-card shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Log Cost — {category.name}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {isHotel ? "Hotel Name *" : isFlight ? "Flight Service *" : isTrain ? "Train Service *" : "Service *"}
            </label>
            <input required type="text" placeholder={isHotel ? "e.g. Mayfair Resort & Spa" : isFlight ? "e.g. Flight BLR-DEL" : "Service Name"} value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Company (Optional)</label>
            <input type="text" placeholder={isFlight ? "e.g. IndiGo" : isHotel ? "e.g. Taj / MakeMyTrip" : "e.g. IRCTC"} value={form.company}
              onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Amount Paid (₹) *</label>
            <input required type="number" min="0" placeholder="0.00" value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          {/* Flights specific fields */}
          {isFlight && (
            <div className="space-y-3 rounded-xl bg-muted/20 border border-border/40 p-3">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Flight Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Departure City</label>
                  <input type="text" placeholder="e.g. New Delhi" value={form.departure_city}
                    onChange={(e) => setForm((p) => ({ ...p, departure_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Arrival City</label>
                  <input type="text" placeholder="e.g. Bagdogra" value={form.arrival_city}
                    onChange={(e) => setForm((p) => ({ ...p, arrival_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Departure Time (24h)</label>
                  <input type="time" value={form.departure_time}
                    onChange={(e) => setForm((p) => ({ ...p, departure_time: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Arrival Time (24h)</label>
                  <input type="time" value={form.arrival_time}
                    onChange={(e) => setForm((p) => ({ ...p, arrival_time: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
            </div>
          )}

          {/* Trains specific fields */}
          {isTrain && (
            <div className="space-y-3 rounded-xl bg-muted/20 border border-border/40 p-3">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Train Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Source City</label>
                  <input type="text" placeholder="e.g. Kolkata" value={form.source_city}
                    onChange={(e) => setForm((p) => ({ ...p, source_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Destination City</label>
                  <input type="text" placeholder="e.g. Siliguri" value={form.destination_city}
                    onChange={(e) => setForm((p) => ({ ...p, destination_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Departure Time (24h)</label>
                  <input type="time" value={form.departure_time}
                    onChange={(e) => setForm((p) => ({ ...p, departure_time: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Arrival Time (24h)</label>
                  <input type="time" value={form.arrival_time}
                    onChange={(e) => setForm((p) => ({ ...p, arrival_time: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
            </div>
          )}

          {/* Hotels specific fields */}
          {isHotel && (
            <div className="space-y-3 rounded-xl bg-muted/20 border border-border/40 p-3">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Hotel Location</p>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Hotel Address (Optional)</label>
                <input type="text" placeholder="e.g. Mall Road" value={form.hotel_address}
                  onChange={(e) => setForm((p) => ({ ...p, hotel_address: e.target.value }))}
                  className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">City</label>
                  <input type="text" placeholder="Gangtok" value={form.hotel_city}
                    onChange={(e) => setForm((p) => ({ ...p, hotel_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">State</label>
                  <input type="text" placeholder="Sikkim" value={form.hotel_state}
                    onChange={(e) => setForm((p) => ({ ...p, hotel_state: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Country</label>
                  <input type="text" value={form.hotel_country}
                    onChange={(e) => setForm((p) => ({ ...p, hotel_country: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
            </div>
          )}

          {/* Conditional Dates */}
          {isTravel && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Date of Journey</label>
              <input type="date" value={form.travel_date}
                onChange={(e) => setForm((p) => ({ ...p, travel_date: e.target.value }))}
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          )}

          {isHotel && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Check-in Date</label>
                <input type="date" value={form.check_in_date}
                  onChange={(e) => setForm((p) => ({ ...p, check_in_date: e.target.value }))}
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Check-out Date</label>
                <input type="date" value={form.check_out_date} min={form.check_in_date}
                  onChange={(e) => setForm((p) => ({ ...p, check_out_date: e.target.value }))}
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Date of Payment *</label>
            <input required type="date" value={form.expense_date}
              onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Payment Method</label>
            <select value={form.payment_method} onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              {["Cash", "UPI", "Debit Card", "Credit Card", "Netbanking", "Cheque"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Remarks (Optional)</label>
            <input type="text" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes"
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border/70 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {loading ? "Saving…" : "Log Cost"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Plan Item Modal
// ---------------------------------------------------------------------------
function AddPlanModal({
  open,
  tripId,
  category,
  onClose,
  onAdded,
}: {
  open: boolean;
  tripId: string;
  category: TripCategory;
  onClose: () => void;
  onAdded: (i: TripItem) => void;
}) {
  const isFlight = category.slug === "flight";
  const isHotel = category.slug === "hotel";
  const isTrain = category.slug === "train";
  const isTravel = isFlight || isTrain || ["cab", "transport"].includes(category.slug);

  const [form, setForm] = useState({
    title: "",
    company: "",
    estimated_cost: "",
    travel_date: "",
    check_in_date: "",
    check_out_date: "",
    notes: "",
    departure_city: "",
    arrival_city: "",
    source_city: "",
    destination_city: "",
    departure_time: "",
    arrival_time: "",
    hotel_address: "",
    hotel_city: "",
    hotel_state: "",
    hotel_country: "India",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const details: Record<string, any> = {};

      if (isFlight) {
        if (form.departure_city) details.departure_city = form.departure_city;
        if (form.arrival_city) details.arrival_city = form.arrival_city;
        if (form.departure_time) details.departure_time = form.departure_time;
        if (form.arrival_time) details.arrival_time = form.arrival_time;
      } else if (isTrain) {
        if (form.source_city) details.source_city = form.source_city;
        if (form.destination_city) details.destination_city = form.destination_city;
        if (form.departure_time) details.departure_time = form.departure_time;
        if (form.arrival_time) details.arrival_time = form.arrival_time;
      } else if (isHotel) {
        if (form.hotel_address) details.hotel_address = form.hotel_address;
        if (form.hotel_city) details.hotel_city = form.hotel_city;
        if (form.hotel_state) details.hotel_state = form.hotel_state;
        if (form.hotel_country) details.hotel_country = form.hotel_country;
      }

      const item = await apiFetch<TripItem>(`/trips/${tripId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_type: category.slug,
          title: form.title,
          company: form.company || null,
          estimated_cost: parseFloat(form.estimated_cost),
          travel_date: form.travel_date || null,
          check_in_date: form.check_in_date || null,
          check_out_date: form.check_out_date || null,
          details,
          notes: form.notes || null,
          booking_status: "planned",
        }),
      });
      onAdded(item);
      onClose();
      setForm({
        title: "",
        company: "",
        estimated_cost: "",
        travel_date: "",
        check_in_date: "",
        check_out_date: "",
        notes: "",
        departure_city: "",
        arrival_city: "",
        source_city: "",
        destination_city: "",
        departure_time: "",
        arrival_time: "",
        hotel_address: "",
        hotel_city: "",
        hotel_state: "",
        hotel_country: "India",
      });
    } catch (err: any) {
      setError(err.message || "Failed to add plan");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md my-8 rounded-2xl border border-border/60 bg-card shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Add Plan — {category.name}</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {isHotel ? "Hotel Name *" : isFlight ? "Flight Service *" : isTrain ? "Train Service *" : "Service *"}
            </label>
            <input required value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder={isHotel ? "e.g. Mayfair Resort & Spa" : isFlight ? "e.g. Flight Booking" : "Service Name"}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Company (Optional)</label>
            <input type="text" placeholder={isFlight ? "e.g. IndiGo" : isHotel ? "e.g. MakeMyTrip" : "Company / Provider"} value={form.company}
              onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Estimated Cost (₹) *</label>
            <input required type="number" min="0" value={form.estimated_cost} onChange={(e) => setForm((p) => ({ ...p, estimated_cost: e.target.value }))} placeholder="0"
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          {/* Flights specific fields */}
          {isFlight && (
            <div className="space-y-3 rounded-xl bg-muted/20 border border-border/40 p-3">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Flight Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Departure City</label>
                  <input type="text" placeholder="e.g. New Delhi" value={form.departure_city}
                    onChange={(e) => setForm((p) => ({ ...p, departure_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Arrival City</label>
                  <input type="text" placeholder="e.g. Bagdogra" value={form.arrival_city}
                    onChange={(e) => setForm((p) => ({ ...p, arrival_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Departure Time (24h)</label>
                  <input type="time" value={form.departure_time}
                    onChange={(e) => setForm((p) => ({ ...p, departure_time: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Arrival Time (24h)</label>
                  <input type="time" value={form.arrival_time}
                    onChange={(e) => setForm((p) => ({ ...p, arrival_time: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
            </div>
          )}

          {/* Trains specific fields */}
          {isTrain && (
            <div className="space-y-3 rounded-xl bg-muted/20 border border-border/40 p-3">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Train Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Source City</label>
                  <input type="text" placeholder="e.g. Kolkata" value={form.source_city}
                    onChange={(e) => setForm((p) => ({ ...p, source_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Destination City</label>
                  <input type="text" placeholder="e.g. Siliguri" value={form.destination_city}
                    onChange={(e) => setForm((p) => ({ ...p, destination_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Departure Time (24h)</label>
                  <input type="time" value={form.departure_time}
                    onChange={(e) => setForm((p) => ({ ...p, departure_time: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Arrival Time (24h)</label>
                  <input type="time" value={form.arrival_time}
                    onChange={(e) => setForm((p) => ({ ...p, arrival_time: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
            </div>
          )}

          {/* Hotels specific fields */}
          {isHotel && (
            <div className="space-y-3 rounded-xl bg-muted/20 border border-border/40 p-3">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wide">Hotel Location</p>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Hotel Address (Optional)</label>
                <input type="text" placeholder="e.g. Mall Road" value={form.hotel_address}
                  onChange={(e) => setForm((p) => ({ ...p, hotel_address: e.target.value }))}
                  className="w-full rounded-lg border border-border/70 bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">City</label>
                  <input type="text" placeholder="Gangtok" value={form.hotel_city}
                    onChange={(e) => setForm((p) => ({ ...p, hotel_city: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">State</label>
                  <input type="text" placeholder="Sikkim" value={form.hotel_state}
                    onChange={(e) => setForm((p) => ({ ...p, hotel_state: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Country</label>
                  <input type="text" value={form.hotel_country}
                    onChange={(e) => setForm((p) => ({ ...p, hotel_country: e.target.value }))}
                    className="w-full rounded-lg border border-border/70 bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              </div>
            </div>
          )}

          {/* Conditional Dates */}
          {isTravel && (
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Date of Journey</label>
              <input type="date" value={form.travel_date}
                onChange={(e) => setForm((p) => ({ ...p, travel_date: e.target.value }))}
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          )}

          {isHotel && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Check-in Date</label>
                <input type="date" value={form.check_in_date}
                  onChange={(e) => setForm((p) => ({ ...p, check_in_date: e.target.value }))}
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Check-out Date</label>
                <input type="date" value={form.check_out_date} min={form.check_in_date}
                  onChange={(e) => setForm((p) => ({ ...p, check_out_date: e.target.value }))}
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Remarks (Optional)</label>
            <input value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes"
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border/70 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {loading ? "Adding…" : "Add Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Category Modal
// ---------------------------------------------------------------------------
function AddCategoryModal({
  open,
  existingCategories,
  onClose,
  onCreated,
}: {
  open: boolean;
  existingCategories: TripCategory[];
  onClose: () => void;
  onCreated: (cat: TripCategory) => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    // Case-insensitive check
    if (existingCategories.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
      setError(`Category "${cleanName}" already exists.`);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const created = await apiFetch<TripCategory>("/trip-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          icon_name: "Package",
          color_class: "text-slate-400",
          bg_class: "bg-slate-400/10",
        }),
      });
      onCreated(created);
      onClose();
      setName("");
    } catch (err: any) {
      setError(err.message || "Failed to create category");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Add Expense Category</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Category Name *</label>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="e.g. Sightseeing Pass, Shopping"
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border/70 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {loading ? "Creating…" : "Create Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Index Card Component
// ---------------------------------------------------------------------------
function IndexCard({
  category,
  items,
  tripId,
  onItemAdded,
  onItemDeleted,
}: {
  category: TripCategory;
  items: TripItem[];
  tripId: string;
  onItemAdded: (i: TripItem) => void;
  onItemDeleted: (id: string) => void;
}) {
  const Icon = getCategoryIcon(category.icon_name);
  const [addPlanOpen, setAddPlanOpen] = useState(false);
  const [logCostOpen, setLogCostOpen] = useState(false);

  // Single-table financial calculations
  const totalEstimated = items.reduce((s, i) => s + Number(i.estimated_cost || 0), 0);
  const totalSpent = items.reduce(
    (s, i) => s + (i.actual_cost != null || i.booking_status === "paid" ? Number(i.actual_cost ?? i.estimated_cost) : 0),
    0,
  );

  const deleteItem = async (itemId: string) => {
    try {
      await apiFetch(`/trips/${tripId}/items/${itemId}`, { method: "DELETE" });
      onItemDeleted(itemId);
    } catch {}
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden flex flex-col justify-between">
      <div>
        {/* Card Header */}
        <div className={`px-4 py-3 flex items-center justify-between gap-3 border-b border-border/40 ${category.bg_class}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Icon className={`h-4 w-4 shrink-0 ${category.color_class}`} />
            <span className={`text-sm font-semibold truncate ${category.color_class}`}>{category.name}</span>
          </div>
          <div className="text-xs text-right text-muted-foreground shrink-0">
            <span>Est: <strong>{fmt(totalEstimated)}</strong></span>
            <span className="mx-1 text-border">|</span>
            <span>Spent: <strong>{fmt(totalSpent)}</strong></span>
          </div>
        </div>

        {/* Items List */}
        <div className="divide-y divide-border/30">
          {items.length === 0 && (
            <p className="px-4 py-4 text-xs text-muted-foreground italic text-center">No items yet. Click + Add Plan or + Log Cost.</p>
          )}
          {items.map((item) => {
            const sc = BOOKING_STATUS_CONFIG[item.booking_status];
            const StatusIcon = sc.icon;
            const displayCost = item.actual_cost != null ? item.actual_cost : item.estimated_cost;
            const d = item.details || {};

            // Category detail summary line
            let detailSummary: string | null = null;
            if (item.category_type === "flight") {
              const route = d.departure_city && d.arrival_city ? `${d.departure_city} ✈ ${d.arrival_city}` : null;
              const times = d.departure_time ? `${d.departure_time}${d.arrival_time ? ` - ${d.arrival_time}` : ""}` : null;
              detailSummary = [item.company, route, times].filter(Boolean).join(" · ");
            } else if (item.category_type === "train") {
              const route = d.source_city && d.destination_city ? `${d.source_city} 🚆 ${d.destination_city}` : null;
              const times = d.departure_time ? `${d.departure_time}${d.arrival_time ? ` - ${d.arrival_time}` : ""}` : null;
              detailSummary = [item.company, route, times].filter(Boolean).join(" · ");
            } else if (item.category_type === "hotel") {
              const loc = [d.hotel_city, d.hotel_state, d.hotel_country].filter(Boolean).join(", ");
              detailSummary = [item.company, loc].filter(Boolean).join(" · ");
            } else if (item.company) {
              detailSummary = item.company;
            }

            const dateStr = item.travel_date
              ? `🛫 ${fmtShortDate(item.travel_date)}`
              : item.check_in_date
              ? `🏨 ${fmtShortDate(item.check_in_date)}${item.check_out_date ? ` → ${fmtShortDate(item.check_out_date)}` : ""}`
              : null;

            return (
              <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3 group">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {detailSummary && <p className="text-xs text-muted-foreground truncate">{detailSummary}</p>}
                  {dateStr && <p className="text-[11px] text-primary/80 font-medium truncate mt-0.5">{dateStr}</p>}
                  {item.notes && <p className="text-xs text-muted-foreground truncate">{item.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold">{fmt(Number(displayCost))}</span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${sc.className}`}>
                    <StatusIcon className="h-2.5 w-2.5" />
                    {sc.label}
                  </span>
                  <button onClick={() => deleteItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-4 py-3 border-t border-border/40 flex gap-2">
        <button onClick={() => setAddPlanOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-border/70 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors">
          <Plus className="h-3 w-3" /> Add Plan
        </button>
        <button onClick={() => setLogCostOpen(true)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 py-1.5 text-xs text-primary hover:bg-primary/10 transition-colors">
          <Plus className="h-3 w-3" /> Log Cost
        </button>
      </div>

      <AddPlanModal open={addPlanOpen} tripId={tripId} category={category}
        onClose={() => setAddPlanOpen(false)} onAdded={(i) => { onItemAdded(i); setAddPlanOpen(false); }} />
      <QuickLogModal open={logCostOpen} tripId={tripId} category={category}
        onClose={() => setLogCostOpen(false)} onLogged={(i) => { onItemAdded(i); setLogCostOpen(false); }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Expense Modal (for Expense Ledger)
// ---------------------------------------------------------------------------
function EditExpenseModal({
  open,
  tripId,
  item,
  categories,
  onClose,
  onUpdated,
}: {
  open: boolean;
  tripId: string;
  item: TripItem | null;
  categories: TripCategory[];
  onClose: () => void;
  onUpdated: (item: TripItem) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    company: "",
    amount: "",
    category_type: "",
    expense_date: "",
    payment_method: "Cash",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      const cost = item.actual_cost ?? item.estimated_cost;
      const dateVal = item.expense_date || item.travel_date || item.check_in_date || "";
      setForm({
        title: item.title || "",
        company: item.company || "",
        amount: String(cost || 0),
        category_type: item.category_type || categories[0]?.slug || "miscellaneous",
        expense_date: dateVal,
        payment_method: item.payment_method || "Cash",
        notes: item.notes || "",
      });
    }
  }, [item, categories]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setLoading(true);
    setError(null);
    try {
      const amt = parseFloat(form.amount);
      const updated = await apiFetch<TripItem>(`/trips/${tripId}/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          company: form.company || null,
          category_type: form.category_type,
          actual_cost: amt,
          estimated_cost: item.estimated_cost > 0 ? item.estimated_cost : amt,
          expense_date: form.expense_date || null,
          payment_method: form.payment_method,
          notes: form.notes || null,
        }),
      });
      onUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update expense");
    } finally {
      setLoading(false);
    }
  };

  if (!open || !item) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Edit Expense</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Service *</label>
            <input required type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Company (Optional)</label>
            <input type="text" placeholder="Provider / Airline / Hotel Company" value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Amount Paid (₹) *</label>
            <input required type="number" min="0" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Category</label>
            <select value={form.category_type} onChange={(e) => setForm((p) => ({ ...p, category_type: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Date of Payment</label>
            <input type="date" value={form.expense_date} onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Payment Method</label>
            <select value={form.payment_method} onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              {["Cash", "UPI", "Debit Card", "Credit Card", "Netbanking", "Cheque"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Remarks (Optional)</label>
            <input type="text" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes"
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border/70 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expense Ledger (Paid items with 20 items/page pagination & Edit)
// ---------------------------------------------------------------------------
function ExpenseLedger({
  tripId,
  items,
  categories,
  onItemUpdated,
  onItemDeleted,
}: {
  tripId: string;
  items: TripItem[];
  categories: TripCategory[];
  onItemUpdated: (i: TripItem) => void;
  onItemDeleted: (id: string) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [editingItem, setEditingItem] = useState<TripItem | null>(null);
  const pageSize = 20;

  const paidItems = items.filter((i) => i.actual_cost != null || i.booking_status === "paid");
  if (paidItems.length === 0) return null;

  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c]));

  const totalPages = Math.ceil(paidItems.length / pageSize) || 1;
  const validPage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginatedItems = paidItems.slice((validPage - 1) * pageSize, validPage * pageSize);

  const deleteLedgerItem = async (itemId: string) => {
    try {
      await apiFetch(`/trips/${tripId}/items/${itemId}`, { method: "DELETE" });
      onItemDeleted(itemId);
    } catch {}
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Permanent Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-2.5">
          <ReceiptText className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Expense Ledger</span>
          <span className="text-xs text-muted-foreground ml-1">({paidItems.length} entries)</span>
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border/30">
              {["Date of Payment", "Service", "Category", "Amount Paid", "Payment Method", "Company", "Remarks", "Action"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {paginatedItems.map((item) => {
              const cat = categoryMap[item.category_type] || {
                name: item.category_type,
                color_class: "text-slate-400",
                bg_class: "bg-slate-400/10",
              };
              const cost = item.actual_cost ?? item.estimated_cost;
              const displayDate = item.expense_date || item.travel_date || item.check_in_date || item.created_at;

              return (
                <tr key={item.id} className="hover:bg-accent/20 transition-colors group">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(displayDate)}</td>
                  <td className="px-4 py-2.5 font-medium max-w-[180px] truncate">{item.title}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cat.bg_class} ${cat.color_class}`}>
                      {cat.name}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-primary whitespace-nowrap">{fmt(Number(cost))}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{item.payment_method ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[140px] truncate">{item.company ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">{item.notes ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingItem(item)}
                        title="Edit expense"
                        className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteLedgerItem(item.id)}
                        title="Delete expense"
                        className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
          <span>
            Showing {(validPage - 1) * pageSize + 1}–{Math.min(validPage * pageSize, paidItems.length)} of {paidItems.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={validPage === 1}
              className="rounded-lg border border-border/70 px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="font-medium text-foreground">
              Page {validPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={validPage === totalPages}
              className="rounded-lg border border-border/70 px-2.5 py-1 text-xs hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <EditExpenseModal
        open={!!editingItem}
        tripId={tripId}
        item={editingItem}
        categories={categories}
        onClose={() => setEditingItem(null)}
        onUpdated={onItemUpdated}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Trip Modal
// ---------------------------------------------------------------------------
function DeleteTripModal({
  open,
  tripTitle,
  onClose,
  onConfirm,
  loading,
  error,
}: {
  open: boolean;
  tripTitle: string;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [typed, setTyped] = useState("");

  const normalize = (s: string) =>
    s
      .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const required = `delete trip/${tripTitle}`;
  const matches = normalize(typed) === normalize(required);

  if (!open) {
    if (typed !== "") setTyped("");
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card shadow-2xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-destructive/10 grid place-items-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Delete Trip</h2>
            <p className="text-xs text-muted-foreground">This action is permanent and cannot be undone.</p>
          </div>
        </div>

        <div className="rounded-xl bg-destructive/5 border border-destructive/20 px-4 py-3">
          <p className="text-xs text-muted-foreground">All index cards and expenses for this trip will be permanently deleted.</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">To confirm, type exactly:</p>
          <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 font-mono text-sm text-foreground select-all break-all cursor-text">
            {required}
          </div>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type the confirmation text above…"
            className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/40 font-mono"
          />
          {typed.length > 0 && (
            <p className={`text-[11px] mt-1 ${matches ? "text-emerald-500" : "text-muted-foreground"}`}>
              {matches ? "✓ Confirmation matches — you can now delete" : "Text does not match yet…"}
            </p>
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 break-words">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { onClose(); setTyped(""); }}
            className="flex-1 rounded-lg border border-border/70 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!matches || loading}
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-destructive text-destructive-foreground py-2 text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? "Deleting…" : "Delete Trip"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visualization Subpage Component
// ---------------------------------------------------------------------------
const CATEGORY_COLORS: Record<string, string> = {
  flight: "#2563EB",       // Electric Indigo / Royal Blue
  hotel: "#7C3AED",        // Deep Bright Violet
  transport: "#059669",    // Vibrant Emerald Green
  activity: "#D97706",     // Deep Warm Amber
  food: "#E11D48",         // Vibrant Rose Red
  place: "#06B6D4",        // Bright Cyan
  miscellaneous: "#F97316", // Vivid Orange
  cab: "#14B8A6",          // Bright Teal
  train: "#84CC16",        // Lime Green
};

const PALETTE_FALLBACKS = [
  "#2563EB", "#7C3AED", "#059669", "#D97706",
  "#E11D48", "#06B6D4", "#F97316", "#14B8A6",
  "#84CC16", "#EC4899", "#6366F1", "#10B981"
];

const DEFAULT_COLOR = "#94A3B8";

function TripVisualizationTab({
  trip,
  categories,
}: {
  trip: TripDetail;
  categories: TripCategory[];
}) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    async function loadAnalytics() {
      try {
        setLoading(true);
        const res = await apiFetch(`/trips/${trip.id}/analytics`);
        if (mounted && res) {
          setAnalytics(res);
        }
      } catch (err) {
        console.error("Failed to load backend analytics, fallback to client math", err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAnalytics();
    return () => {
      mounted = false;
    };
  }, [trip.id, trip.items]);

  // Client-side fallback computations for instant rendering & offline resiliency
  const items = trip.items || [];
  const totalBudget = Number(trip.total_budget || 0);
  const totalSpent = items.reduce(
    (acc, i) => acc + (i.actual_cost != null ? Number(i.actual_cost) : Number(i.estimated_cost || 0)),
    0
  );
  const totalEstimated = items.reduce(
    (acc, i) => acc + Number(i.estimated_cost || 0),
    0
  );
  const remainingBudget = totalBudget - totalSpent;
  const percentSpent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;

  // Helper category display map
  const catNameMap: Record<string, string> = {};
  categories.forEach((c) => {
    catNameMap[c.slug] = c.name;
  });

  // 1. Category Breakdown with Sanitization & Zero Filter
  const catTotalsMap: Record<string, number> = {};
  items.forEach((item) => {
    const cat = item.category_type || "miscellaneous";
    const amt = item.actual_cost != null ? Number(item.actual_cost) : Number(item.estimated_cost || 0);
    const validAmt = isNaN(amt) ? 0 : amt;
    catTotalsMap[cat] = (catTotalsMap[cat] || 0) + validAmt;
  });

  const catTotalSum = Object.values(catTotalsMap).reduce((a, b) => a + b, 0);
  const rawBreakdownData = analytics?.category_breakdown || Object.entries(catTotalsMap)
    .map(([cat, amt]) => ({
      category_type: cat,
      amount: amt,
      percentage: catTotalSum > 0 ? Number(((amt / catTotalSum) * 100).toFixed(1)) : 0,
    }));

  const categoryBreakdownData = rawBreakdownData
    .map((item: any) => ({
      category_type: item.category_type || "miscellaneous",
      amount: Number(item.amount || 0),
      percentage: Number(item.percentage || 0),
    }))
    .filter((item: any) => item.amount > 0)
    .sort((a: any, b: any) => b.amount - a.amount);

  // Top Cost Drivers by Category (Top 5 categories by total spend)
  const topCategoriesData = categoryBreakdownData.slice(0, 5).map((item: any) => {
    const rawCat = item.category_type || "miscellaneous";
    const displayName = catNameMap[rawCat] || rawCat.charAt(0).toUpperCase() + rawCat.slice(1);
    return {
      category_type: rawCat,
      category_name: displayName,
      amount: Number(item.amount || 0),
      percentage: Number(item.percentage || 0),
    };
  });



  // 4. Daily Timeline
  const dailyTimelineData = analytics?.daily_timeline || [];

  const budgetStatus = analytics?.budget_status || (totalSpent > totalBudget ? "over_budget" : totalSpent >= 0.85 * totalBudget ? "near_limit" : "under_budget");


  const statusBadgeCfg = {
    under_budget: { label: "Under Budget", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
    near_limit: { label: "Near Budget Limit", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    over_budget: { label: "Over Budget", className: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
  }[budgetStatus as "under_budget" | "near_limit" | "over_budget"] || { label: "Under Budget", className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };

  return (
    <div className="space-y-6">
      {/* 📊 Section 1: Budget Health & Status Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border/50 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Trip Financial Overview</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusBadgeCfg.className}`}>
                {statusBadgeCfg.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live budget variance and spend distribution for {trip.title}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-xs text-muted-foreground block">Remaining Balance</span>
              <span className={`text-xl font-extrabold ${remainingBudget < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {fmt(remainingBudget)}
              </span>
            </div>
          </div>
        </div>

        {/* 3 Metric Comparison Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-accent/40 border border-border/40 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5 text-foreground" /> Total Budget
            </span>
            <div className="text-lg font-bold">{fmt(totalBudget)}</div>
            <div className="text-[11px] text-muted-foreground">Target budget cap</div>
          </div>

          <div className="p-4 rounded-xl bg-accent/40 border border-border/40 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-amber-500" /> Total Estimated
            </span>
            <div className="text-lg font-bold text-amber-500">{fmt(totalEstimated)}</div>
            <div className="text-[11px] text-muted-foreground">Sum of planned items</div>
          </div>

          <div className="p-4 rounded-xl bg-accent/40 border border-border/40 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5 text-primary" /> Actual Spent
            </span>
            <div className="text-lg font-bold text-primary">{fmt(totalSpent)}</div>
            <div className="text-[11px] text-muted-foreground">
              {percentSpent}% of total budget consumed
            </div>
          </div>
        </div>
      </div>

      {/* 🍩📊 Merged Card: Category Breakdown (Donut) & Top Cost Drivers (Bar Plot) */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border/40 pb-4">
          <div>
            <h3 className="text-base font-bold flex items-center gap-2">
              <PieChart className="h-4.5 w-4.5 text-primary" />
              Category Expense Breakdown & Cost Drivers
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Share of expenses by category type and relative budget cost drivers
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground block">Total Category Spend</span>
            <span className="text-base font-extrabold text-foreground">{fmt(totalSpent)}</span>
          </div>
        </div>

        {categoryBreakdownData.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs">
            No expenses logged yet for this trip.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Visual Charts Row: Donut Chart (Left) + Bar Chart (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              
              {/* Donut Chart */}
              <div className="space-y-2 text-center">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block text-left">
                  Share of Expenses (Donut View)
                </span>
                <div className="h-64 relative grid place-items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                      <Pie
                        data={categoryBreakdownData}
                        dataKey="amount"
                        nameKey="category_type"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={88}
                        paddingAngle={3}
                        labelLine={false}
                        label={(props: any) => {
                          const { cx, cy, midAngle, innerRadius, outerRadius, percentage, category_type } = props;
                          const RADIAN = Math.PI / 180;

                          // 1. Percentage share INSIDE the slice section ring
                          const radiusInside = innerRadius + (outerRadius - innerRadius) * 0.5;
                          const xInside = cx + radiusInside * Math.cos(-midAngle * RADIAN);
                          const yInside = cy + radiusInside * Math.sin(-midAngle * RADIAN);

                          // 2. Category Name OUTSIDE the section ring
                          const radiusOutside = outerRadius + 22;
                          const xOutside = cx + radiusOutside * Math.cos(-midAngle * RADIAN);
                          const yOutside = cy + radiusOutside * Math.sin(-midAngle * RADIAN);

                          const displayName = catNameMap[category_type] || (category_type?.charAt(0).toUpperCase() + category_type?.slice(1));
                          const roundedPercent = Math.round(Number(percentage || 0));
                          const showPercent = roundedPercent > 0;
                          const fontSize = roundedPercent < 6 ? "9px" : "12px";

                          return (
                            <g key={`lbl-${category_type}`}>
                              {/* Category Name printed on outer section */}
                              <text
                                x={xOutside}
                                y={yOutside}
                                fill="currentColor"
                                textAnchor={xOutside > cx ? "start" : "end"}
                                dominantBaseline="central"
                                className="text-[12px] font-medium italic fill-foreground"
                              >
                                {displayName}
                              </text>

                              {/* Percentage share printed inside the slice section */}
                              {showPercent && (
                                <text
                                  x={xInside}
                                  y={yInside}
                                  fill="#ffffff"
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  style={{ fontSize, fontWeight: 900 }}
                                  className="fill-white drop-shadow-sm pointer-events-none"
                                >
                                  {`${roundedPercent}%`}
                                </text>
                              )}
                            </g>
                          );
                        }}
                      >

                        {categoryBreakdownData.map((entry: any, index: number) => {
                          const color = CATEGORY_COLORS[entry.category_type] || DEFAULT_COLOR;
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: any, name: any, item: any) => [
                          `${fmt(Number(val))} (${item.payload.percentage}%)`,
                          catNameMap[name] || name,
                        ]}
                        contentStyle={{
                          backgroundColor: "rgba(15, 23, 42, 0.9)",
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "12px",
                          fontSize: "12px",
                          color: "#fff",
                        }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>

                  {/* Center Badge */}
                  <div className="absolute inset-0 grid place-items-center pointer-events-none text-center">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                        Total Spent
                      </span>
                      <span className="text-xs font-extrabold text-foreground block">
                        {fmt(totalSpent)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>


              {/* Bar Chart */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Top Cost Drivers (Bar View)
                </span>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={topCategoriesData} margin={{ left: 5, right: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                      <YAxis type="category" dataKey="category_name" tick={{ fontSize: 11 }} width={95} />
                      <RechartsTooltip
                        formatter={(val: any) => [fmt(Number(val)), "Total Spent"]}
                        contentStyle={{
                          backgroundColor: "rgba(15, 23, 42, 0.9)",
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "12px",
                          fontSize: "12px",
                          color: "#fff",
                        }}
                      />
                      <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                        {topCategoriesData.map((entry: any, index: number) => {
                          const catSlug = entry.category_type;
                          const color = CATEGORY_COLORS[catSlug] || PALETTE_FALLBACKS[index % PALETTE_FALLBACKS.length];
                          return <Cell key={`bar-${index}`} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Single Shared Category Index Section */}
            <div className="pt-4 border-t border-border/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Category Expense Index ({topCategoriesData.length})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {topCategoriesData.map((v: any, idx: number) => {
                  const catSlug = v.category_type;
                  const color = CATEGORY_COLORS[catSlug] || PALETTE_FALLBACKS[idx % PALETTE_FALLBACKS.length];
                  const displayName = v.category_name;

                  return (
                    <div key={v.category_type} className="flex items-center justify-between p-3 rounded-xl bg-accent/30 border border-border/30 text-xs hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-6 w-6 rounded-md font-bold grid place-items-center text-[10px] text-white shrink-0 shadow-xs" style={{ backgroundColor: color }}>
                          #{idx + 1}
                        </span>
                        <span className="font-semibold text-foreground capitalize truncate">{displayName}</span>
                      </div>
                      <div className="text-right shrink-0 pl-2">
                        <span className="font-bold block text-foreground">{fmt(v.amount)}</span>
                        <span className="text-[10px] text-muted-foreground font-medium">{v.percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}


// ---------------------------------------------------------------------------
// Main Detail Page Component
// ---------------------------------------------------------------------------
function TripDetailPage() {
  const { trip: initial } = Route.useLoaderData();
  const [trip, setTrip] = useState<TripDetail>(initial);
  const [categories, setCategories] = useState<TripCategory[]>([]);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Load Categories on Mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const cats: TripCategory[] = await apiFetch("/trip-categories");
        setCategories(cats);
      } catch (err) {
        console.error("Failed to load trip categories", err);
      }
    }
    loadCategories();
  }, []);

  // Cycle trip status
  const cycleStatus = async () => {
    const idx = TRIP_STATUS_CYCLE.indexOf(trip.status);
    const next = TRIP_STATUS_CYCLE[(idx + 1) % TRIP_STATUS_CYCLE.length];
    try {
      const updated = await apiFetch<TripDetail>(`/trips/${trip.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      setTrip((t) => ({ ...t, status: updated.status as TripStatus }));
    } catch {}
  };

  // Item Handlers & Financial Recalculation
  const handleItemAdded = (item: TripItem) => {
    setTrip((t) => {
      const newItems = [...t.items, item];
      const totalEstimated = newItems.reduce((s, i) => s + Number(i.estimated_cost || 0), 0);
      const totalSpent = newItems.reduce(
        (s, i) => s + (i.actual_cost != null || i.booking_status === "paid" ? Number(i.actual_cost ?? i.estimated_cost) : 0),
        0,
      );
      return {
        ...t,
        items: newItems,
        summary: {
          trip_id: t.id,
          total_budget: t.total_budget,
          total_estimated_cost: totalEstimated,
          total_actual_spent: totalSpent,
          remaining_budget: t.total_budget - totalSpent,
          forecast_variance: totalEstimated - totalSpent,
        },
      };
    });
  };

  const handleItemDeleted = (id: string) => {
    setTrip((t) => {
      const newItems = t.items.filter((i) => i.id !== id);
      const totalEstimated = newItems.reduce((s, i) => s + Number(i.estimated_cost || 0), 0);
      const totalSpent = newItems.reduce(
        (s, i) => s + (i.actual_cost != null || i.booking_status === "paid" ? Number(i.actual_cost ?? i.estimated_cost) : 0),
        0,
      );
      return {
        ...t,
        items: newItems,
        summary: {
          trip_id: t.id,
          total_budget: t.total_budget,
          total_estimated_cost: totalEstimated,
          total_actual_spent: totalSpent,
          remaining_budget: t.total_budget - totalSpent,
          forecast_variance: totalEstimated - totalSpent,
        },
      };
    });
  };

  const handleItemUpdated = (item: TripItem) => {
    setTrip((t) => {
      const newItems = t.items.map((i) => (i.id === item.id ? item : i));
      const totalEstimated = newItems.reduce((s, i) => s + Number(i.estimated_cost || 0), 0);
      const totalSpent = newItems.reduce(
        (s, i) => s + (i.actual_cost != null || i.booking_status === "paid" ? Number(i.actual_cost ?? i.estimated_cost) : 0),
        0,
      );
      return {
        ...t,
        items: newItems,
        summary: {
          trip_id: t.id,
          total_budget: t.total_budget,
          total_estimated_cost: totalEstimated,
          total_actual_spent: totalSpent,
          remaining_budget: t.total_budget - totalSpent,
          forecast_variance: totalEstimated - totalSpent,
        },
      };
    });
  };

  const handleDeleteTrip = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await apiFetch(`/trips/${trip.id}`, { method: "DELETE" });
      navigate({ to: "/trips/" });
    } catch (err: any) {
      setDeleteLoading(false);
      setDeleteError(err?.message || "Failed to delete trip. Please try again.");
    }
  };

  const statusCfg = {
    planning: { label: "Planning", icon: Clock3, className: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    active: { label: "Active", icon: Navigation, className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    completed: { label: "Completed", icon: CheckCircle2, className: "text-sky-500 bg-sky-500/10 border-sky-500/20" },
  }[trip.status];
  const StatusIcon = statusCfg.icon;

  const [activeTab, setActiveTab] = useState<"home" | "scan" | "visualize">("home");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/trips" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{trip.title}</h1>
          {trip.destination && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> {trip.destination} · {fmtDate(trip.start_date)} → {fmtDate(trip.end_date)}
            </p>
          )}
        </div>
        <button
          onClick={cycleStatus}
          title="Click to change status"
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${statusCfg.className}`}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {statusCfg.label}
        </button>
        <button
          onClick={() => setDeleteOpen(true)}
          title="Delete this trip"
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/15 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      {/* KPI Bar */}
      <KpiBar summary={trip.summary} totalBudget={trip.total_budget} />

      {/* Subpage Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-2 flex-wrap">
        {[
          { id: "home", label: "Trip Home", icon: Home },
          { id: "scan", label: "Scan Receipt with AI", icon: Sparkles },
          { id: "visualize", label: "Visualize Trip Expenses", icon: PieChart },
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Subpage 1: Trip Home */}
      {activeTab === "home" && (
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Index Cards</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {categories.map((cat) => (
                <IndexCard
                  key={cat.id}
                  category={cat}
                  tripId={trip.id}
                  items={trip.items.filter((i) => i.category_type === cat.slug)}
                  onItemAdded={handleItemAdded}
                  onItemDeleted={handleItemDeleted}
                />
              ))}

              {/* Empty + Add Category Card */}
              <div
                onClick={() => setAddCatOpen(true)}
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/70 bg-card/50 p-6 min-h-[160px] cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 grid place-items-center group-hover:scale-110 transition-transform">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  Add an Expense Category
                </p>
              </div>
            </div>
          </div>

          {/* Expense Ledger */}
          <ExpenseLedger
            tripId={trip.id}
            items={trip.items}
            categories={categories}
            onItemUpdated={handleItemUpdated}
            onItemDeleted={handleItemDeleted}
          />
        </div>
      )}

      {/* Subpage 2: Scan Receipt with AI */}
      {activeTab === "scan" && (
        <div className="max-w-xl mx-auto py-4">
          <AIScannerPanel
            tripId={trip.id}
            categories={categories}
            onItemLogged={(item) => {
              handleItemAdded(item);
              setActiveTab("home");
            }}
          />
        </div>
      )}

      {/* Subpage 3: Visualize Trip Expenses */}
      {activeTab === "visualize" && (
        <TripVisualizationTab trip={trip} categories={categories} />
      )}


      {/* Modals */}
      <AddCategoryModal
        open={addCatOpen}
        existingCategories={categories}
        onClose={() => setAddCatOpen(false)}
        onCreated={(newCat) => setCategories((prev) => [...prev, newCat])}
      />

      <DeleteTripModal
        open={deleteOpen}
        tripTitle={trip.title}
        onClose={() => { setDeleteOpen(false); setDeleteError(null); }}
        onConfirm={handleDeleteTrip}
        loading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
