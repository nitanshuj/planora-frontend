import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
});

type Expense = { id: string; date: string; amount: number; vendor: string; category_id: string | null; notes: string | null };
type Category = { id: string; name: string; color: string };

function TransactionsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const { data: rows = [] } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });
  const { data: cats = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,color").order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("transactions-live").on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const okCat = catFilter === "all" || r.category_id === catFilter;
      const okQ = !filter || r.vendor.toLowerCase().includes(filter.toLowerCase()) || r.notes?.toLowerCase().includes(filter.toLowerCase());
      return okCat && okQ;
    });
  }, [rows, filter, catFilter]);

  const total = filtered.reduce((s, r) => s + Number(r.amount), 0);

  const update = async (id: string, patch: Partial<Expense>) => {
    const { error } = await supabase.from("expenses").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} entries · {total.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add transaction</Button>
          </DialogTrigger>
          <NewTxDialog cats={cats} onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="card-soft p-4 flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search vendor or notes…" value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="card-soft overflow-hidden">
        <div className="grid grid-cols-[110px_1fr_180px_120px_40px] gap-3 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 bg-muted/30">
          <div>Date</div><div>Vendor</div><div>Category</div><div className="text-right">Amount</div><div />
        </div>
        <div className="divide-y divide-border/60">
          {filtered.map((r) => {
            const cat = cats.find((c) => c.id === r.category_id);
            return (
              <div key={r.id} className="grid grid-cols-[110px_1fr_180px_120px_40px] gap-3 px-5 py-2.5 items-center hover:bg-accent/40 transition-colors group">
                <Input type="date" defaultValue={r.date} onBlur={(e) => e.target.value !== r.date && update(r.id, { date: e.target.value })} className="h-8 text-xs border-transparent hover:border-border" />
                <Input defaultValue={r.vendor} onBlur={(e) => e.target.value !== r.vendor && update(r.id, { vendor: e.target.value })} className="h-8 text-sm border-transparent hover:border-border" />
                <Select value={r.category_id ?? "none"} onValueChange={(v) => update(r.id, { category_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-8 text-xs border-transparent hover:border-border">
                    <div className="flex items-center gap-2 min-w-0">
                      {cat && <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />}
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorized</SelectItem>
                    {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="number" step="0.01" defaultValue={Number(r.amount)} onBlur={(e) => Number(e.target.value) !== Number(r.amount) && update(r.id, { amount: Number(e.target.value) })} className={cn("h-8 text-sm text-right num border-transparent hover:border-border")} />
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">No matching transactions.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function NewTxDialog({ cats, onClose }: { cats: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [category_id, setCat] = useState<string>(cats[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!vendor || !amount) { toast.error("Vendor and amount required"); return; }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("expenses").insert({
      date, vendor, amount: Number(amount), category_id: category_id || null, user_id: userRes.user!.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["expenses"] });
    toast.success("Transaction added");
    onClose();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add transaction</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5"><Label>Vendor</Label><Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Whole Foods" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5"><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
          <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="grid gap-1.5">
          <Label>Category</Label>
          <Select value={category_id} onValueChange={setCat}>
            <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
