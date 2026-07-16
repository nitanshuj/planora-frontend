import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, TrendingUp, TrendingDown, Sparkles, ArrowUpRight } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Expense = { id: string; date: string; amount: number; vendor: string; category_id: string | null };
type Category = { id: string; name: string; color: string; monthly_limit: number | null };

function Dashboard() {
  const qc = useQueryClient();

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("id,date,amount,vendor,category_id").order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,color,monthly_limit");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("dashboard-expenses")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => {
        qc.invalidateQueries({ queryKey: ["expenses"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisMonth = expenses.filter((e) => new Date(e.date) >= monthStart);
  const lastMonth = expenses.filter((e) => {
    const d = new Date(e.date);
    return d >= lastMonthStart && d < monthStart;
  });
  const totalThis = thisMonth.reduce((s, e) => s + Number(e.amount), 0);
  const totalLast = lastMonth.reduce((s, e) => s + Number(e.amount), 0);
  const delta = totalLast > 0 ? ((totalThis - totalLast) / totalLast) * 100 : 0;
  const monthBudget = categories.reduce((s, c) => s + Number(c.monthly_limit ?? 0), 0);

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lineData = useMemo(() => {
    const map = new Map<number, number>();
    for (let i = 1; i <= daysInMonth; i++) map.set(i, 0);
    let cum = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const day = thisMonth.filter((e) => new Date(e.date).getDate() === i).reduce((s, e) => s + Number(e.amount), 0);
      cum += day;
      map.set(i, cum);
    }
    return Array.from(map.entries()).map(([day, value]) => ({ day, value }));
  }, [thisMonth, daysInMonth]);

  const pieData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of thisMonth) {
      if (!e.category_id) continue;
      totals.set(e.category_id, (totals.get(e.category_id) ?? 0) + Number(e.amount));
    }
    return categories
      .map((c) => ({ name: c.name, value: totals.get(c.id) ?? 0, color: c.color }))
      .filter((d) => d.value > 0);
  }, [thisMonth, categories]);

  const [insight, setInsight] = useState<string>("Analyzing your spending…");
  useEffect(() => {
    if (expenses.length === 0) {
      setInsight("Add your first expense or receipt to unlock AI insights tailored to you.");
      return;
    }
    const topCat = pieData.slice().sort((a, b) => b.value - a.value)[0];
    if (!topCat) return;
    const pct = totalThis > 0 ? Math.round((topCat.value / totalThis) * 100) : 0;
    setInsight(
      `You've spent ${fmt(totalThis)} this month — ${
        delta >= 0 ? "up" : "down"
      } ${Math.abs(delta).toFixed(0)}% vs last month. ${topCat.name} leads at ${pct}% of spend.`,
    );
  }, [expenses.length, totalThis, delta, pieData]);

  const budgetPct = monthBudget > 0 ? Math.min(100, (totalThis / monthBudget) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your money at a glance.</p>
      </div>

      <div className="card-soft p-5 flex items-start gap-4 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-medium text-primary uppercase tracking-wider">AI Insight</div>
          <p className="mt-1 text-sm">{insight}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Spent this month" value={fmt(totalThis)} icon={Wallet} sub={`${thisMonth.length} transactions`} />
        <StatCard
          title="vs last month"
          value={`${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`}
          icon={delta >= 0 ? TrendingUp : TrendingDown}
          sub={fmt(totalLast) + " last month"}
          tone={delta >= 0 ? "warn" : "good"}
        />
        <div className="card-soft p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Monthly budget</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-2xl font-semibold num">{fmt(totalThis)}</div>
            <div className="text-sm text-muted-foreground num">/ {fmt(monthBudget)}</div>
          </div>
          <Progress value={budgetPct} className="mt-3 h-2" />
          <div className="mt-1 text-xs text-muted-foreground">{budgetPct.toFixed(0)}% used</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card-soft p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Cumulative spend</div>
              <div className="text-xs text-muted-foreground">This month, day by day</div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={lineData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="oklch(0.92 0.008 260)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="oklch(0.6 0.02 260)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.6 0.02 260)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.92 0.008 260)", boxShadow: "0 10px 30px -5px rgba(15,23,42,0.08)" }}
                  formatter={(v: number) => fmt(v)}
                />
                <Line type="monotone" dataKey="value" stroke="oklch(0.48 0.16 275)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-soft p-5 lg:col-span-2">
          <div className="text-sm font-semibold mb-3">Category breakdown</div>
          {pieData.length === 0 ? (
            <div className="h-72 grid place-items-center text-sm text-muted-foreground">
              No spending yet this month.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value" nameKey="name">
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.92 0.008 260)" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card-soft p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">Recent activity</div>
          <a href="/transactions" className="text-xs text-primary flex items-center gap-1 hover:underline">
            View all <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
        <div className="divide-y divide-border/60">
          {expenses.slice(0, 6).map((e) => {
            const cat = categories.find((c) => c.id === e.category_id);
            return (
              <div key={e.id} className="flex items-center py-3 gap-3">
                <div className="h-9 w-9 rounded-lg grid place-items-center text-xs font-semibold" style={{ backgroundColor: (cat?.color ?? "#64748b") + "22", color: cat?.color ?? "#64748b" }}>
                  {(e.vendor?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{e.vendor}</div>
                  <div className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString()} · {cat?.name ?? "Uncategorized"}</div>
                </div>
                <div className="text-sm font-semibold num">{fmt(Number(e.amount))}</div>
              </div>
            );
          })}
          {expenses.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">No expenses yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function StatCard({
  title, value, icon: Icon, sub, tone,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="card-soft p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{title}</div>
        <div
          className={`h-8 w-8 rounded-lg grid place-items-center ${
            tone === "good"
              ? "bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]"
              : tone === "warn"
                ? "bg-warning/15 text-[color:var(--color-warning)]"
                : "bg-primary/10 text-primary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold num">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
