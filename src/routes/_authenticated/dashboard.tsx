import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Progress } from "@/components/ui/progress";

import { formatINR } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Expense = {
  id: string;
  expense_date: string;
  total_paid: number;
  item_name: string;
  category: string;
};
type Category = { id: string; name: string; is_mandatory: boolean };

function Dashboard() {
  const qc = useQueryClient();

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch("http://localhost:8000/api/v1/expenses", { headers });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return (await res.json()) as Expense[];
    },
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch("http://localhost:8000/api/v1/categories", { headers });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return (await res.json()) as Category[];
    },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisMonth = expenses.filter(
    (e) => new Date(e.expense_date) >= monthStart && e.category?.toLowerCase() !== "home-mandatory",
  );
  const lastMonth = expenses.filter((e) => {
    const d = new Date(e.expense_date);
    return d >= lastMonthStart && d < monthStart && e.category?.toLowerCase() !== "home-mandatory";
  });
  const totalThis = thisMonth.reduce((s, e) => s + Number(e.total_paid), 0);
  const totalLast = lastMonth.reduce((s, e) => s + Number(e.total_paid), 0);
  const delta = totalLast > 0 ? ((totalThis - totalLast) / totalLast) * 100 : 0;

  // Let's hardcode simple limits or default them since real schema categories don't have monthly_limit anymore
  const monthBudget = 20000; // default INR budget limit

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lineData = useMemo(() => {
    const map = new Map<number, number>();
    for (let i = 1; i <= daysInMonth; i++) map.set(i, 0);
    let cum = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const day = thisMonth
        .filter((e) => new Date(e.expense_date).getDate() === i)
        .reduce((s, e) => s + Number(e.total_paid), 0);
      cum += day;
      map.set(i, cum);
    }
    return Array.from(map.entries()).map(([day, value]) => ({ day, value }));
  }, [thisMonth, daysInMonth]);

  const pieData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of thisMonth) {
      if (!e.category) continue;
      totals.set(e.category, (totals.get(e.category) ?? 0) + Number(e.total_paid));
    }
    // Categories are dynamic based on distinct names, let's map them with stable styling colors
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
    return Array.from(totals.entries())
      .map(([name, value]) => ({
        name,
        value,
        color: colors[name] || "#64748b",
      }))
      .filter((d) => d.value > 0);
  }, [thisMonth]);

  const typeData = useMemo(() => {
    let mandatoryTotal = 0;
    let discretionaryTotal = 0;

    const mandatorySet = new Set(categories.filter((c) => c.is_mandatory).map((c) => c.name));

    for (const e of thisMonth) {
      if (!e.category) continue;
      const isMandatory = mandatorySet.has(e.category);
      if (isMandatory) {
        mandatoryTotal += Number(e.total_paid);
      } else {
        discretionaryTotal += Number(e.total_paid);
      }
    }

    return [
      { name: "Mandatory (Needs)", value: mandatoryTotal, fill: "oklch(0.52 0.14 145)" },
      { name: "Discretionary (Wants)", value: discretionaryTotal, fill: "oklch(0.48 0.16 275)" },
    ];
  }, [thisMonth, categories]);

  const barData = useMemo(() => {
    return [...pieData].sort((a, b) => b.value - a.value);
  }, [pieData]);

  const budgetPct = monthBudget > 0 ? Math.min(100, (totalThis / monthBudget) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your money at a glance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Spent this month"
          value={formatINR(totalThis)}
          icon={Wallet}
          sub={`${thisMonth.length} transactions`}
        />
        <StatCard
          title="vs last month"
          value={`${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`}
          icon={delta >= 0 ? TrendingUp : TrendingDown}
          sub={formatINR(totalLast) + " last month"}
          tone={delta >= 0 ? "warn" : "good"}
        />
        <div className="card-soft p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            Monthly budget
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-2xl font-semibold num">{formatINR(totalThis)}</div>
            <div className="text-sm text-muted-foreground num">/ {formatINR(monthBudget)}</div>
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
                <CartesianGrid
                  stroke="oklch(0.92 0.008 260)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  stroke="oklch(0.6 0.02 260)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="oklch(0.6 0.02 260)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${v}`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid oklch(0.92 0.008 260)",
                    boxShadow: "0 10px 30px -5px rgba(15,23,42,0.08)",
                  }}
                  formatter={(v: number) => formatINR(v)}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="oklch(0.48 0.16 275)"
                  strokeWidth={2.5}
                  dot={false}
                />
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
                  <Pie
                    data={pieData}
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatINR(v)}
                    contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.92 0.008 260)" }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-soft p-5">
          <div className="text-sm font-semibold mb-3">Mandatory vs. Discretionary Spending</div>
          {typeData.every((d) => d.value === 0) ? (
            <div className="h-72 grid place-items-center text-sm text-muted-foreground">
              No spending records to analyze.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={typeData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid
                    stroke="oklch(0.92 0.008 260)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="oklch(0.6 0.02 260)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="oklch(0.6 0.02 260)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${v}`}
                  />
                  <Tooltip
                    formatter={(v: number) => formatINR(v)}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid oklch(0.92 0.008 260)",
                      backgroundColor: "var(--color-card)",
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card-soft p-5">
          <div className="text-sm font-semibold mb-3">Spending by Category</div>
          {barData.length === 0 ? (
            <div className="h-72 grid place-items-center text-sm text-muted-foreground">
              No spending records to analyze.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart
                  data={barData}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    stroke="oklch(0.92 0.008 260)"
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="oklch(0.6 0.02 260)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `₹${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="oklch(0.6 0.02 260)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(v: number) => formatINR(v)}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid oklch(0.92 0.008 260)",
                      backgroundColor: "var(--color-card)",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={20}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return formatINR(n);
}

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  tone,
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
