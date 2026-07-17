import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, FileText, Check, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { cn, formatINR, formatDateHelper } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/receipts")({
  component: ReceiptsPage,
});

type ExtractedItem = {
  item_name: string;
  service: string | null;
  category: string;
  sub_category: string | null;
  total_paid: number;
  brand: string | null;
  remarks: string | null;
};

type Extracted = {
  receipt_id: string;
  expense_date: string | null;
  payment_method: string | null;
  items: ExtractedItem[];
};

let cachedPreview: string | null = null;
let cachedStoragePath: string | null = null;
let cachedStatus: "idle" | "uploading" | "extracting" | "review" = "idle";
let cachedExtracted: Extracted | null = null;

const DEFAULT_CATEGORIES = [
  "Groceries", "Leisure", "Extra Charge", "Home Items", "Home-Mandatory",
  "Food_Office", "Cosmetics", "Medical Health", "Home", "Puja",
  "Travel", "PC Rig", "Clothes", "Mandir", "Electronics", "Phone Recharge", "Activa"
];

function ReceiptsPage() {
  const qc = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreviewState] = useState<string | null>(cachedPreview);
  const [storagePath, setStoragePathState] = useState<string | null>(cachedStoragePath);
  const [status, setStatusState] = useState<"idle" | "uploading" | "extracting" | "review">(cachedStatus);
  const [extracted, setExtractedState] = useState<Extracted | null>(cachedExtracted);

  const setPreview = (val: string | null) => {
    cachedPreview = val;
    setPreviewState(val);
  };
  const setStoragePath = (val: string | null) => {
    cachedStoragePath = val;
    setStoragePathState(val);
  };
  const setStatus = (val: "idle" | "uploading" | "extracting" | "review") => {
    cachedStatus = val;
    setStatusState(val);
  };
  const setExtracted = (val: Extracted | null | ((prev: Extracted | null) => Extracted | null)) => {
    if (typeof val === "function") {
      const next = val(cachedExtracted);
      cachedExtracted = next;
      setExtractedState(next);
    } else {
      cachedExtracted = val;
      setExtractedState(val);
    }
  };

  const { data: cats = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch("http://localhost:8000/api/v1/categories", { headers });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return await res.json();
    },
  });

  const allCategories = useMemo(() => {
    const list = [...cats];
    const existingNames = new Set(cats.map((c: any) => c.name.toLowerCase()));
    DEFAULT_CATEGORIES.forEach(name => {
      if (!existingNames.has(name.toLowerCase())) {
        list.push({ id: name, name });
      }
    });
    return list;
  }, [cats]);

  const { data: recent = [] } = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch("http://localhost:8000/api/v1/receipts", { headers });
      if (!res.ok) throw new Error("Failed to fetch receipts");
      return await res.json();
    },
  });

  const upload = useCallback(async (file: File) => {
    setStatus("uploading");
    setPreview(URL.createObjectURL(file));
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/api/v1/receipts/upload", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Extraction failed");
      }

      const result = await res.json();
      
      let expense_date = result.expense_date;
      // Format date in DD-MMM-YYYY format if present
      if (expense_date && !/^\d{2}-[A-Za-z]{3}-\d{4}$/.test(expense_date)) {
        const parsedDate = new Date(expense_date);
        if (!isNaN(parsedDate.getTime())) {
          const day = String(parsedDate.getDate()).padStart(2, "0");
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const month = months[parsedDate.getMonth()];
          const year = parsedDate.getFullYear();
          expense_date = `${day}-${month}-${year}`;
        }
      }

      setExtracted({
        receipt_id: result.receipt_id,
        expense_date: expense_date ?? new Date().toISOString().slice(0, 10),
        payment_method: result.payment_method ?? "Unknown",
        items: Array.isArray(result.draft_rows) ? result.draft_rows : [],
      });
      setStoragePath(file.name);
      setStatus("review");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Extraction failed");
      setStatus("idle");
    }
  }, []);

  const confirm = async () => {
    if (!extracted) return;
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Convert DD-MMM-YYYY back to YYYY-MM-DD for backend
      let formattedDate = extracted.expense_date ?? new Date().toISOString().slice(0, 10);
      if (formattedDate) {
        const match = formattedDate.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
        if (match) {
          const day = match[1];
          const monthStr = match[2];
          const year = match[3];
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const monthIdx = months.indexOf(monthStr);
          if (monthIdx !== -1) {
            const month = String(monthIdx + 1).padStart(2, "0");
            formattedDate = `${year}-${month}-${day}`;
          }
        }
      }

      const payload = extracted.items.map((item) => ({
        expense_date: formattedDate,
        item_name: item.item_name,
        service: item.service,
        category: item.category,
        sub_category: item.sub_category,
        brand: item.brand,
        payment_method: extracted.payment_method,
        total_paid: item.total_paid,
        remarks: item.remarks,
      }));

      const res = await fetch(`http://localhost:8000/api/v1/receipts/${extracted.receipt_id}/confirm`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Save failed");
      }

      toast.success("Receipt saved & expenses created");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const updateItem = (index: number, key: keyof ExtractedItem, val: any) => {
    if (!extracted) return;
    const newItems = [...extracted.items];
    newItems[index] = { ...newItems[index], [key]: val };
    setExtracted({ ...extracted, items: newItems });
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
        <p className="text-sm text-muted-foreground">Drop a photo or PDF — AI extracts itemized costs automatically.</p>
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
        <div className="card-soft p-6 space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {preview && <img src={preview} alt="" className="rounded-xl w-full max-h-48 object-contain bg-muted md:col-span-1" />}
            <div className="space-y-4 md:col-span-2">
              <div className="text-sm font-semibold text-primary">Verify Receipt Information</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <Label>Receipt Date</Label>
                  <Input 
                    type="date" 
                    value={(() => {
                      const dateStr = extracted.expense_date;
                      if (!dateStr) return "";
                      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
                      const match = dateStr.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
                      if (match) {
                        const day = match[1];
                        const monthStr = match[2];
                        const year = match[3];
                        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                        const monthIdx = months.indexOf(monthStr);
                        if (monthIdx !== -1) {
                          return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${day}`;
                        }
                      }
                      const parsed = new Date(dateStr);
                      return !isNaN(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : "";
                    })()} 
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setExtracted({ ...extracted, expense_date: null });
                        return;
                      }
                      const parsedDate = new Date(val);
                      if (!isNaN(parsedDate.getTime())) {
                        const day = String(parsedDate.getDate()).padStart(2, "0");
                        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                        const month = months[parsedDate.getMonth()];
                        const year = parsedDate.getFullYear();
                        setExtracted({ ...extracted, expense_date: `${day}-${month}-${year}` });
                      }
                    }} 
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Payment Method</Label>
                  <Input value={extracted.payment_method ?? ""} onChange={(e) => setExtracted({ ...extracted, payment_method: e.target.value })} placeholder="Cash, Card, UPI, etc." />
                </div>
                <div className="grid gap-1.5">
                  <Label>Service</Label>
                  <Input 
                    value={extracted.items[0]?.service ?? ""} 
                    onChange={(e) => {
                      const val = e.target.value;
                      const newItems = extracted.items.map(item => ({ ...item, service: val || null }));
                      setExtracted({ ...extracted, items: newItems });
                    }} 
                    placeholder="e.g. Amazon, Uber" 
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Extracted Line Items</Label>
            <div className="border rounded-xl overflow-hidden divide-y">
              <div className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1fr_1fr_1.5fr] gap-2 px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <div>Item Name</div>
                <div>Service</div>
                <div>Category</div>
                <div>Sub Category</div>
                <div className="text-right">Price (Total)</div>
                <div>Brand</div>
                <div>Remarks</div>
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {extracted.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[2fr_1fr_1.5fr_1.5fr_1fr_1fr_1.5fr] gap-2 px-4 py-2 items-center text-sm">
                    <Input value={it.item_name} onChange={(e) => updateItem(i, "item_name", e.target.value)} className="h-8 text-xs" />
                    <Input value={it.service ?? ""} onChange={(e) => updateItem(i, "service", e.target.value || null)} placeholder="e.g. Delivery" className="h-8 text-xs" />
                    <Select value={it.category} onValueChange={(v) => updateItem(i, "category", v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allCategories.map((c: any) => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input value={it.sub_category ?? ""} onChange={(e) => updateItem(i, "sub_category", e.target.value || null)} className="h-8 text-xs" />
                    <Input type="number" step="0.01" value={it.total_paid} onChange={(e) => updateItem(i, "total_paid", Number(e.target.value))} className="h-8 text-xs text-right" />
                    <Input value={it.brand ?? ""} onChange={(e) => updateItem(i, "brand", e.target.value || null)} className="h-8 text-xs" />
                    <Input value={it.remarks ?? ""} onChange={(e) => updateItem(i, "remarks", e.target.value || null)} className="h-8 text-xs" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={reset} className="gap-2"><X className="h-4 w-4" /> Discard</Button>
            <Button onClick={confirm} className="gap-2"><Check className="h-4 w-4" /> Save all expenses</Button>
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
                  <div className="text-sm font-medium truncate">{r.raw_llm_response?.payment_method ?? "Receipt"}</div>
                  <div className="text-xs text-muted-foreground">{formatDateHelper(r.uploaded_at)}</div>
                </div>
                <div className="text-sm font-semibold num">
                  {r.raw_llm_response?.items ? formatINR(r.raw_llm_response.items.reduce((acc: number, item: any) => acc + Number(item.total_paid || item.price || 0), 0)) : "—"}
                </div>
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
