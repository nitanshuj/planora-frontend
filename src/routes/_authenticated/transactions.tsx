import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
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
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { cn, formatINR, formatDateHelper } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

type Expense = {
  id: string;
  expense_date: string;
  total_paid: number;
  item_name: string;
  category: string;
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
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const { data: rows = [] } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch("http://localhost:8000/api/v1/expenses", { headers });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return (await res.json()) as Expense[];
    },
  });
  const { data: cats = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch("http://localhost:8000/api/v1/categories", { headers });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return (await res.json()) as Category[];
    },
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

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const okCat = catFilter === "all" || r.category === catFilter;
      const okQ =
        !filter ||
        r.item_name.toLowerCase().includes(filter.toLowerCase()) ||
        r.remarks?.toLowerCase().includes(filter.toLowerCase());
      return okCat && okQ;
    });
  }, [rows, filter, catFilter]);

  const total = filtered.reduce((s, r) => s + Number(r.total_paid), 0);

  const update = async (id: string, patch: Partial<Expense>) => {
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`http://localhost:8000/api/v1/expenses/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      toast.success("Updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  const remove = async (id: string) => {
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`http://localhost:8000/api/v1/expenses/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} entries · {formatINR(total)}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add transaction
            </Button>
          </DialogTrigger>
          <NewTxDialog cats={allCategories} onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="card-soft p-4 flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search item or remarks…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {allCategories.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="grid grid-cols-[110px_1fr_180px_120px_40px] gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-muted/30">
          <div>Date</div>
          <div>Item Name</div>
          <div>Category</div>
          <div className="text-right">Total Paid</div>
          <div />
        </div>
        <div className="divide-y divide-border/60">
          {filtered.map((r) => {
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
                className="grid grid-cols-[110px_1fr_180px_120px_40px] gap-3 px-5 py-2.5 items-center hover:bg-accent/40 transition-colors group"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {formatDateHelper(r.expense_date)}
                </span>
                <Input
                  defaultValue={r.item_name}
                  onBlur={(e) =>
                    e.target.value !== r.item_name && update(r.id, { item_name: e.target.value })
                  }
                  className="h-8 text-sm border-transparent hover:border-border"
                />
                <Select
                  value={r.category ?? "Other"}
                  onValueChange={(v) => update(r.id, { category: v })}
                >
                  <SelectTrigger className="h-8 text-xs border-transparent hover:border-border">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full" style={{ background: catColor }} />
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
                  type="number"
                  step="0.01"
                  defaultValue={Number(r.total_paid)}
                  onBlur={(e) =>
                    Number(e.target.value) !== Number(r.total_paid) &&
                    update(r.id, { total_paid: Number(e.target.value) })
                  }
                  className={cn(
                    "h-8 text-sm text-right num border-transparent hover:border-border",
                  )}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                  onClick={() => remove(r.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No matching transactions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewTxDialog({ cats, onClose }: { cats: Category[]; onClose: () => void }) {
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
  const [payment_method, setPaymentMethod] = useState("Unknown");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!item_name || !total_paid) {
      toast.error("Item name and amount required");
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let finalRemarks = remarks;
      if (quantity) {
        finalRemarks = remarks ? `${remarks} (Qty: ${quantity})` : `Qty: ${quantity}`;
      }

      const res = await fetch("http://localhost:8000/api/v1/expenses", {
        method: "POST",
        headers,
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
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
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
                {["Cash", "Card", "UPI", "Net Banking", "Wallet", "Unknown"].map((m) => (
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
