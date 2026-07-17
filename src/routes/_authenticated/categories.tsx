import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/categories")({
  component: CategoriesPage,
});

type Category = { id: string; name: string; color: string; monthly_limit: number | null };
const PALETTE = ["#3F51B5","#2E7D32","#E65100","#455A64","#6A1B9A","#1565C0","#C2185B","#00838F","#546E7A","#EF6C00","#4527A0","#00695C"];

function CategoriesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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

  const update = async (id: string, patch: Partial<Category>) => {
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`http://localhost:8000/api/v1/categories/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update category");
    }
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this category? Transactions will be uncategorized.")) return;
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`http://localhost:8000/api/v1/categories/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete category");
    }
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">{cats.length} tags · adjust monthly limits below</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New category</Button></DialogTrigger>
          <NewCategoryDialog onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <div key={c.id} className="card-soft p-5 group">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl grid place-items-center text-sm font-bold shrink-0" style={{ backgroundColor: (c.color || PALETTE[0]) + "22", color: c.color || PALETTE[0] }}>
                {(c.name || "C")[0]}
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <Input defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && update(c.id, { name: e.target.value })} className="font-medium border-transparent hover:border-border p-0 focus:p-2 focus:border-input transition-all h-auto" />
                <div>
                  <Label className="text-xs text-muted-foreground">Monthly limit</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-muted-foreground text-sm">$</span>
                    <Input type="number" step="0.01" defaultValue={c.monthly_limit ?? ""} onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (v !== c.monthly_limit) update(c.id, { monthly_limit: v });
                    }} className="h-8 num" placeholder="No limit" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PALETTE.map((p) => (
                    <button key={p} onClick={() => update(c.id, { color: p })} className={`h-5 w-5 rounded-full transition-transform ${(c.color || PALETTE[0]).toLowerCase() === p.toLowerCase() ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-110"}`} style={{ backgroundColor: p }} />
                  ))}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => remove(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewCategoryDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [limit, setLimit] = useState("");
  const save = async () => {
    if (!name) return;
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("http://localhost:8000/api/v1/categories", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          color,
          monthly_limit: limit ? Number(limit) : null,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }
      toast.success("Category created");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create category");
    }
    qc.invalidateQueries({ queryKey: ["categories"] });
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New category</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="grid gap-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coffee" /></div>
        <div className="grid gap-1.5"><Label>Monthly limit (optional)</Label><Input type="number" step="0.01" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0.00" /></div>
        <div className="grid gap-1.5">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((p) => (
              <button key={p} type="button" onClick={() => setColor(p)} className={`h-7 w-7 rounded-full transition-transform ${color === p ? "ring-2 ring-offset-2 ring-primary" : "hover:scale-110"}`} style={{ backgroundColor: p }} />
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Create</Button>
      </DialogFooter>
    </DialogContent>
  );
}
