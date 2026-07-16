import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createClient } from "@supabase/supabase-js";

type ChatBody = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Build lightweight context from the caller's expenses (if bearer provided)
        let context = "The user has not yet shared any transaction data.";
        const auth = request.headers.get("authorization");
        if (auth?.startsWith("Bearer ")) {
          try {
            const token = auth.slice(7);
            const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
              global: { headers: { Authorization: `Bearer ${token}` } },
              auth: { persistSession: false },
            });
            const since = new Date();
            since.setDate(since.getDate() - 60);
            const [{ data: exp }, { data: cats }] = await Promise.all([
              sb.from("expenses").select("date,vendor,amount,category_id,notes").gte("date", since.toISOString().slice(0, 10)).order("date", { ascending: false }).limit(50),
              sb.from("categories").select("id,name,monthly_limit"),
            ]);
            if (exp && cats) {
              const catMap = new Map(cats.map((c: any) => [c.id, c.name]));
              const lines = exp.slice(0, 30).map((e: any) => `${e.date} · ${e.vendor} · $${e.amount} · ${catMap.get(e.category_id) ?? "Uncategorized"}`);
              const total = exp.reduce((s: number, e: any) => s + Number(e.amount), 0);
              context = `Recent 60d expenses: total $${total.toFixed(2)} across ${exp.length} transactions.\nCategories & monthly limits: ${cats.map((c: any) => `${c.name}${c.monthly_limit ? ` ($${c.monthly_limit})` : ""}`).join(", ")}.\nRecent items:\n${lines.join("\n")}`;
            }
          } catch (e) {
            console.error("chat context error", e);
          }
        }

        const system = `You are Planora's AI Financial Agent — warm, concise, insightful. Give practical, actionable answers about the user's personal finances. Use short paragraphs and bullet points. Format currency as $X.XX. When relevant, cite specific transactions.

USER FINANCIAL CONTEXT:
${context}`;

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages as UIMessage[] });
      },
    },
  },
});
