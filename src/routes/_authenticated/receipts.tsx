import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { extractReceipt, saveReceipt } from "@/lib/receipts.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, FileText, Check, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/receipts")({
  component: ReceiptsPage,
});

type Extracted = {
  vendor: string;
  date: string | null;
  total: number;
  category: string;
  category_id: string | null;
  items?: Array<{ description: string; amount: number }>;
};

function ReceiptsPage() {
  const qc = useQueryClient();
  const extract = useServerFn(extractReceipt);
  const save = useServerFn(saveReceipt);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "extracting" | "review">("idle");
  const [extracted, setExtracted] = useState<Extracted | null>(null);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id,name,color").order("name")).data ?? [],
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => (await supabase.from("receipts").select("*").order("created_at", { ascending: false }).limit(10)).data ?? [],
  });

  const upload = useCallback(async (file: File) => {
    setStatus("uploading");
    setPreview(URL.createObjectURL(file));
    const { data: userRes } = await supabase.auth.getUser();
    const path = `${userRes.user!.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const { error } = await supabase.storage.from("receipts").upload(path, file);
    if (error) { toast.error(error.message); setStatus("idle"); return; }
    setStoragePath(path);
    setStatus("extracting");
    try {
      const result = await extract({ data: { storagePath: path } });
      setExtracted(result as Extracted);
      setStatus("review");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Extraction failed");
      setStatus("idle");
    }
  }, [extract]);

  const confirm = async () => {
    if (!extracted || !storagePath) return;
    try {
      await save({
        data: {
          storagePath,
          vendor: extracted.vendor,
          date: extracted.date,
          total: Number(extracted.total),
          category_id: extracted.category_id,
          items: extracted.items,
        },
      });
      toast.success("Receipt saved & expense created");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const reset = () => {
    setStatus("idle");
    setPreview(null);
    setStoragePath(null);
    setExtracted(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <p className="text-sm text-muted-foreground">Drop a photo or PDF — AI extracts vendor, total, and category.</p>
      </div>

      {status === "idle" && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files[0]; if (f) upload(f);
          }}
          className={cn(
            "block card-soft p-12 border-2 border-dashed cursor-pointer transition-colors text-center",
            dragOver ? "border-primary bg-primary/5" : "border-border/70 hover:border-primary/50 hover:bg-accent/30",
          )}
        >
          <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary grid place-items-center">
            <Upload className="h-6 w-6" />
          </div>
          <div className="mt-4 font-medium">Drop a receipt or click to browse</div>
          <div className="text-sm text-muted-foreground mt-1">PNG, JPG, WEBP — up to ~5 MB</div>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      )}

      {(status === "uploading" || status === "extracting") && (
        <div className="card-soft p-6 grid md:grid-cols-2 gap-6">
          {preview && <img src={preview} alt="Receipt preview" className="rounded-xl w-full max-h-96 object-contain bg-muted" />}
          <div className="space-y-3">
            <div className="text-sm font-semibold">{status === "uploading" ? "Uploading…" : "AI is reading your receipt…"}</div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      )}

      {status === "review" && extracted && (
        <div className="card-soft p-6 grid md:grid-cols-2 gap-6">
          {preview && <img src={preview} alt="" className="rounded-xl w-full max-h-96 object-contain bg-muted" />}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-primary">Verify & save</div>
            <div className="grid gap-1.5"><Label>Vendor</Label><Input value={extracted.vendor ?? ""} onChange={(e) => setExtracted({ ...extracted, vendor: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Total</Label><Input type="number" step="0.01" value={extracted.total ?? 0} onChange={(e) => setExtracted({ ...extracted, total: Number(e.target.value) })} /></div>
              <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={extracted.date ?? ""} onChange={(e) => setExtracted({ ...extracted, date: e.target.value })} /></div>
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select value={extracted.category_id ?? "none"} onValueChange={(v) => setExtracted({ ...extracted, category_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {cats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {extracted.items && extracted.items.length > 0 && (
              <div>
                <Label className="text-xs">Line items</Label>
                <div className="mt-1 border rounded-lg divide-y max-h-40 overflow-y-auto text-sm">
                  {extracted.items.map((it, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5"><span className="truncate">{it.description}</span><span className="num tabular-nums">${Number(it.amount).toFixed(2)}</span></div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button className="flex-1 gap-2" onClick={confirm}><Check className="h-4 w-4" /> Save expense</Button>
              <Button variant="outline" onClick={reset} className="gap-2"><X className="h-4 w-4" /> Discard</Button>
            </div>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="card-soft p-5">
          <div className="text-sm font-semibold mb-3">Recent receipts</div>
          <div className="divide-y divide-border/60">
            {recent.map((r: any) => (
              <div key={r.id} className="flex items-center py-2.5 gap-3">
                <div className="h-9 w-9 rounded-lg bg-muted grid place-items-center">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.vendor ?? "Receipt"}</div>
                  <div className="text-xs text-muted-foreground">{r.receipt_date ?? new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <div className="text-sm font-semibold num">{r.total ? Number(r.total).toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recent.length === 0 && status === "idle" && (
        <div className="text-sm text-muted-foreground flex items-center gap-2 justify-center py-8">
          <ImageIcon className="h-4 w-4" /> No receipts yet.
        </div>
      )}
    </div>
  );
}
