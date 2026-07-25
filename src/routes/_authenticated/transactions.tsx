import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Search,
  RotateCcw,
  Wallet,
  Receipt,
  CreditCard,
  Sparkles,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatINR, formatDateHelper } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

type Expense = {
  id: string;
  expense_date: string;
  total_paid: number;
  item_name: string;
  category: string;
  sub_category?: string | null;
  remarks: string | null;
  service: string | null;
  brand: string | null;
  payment_method: string | null;
};
type Category = { id: string; name: string };

const DEFAULT_CATEGORIES = [
  "Groceries",
  "Leisure",
  "Extra Charge",
  "Home Items",
  "Home-Mandatory",
  "Food_Office",
  "Cosmetics",
  "Medical Health",
  "Home",
  "Puja",
  "Travel",
  "PC Rig",
  "Clothes",
  "Mandir",
  "Electronics",
  "Phone Recharge",
  "Activa",
];

function TransactionsPage() {
  const qc = useQueryClient();

  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [subCatFilter, setSubCatFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>(currentMonthKey);
  const [open, setOpen] = useState(false);

  const { data: rows = [] } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: () => apiFetch("/expenses"),
  });

  const { data: cats = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => apiFetch("/categories"),
  });

  const allCategories = useMemo(() => {
    const list = [...cats];
    const existingNames = new Set(cats.map((c) => c.name.toLowerCase()));
    DEFAULT_CATEGORIES.forEach((name) => {
      if (!existingNames.has(name.toLowerCase())) {
        list.push({ id: name, name });
      }
    });
    return list;
  }, [cats]);

  // Derived unique sub-categories, services, and period options from expenses dataset
  const { uniqueSubCats, uniqueServices, monthOptions, yearOptions } = useMemo(() => {
    const subSet = new Set<string>();
    const servSet = new Set<string>();
    const monthsSet = new Set<string>();
    const yearsSet = new Set<string>();

    for (const r of rows) {
      if (r.sub_category && r.sub_category.trim()) {
        subSet.add(r.sub_category.trim());
      }
      if (r.service && r.service.trim()) {
        servSet.add(r.service.trim());
      }
      if (r.expense_date) {
        const mKey = r.expense_date.slice(0, 7); // YYYY-MM
        const yKey = r.expense_date.slice(0, 4); // YYYY
        if (/^\d{4}-\d{2}$/.test(mKey)) monthsSet.add(mKey);
        if (/^\d{4}$/.test(yKey)) yearsSet.add(yKey);
      }
    }

    const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
    const sortedYears = Array.from(yearsSet)
      .sort((a, b) => b.localeCompare(a))
      .map((y) => `${y}-YEAR`);

    return {
      uniqueSubCats: Array.from(subSet).sort((a, b) => a.localeCompare(b)),
      uniqueServices: Array.from(servSet).sort((a, b) => a.localeCompare(b)),
      monthOptions: sortedMonths,
      yearOptions: sortedYears,
    };
  }, [rows]);

  const formatPeriodLabel = (pKey: string) => {
    if (pKey === "all") return "Period: All";
    if (pKey.endsWith("-YEAR")) {
      const y = pKey.split("-")[0];
      return `Total (${y})`;
    }
    const [y, m] = pKey.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      const okCat = catFilter === "all" || r.category === catFilter;
      const okSubCat =
        subCatFilter === "all" ||
        (r.sub_category || "").trim().toLowerCase() === subCatFilter.trim().toLowerCase();
      const okService =
        serviceFilter === "all" ||
        (r.service || "").trim().toLowerCase() === serviceFilter.trim().toLowerCase();

      let okPeriod = true;
      if (periodFilter !== "all") {
        if (periodFilter.endsWith("-YEAR")) {
          const yearStr = periodFilter.split("-")[0];
          okPeriod = Boolean(r.expense_date && r.expense_date.startsWith(yearStr));
        } else {
          okPeriod = Boolean(r.expense_date && r.expense_date.startsWith(periodFilter));
        }
      }

      const okQ =
        !filter ||
        r.item_name.toLowerCase().includes(filter.toLowerCase()) ||
        r.service?.toLowerCase().includes(filter.toLowerCase()) ||
        r.brand?.toLowerCase().includes(filter.toLowerCase()) ||
        r.sub_category?.toLowerCase().includes(filter.toLowerCase()) ||
        r.remarks?.toLowerCase().includes(filter.toLowerCase());

      return okCat && okSubCat && okService && okPeriod && okQ;
    });

    // Sort descending by date (latest first)
    return list.sort(
      (a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime(),
    );
  }, [rows, filter, catFilter, subCatFilter, serviceFilter, periodFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const total = filtered.reduce((s, r) => s + Number(r.total_paid), 0);
  const avgSpent = filtered.length > 0 ? total / filtered.length : 0;

  const resetFilters = () => {
    setFilter("");
    setCatFilter("all");
    setSubCatFilter("all");
    setServiceFilter("all");
    setPeriodFilter(currentMonthKey);
    setPage(1);
  };

  const isFiltered =
    filter !== "" ||
    catFilter !== "all" ||
    subCatFilter !== "all" ||
    serviceFilter !== "all" ||
    periodFilter !== currentMonthKey;

  const update = async (id: string, patch: Partial<Expense>) => {
    try {
      await apiFetch(`/expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      toast.success("Updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  const remove = async (id: string) => {
    try {
      await apiFetch(`/expenses/${id}`, {
        method: "DELETE",
      });
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  const { data: paymentMethods = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      try {
        return await apiFetch("/payment-methods");
      } catch {
        return [];
      }
    },
  });

  const allPaymentMethods = useMemo(() => {
    const defaults = ["Cash", "Card", "UPI", "Net Banking", "Wallet", "Unknown"];
    const list = paymentMethods.map((pm) => pm.name);
    defaults.forEach((d) => {
      if (!list.some((m) => m.toLowerCase() === d.toLowerCase())) {
        list.push(d);
      }
    });
    return list;
  }, [paymentMethods]);

  return (
    <div className="space-y-6">
      {/* Header with Title & Add Transaction Action */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Manage, filter, and track all your logged expenses.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" /> Add transaction
            </Button>
          </DialogTrigger>
          <NewTxDialog
            cats={allCategories}
            paymentMethods={allPaymentMethods}
            onClose={() => setOpen(false)}
          />
        </Dialog>
      </div>

      {/* Aesthetic Summary Stat Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-soft p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Filtered Spend
            </span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold num">{formatINR(total)}</div>
          <div className="text-xs text-muted-foreground mt-1 font-medium">
            {filtered.length} transaction{filtered.length === 1 ? "" : "s"} shown (
            {formatPeriodLabel(periodFilter)})
          </div>
        </div>

        <div className="card-soft p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Entries
            </span>
            <div className="h-8 w-8 rounded-lg bg-accent/80 text-foreground grid place-items-center">
              <Receipt className="h-4 w-4 text-primary" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold num">{filtered.length}</div>
          <div className="text-xs text-muted-foreground mt-1 font-medium">
            Out of {rows.length} total logged
          </div>
        </div>

        <div className="card-soft p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Avg Spent / Tx
            </span>
            <div className="h-8 w-8 rounded-lg bg-[color:var(--color-success)]/10 text-[color:var(--color-success)] grid place-items-center">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold num">{formatINR(avgSpent)}</div>
          <div className="text-xs text-muted-foreground mt-1 font-medium">
            Average transaction size
          </div>
        </div>
      </div>

      {/* Multi-Field Filter Bar */}
      <div className="card-soft p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Filter Transactions
          </div>
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
            >
              <RotateCcw className="h-3 w-3" /> Reset Filters
            </Button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-center">
          {/* Search Input */}
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search item, brand, remarks…"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Period Filter (Month-wise & Annual Totals) */}
          <div className="w-full">
            <Select
              value={periodFilter}
              onValueChange={(v) => {
                setPeriodFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue placeholder="Period: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Period: All</SelectItem>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground font-semibold px-2 py-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-primary" /> Monthly Views
                  </SelectLabel>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatPeriodLabel(m)}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
                    Annual Totals
                  </SelectLabel>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>
                      {formatPeriodLabel(y)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Category Filter */}
          <div className="w-full">
            <Select
              value={catFilter}
              onValueChange={(v) => {
                setCatFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue placeholder="Category: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Category: All</SelectItem>
                {allCategories.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub-Category Filter */}
          <div className="w-full">
            <Select
              value={subCatFilter}
              onValueChange={(v) => {
                setSubCatFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue placeholder="Sub-Category: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sub-Category: All</SelectItem>
                {uniqueSubCats.map((sc) => (
                  <SelectItem key={sc} value={sc}>
                    {sc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service Filter */}
          <div className="w-full">
            <Select
              value={serviceFilter}
              onValueChange={(v) => {
                setServiceFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs w-full">
                <SelectValue placeholder="Service: All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Service: All</SelectItem>
                {uniqueServices.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Styled Transactions Table */}
      <div className="card-soft overflow-hidden">
        <div className="grid grid-cols-[95px_1fr_120px_130px_110px_110px_90px_35px] gap-2.5 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-muted/30">
          <div>Date</div>
          <div>Item Name</div>
          <div>Service</div>
          <div>Category</div>
          <div>Sub-Category</div>
          <div>Brand</div>
          <div className="text-right">Total Paid</div>
          <div />
        </div>

        <div className="divide-y divide-border/60">
          {paginatedRows.map((r) => {
            const colors: Record<string, string> = {
              Groceries: "#2E7D32",
              Dining: "#E65100",
              Transport: "#455A64",
              Shopping: "#6A1B9A",
              Utilities: "#1565C0",
              Entertainment: "#C2185B",
              Health: "#00838F",
              Other: "#546E7A",
            };
            const catColor = colors[r.category] || "#64748b";
            return (
              <div
                key={r.id}
                className="grid grid-cols-[95px_1fr_120px_130px_110px_110px_90px_35px] gap-2.5 px-4 py-2.5 items-center hover:bg-accent/40 transition-colors group text-xs"
              >
                <span className="font-medium text-muted-foreground truncate">
                  {formatDateHelper(r.expense_date)}
                </span>
                <Input
                  defaultValue={r.item_name}
                  onBlur={(e) =>
                    e.target.value !== r.item_name && update(r.id, { item_name: e.target.value })
                  }
                  className="h-8 text-xs border-transparent hover:border-border"
                />
                <Input
                  defaultValue={r.service ?? ""}
                  placeholder="—"
                  onBlur={(e) =>
                    e.target.value !== (r.service ?? "") &&
                    update(r.id, { service: e.target.value || null })
                  }
                  className="h-8 text-xs border-transparent hover:border-border text-muted-foreground focus:text-foreground font-medium"
                />
                <Select
                  value={r.category ?? "Other"}
                  onValueChange={(v) => update(r.id, { category: v })}
                >
                  <SelectTrigger className="h-8 text-xs border-transparent hover:border-border">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: catColor }}
                      />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  defaultValue={r.sub_category ?? ""}
                  placeholder="—"
                  onBlur={(e) =>
                    e.target.value !== (r.sub_category ?? "") &&
                    update(r.id, { sub_category: e.target.value || null })
                  }
                  className="h-8 text-xs border-transparent hover:border-border text-muted-foreground focus:text-foreground"
                />
                <Input
                  defaultValue={r.brand ?? ""}
                  placeholder="—"
                  onBlur={(e) =>
                    e.target.value !== (r.brand ?? "") &&
                    update(r.id, { brand: e.target.value || null })
                  }
                  className="h-8 text-xs border-transparent hover:border-border text-muted-foreground focus:text-foreground"
                />
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={Number(r.total_paid)}
                  onBlur={(e) =>
                    Number(e.target.value) !== Number(r.total_paid) &&
                    update(r.id, { total_paid: Number(e.target.value) })
                  }
                  className={cn(
                    "h-8 text-xs text-right num border-transparent hover:border-border font-medium",
                  )}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={() => remove(r.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="py-14 text-center space-y-2">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-muted/60 text-muted-foreground grid place-items-center">
                <Search className="h-5 w-5 opacity-60" />
              </div>
              <div className="text-sm font-semibold text-foreground">No matching transactions</div>
              <div className="text-xs text-muted-foreground max-w-sm mx-auto">
                No entries match your selected search or filters. Try adjusting your Category,
                Sub-Category, or Service filter.
              </div>
              {isFiltered && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="mt-2 h-8 text-xs gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Clear active filters
                </Button>
              )}
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 text-xs text-muted-foreground bg-muted/10 flex-wrap gap-2">
            <div>
              Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)} to{" "}
              {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} entries
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NewTxDialog({
  cats,
  paymentMethods,
  onClose,
}: {
  cats: Category[];
  paymentMethods: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [expense_date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [item_name, setItemName] = useState("");
  const [total_paid, setTotalPaid] = useState("");
  const [category, setCat] = useState<string>(cats[0]?.name ?? "Other");
  const [service, setService] = useState("");
  const [sub_category, setSubCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [payment_method, setPaymentMethod] = useState<string>(paymentMethods[0] ?? "Cash");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!item_name || !total_paid) {
      toast.error("Item name and amount required");
      return;
    }
    setSaving(true);
    try {
      let finalRemarks = remarks;
      if (quantity) {
        finalRemarks = remarks ? `${remarks} (Qty: ${quantity})` : `Qty: ${quantity}`;
      }

      await apiFetch("/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expense_date,
          item_name,
          total_paid: Number(total_paid),
          category,
          service: service || null,
          sub_category: sub_category || null,
          brand: brand || null,
          location: location || null,
          payment_method: payment_method || null,
          remarks: finalRemarks || null,
        }),
      });

      toast.success("Transaction added");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add transaction");
    } finally {
      setSaving(false);
      qc.invalidateQueries({ queryKey: ["expenses"] });
    }
  };

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add transaction</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3 py-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Item Name</Label>
            <Input
              value={item_name}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Whole Foods Milk"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Service / Merchant</Label>
            <Input
              value={service}
              onChange={(e) => setService(e.target.value)}
              placeholder="e.g. Amazon, Blinkit"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Amount (Total Paid)</Label>
            <Input
              type="number"
              step="0.01"
              value={total_paid}
              onChange={(e) => setTotalPaid(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Date</Label>
            <Input type="date" value={expense_date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCat}>
              <SelectTrigger>
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Sub Category</Label>
            <Input
              value={sub_category}
              onChange={(e) => setSubCategory(e.target.value)}
              placeholder="e.g. Snacks, Dairy"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Brand</Label>
            <Input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Organic India"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. New York, Online"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Payment Method</Label>
            <Select value={payment_method} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>Remarks</Label>
          <Input
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Any extra notes..."
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
