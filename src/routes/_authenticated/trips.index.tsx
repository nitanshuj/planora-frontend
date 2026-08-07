import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plane,
  Plus,
  MapPin,
  CalendarDays,
  Wallet,
  CheckCircle2,
  Clock3,
  Navigation,
  ChevronRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Trip {
  id: string;
  title: string;
  destination: string | null;
  start_date: string;
  end_date: string;
  total_budget: number;
  status: "planning" | "active" | "completed";
}

interface CreateTripPayload {
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  total_budget: number;
  status: "planning";
}

// ---------------------------------------------------------------------------
// Route — index of /trips
// ---------------------------------------------------------------------------
export const Route = createFileRoute("/_authenticated/trips/")({
  loader: async () => {
    const trips: Trip[] = await apiFetch("/trips");
    return { trips };
  },
  component: TripsPage,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const STATUS_CONFIG = {
  planning: {
    label: "Planning",
    icon: Clock3,
    className: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  },
  active: {
    label: "Active",
    icon: Navigation,
    className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "text-sky-500 bg-sky-500/10 border-sky-500/20",
  },
} as const;

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// ---------------------------------------------------------------------------
// Create Trip Modal
// ---------------------------------------------------------------------------
function CreateTripModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (t: Trip) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    destination: "",
    start_date: "",
    end_date: "",
    total_budget: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: CreateTripPayload = {
        title: form.title,
        destination: form.destination,
        start_date: form.start_date,
        end_date: form.end_date,
        total_budget: parseFloat(form.total_budget),
        status: "planning",
      };
      const created = await apiFetch<Trip>("/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      onCreated(created);
      onClose();
      setForm({ title: "", destination: "", start_date: "", end_date: "", total_budget: "" });
    } catch (err: any) {
      setError(err.message || "Failed to create trip");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
            <Plane className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Plan a New Trip</h2>
            <p className="text-xs text-muted-foreground">Set up your vacation budget</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Trip Title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Sikkim Summer Trip"
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Destination</label>
            <input
              value={form.destination}
              onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
              placeholder="e.g. Yakten Village, Sikkim"
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Start Date *</label>
              <input
                required
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">End Date *</label>
              <input
                required
                type="date"
                value={form.end_date}
                min={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Total Budget (₹) *</label>
            <input
              required
              type="number"
              min="0"
              step="100"
              value={form.total_budget}
              onChange={(e) => setForm((f) => ({ ...f, total_budget: e.target.value }))}
              placeholder="e.g. 25000"
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border/70 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trip Card
// ---------------------------------------------------------------------------
function TripCard({ trip }: { trip: Trip }) {
  const cfg = STATUS_CONFIG[trip.status];
  const StatusIcon = cfg.icon;

  const nights =
    Math.ceil(
      (new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) /
        (1000 * 60 * 60 * 24),
    ) || 1;

  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      className="group relative flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center shrink-0 group-hover:bg-primary/20 transition-colors">
            <Plane className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {trip.title}
            </h3>
            {trip.destination && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{trip.destination}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.className}`}
          >
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        <span>
          {formatDate(trip.start_date)} → {formatDate(trip.end_date)}
        </span>
        <span className="text-border">·</span>
        <span>{nights} night{nights !== 1 ? "s" : ""}</span>
      </div>

      {/* Budget */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          <span>Budget</span>
        </div>
        <span className="text-sm font-semibold text-foreground">{fmt(trip.total_budget)}</span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
function TripsPage() {
  const { trips: initialTrips } = Route.useLoaderData();
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [modalOpen, setModalOpen] = useState(false);

  const handleCreated = (t: Trip) => setTrips((prev) => [t, ...prev]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Plane className="h-6 w-6 text-primary" />
            Trip Planning
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Isolated vacation budgets — separate from your monthly expenses.
          </p>
        </div>
        <button
          id="create-trip-btn"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Plan a New Trip
        </button>
      </div>

      {/* Stats strip */}
      {trips.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Trips", value: trips.length, icon: Plane },
            { label: "Planning", value: trips.filter((t) => t.status === "planning").length, icon: Clock3 },
            { label: "Active", value: trips.filter((t) => t.status === "active").length, icon: Navigation },
            { label: "Completed", value: trips.filter((t) => t.status === "completed").length, icon: CheckCircle2 },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border/60 bg-card px-4 py-3 flex items-center gap-3"
            >
              <s.icon className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trip Grid */}
      {trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 grid place-items-center">
            <Plane className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">No trips yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Click <strong>Plan a New Trip</strong> to set up your first vacation budget.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Get Started
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {trips.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </div>
      )}

      <CreateTripModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
