import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ExtractInput = z.object({ storagePath: z.string().min(1) });

export const extractReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ExtractInput.parse(v))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    // Download the image from private bucket
    const { data: file, error: dlErr } = await context.supabase.storage.from("receipts").download(data.storagePath);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "Failed to download receipt");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const b64 = btoa(String.fromCharCode(...bytes));
    const mime = file.type || "image/jpeg";

    // Load user categories for classification
    const { data: cats } = await context.supabase.from("categories").select("id,name");
    const catList = (cats ?? []).map((c: any) => c.name).join(", ") || "Groceries, Dining, Transport, Shopping, Other";

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      messages: [
        {
          role: "system",
          content: `Extract structured data from receipts. Return ONLY valid JSON matching this schema (no markdown, no prose):
{ "vendor": string, "date": "YYYY-MM-DD" | null, "total": number, "category": string, "items": [{ "description": string, "amount": number }] }
Pick the category from this list: ${catList}. If unsure, use "Other".`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract this receipt." },
            { type: "image", image: `data:${mime};base64,${b64}` },
          ] as any,
        },
      ],
    });

    // Try to parse JSON (strip code fences if present)
    const clean = text.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      throw new Error("AI did not return valid JSON");
    }

    // Match the category name to a category id
    const match = (cats ?? []).find((c: any) => c.name.toLowerCase() === String(parsed.category ?? "").toLowerCase());
    return { ...parsed, category_id: match?.id ?? null };
  });

const SaveInput = z.object({
  storagePath: z.string(),
  vendor: z.string(),
  date: z.string().nullable(),
  total: z.number(),
  category_id: z.string().nullable(),
  items: z.array(z.object({ description: z.string(), amount: z.number() })).optional(),
});

export const saveReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => SaveInput.parse(v))
  .handler(async ({ data, context }) => {
    const date = data.date ?? new Date().toISOString().slice(0, 10);
    const { data: receipt, error: recErr } = await context.supabase.from("receipts").insert({
      user_id: context.userId,
      storage_path: data.storagePath,
      status: "processed",
      vendor: data.vendor,
      total: data.total,
      receipt_date: date,
      extracted: { items: data.items ?? [] },
    }).select("id").single();
    if (recErr) throw recErr;

    const { error: expErr } = await context.supabase.from("expenses").insert({
      user_id: context.userId,
      date,
      vendor: data.vendor,
      amount: data.total,
      category_id: data.category_id,
      receipt_id: receipt.id,
    });
    if (expErr) throw expErr;

    return { ok: true };
  });
