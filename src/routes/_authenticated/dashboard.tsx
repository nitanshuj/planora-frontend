import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, TrendingUp, TrendingDown, Calendar } from "lucide-react";
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
  ScatterChart,
  Scatter,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  sub_category?: string | null;
  remarks?: string | null;
};
type Category = { id: string; name: string; is_mandatory: boolean };

function Dashboard() {
  const qc = useQueryClient();

  // Selected month state in YYYY-MM format
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);

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

  // Generate list of available months from expenses data (plus current month)
  const monthOptions = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add(currentMonthKey);
    for (const e of expenses) {
      if (e.expense_date) {
        const key = e.expense_date.slice(0, 7); // YYYY-MM
        if (/^\d{4}-\d{2}$/.test(key)) {
          monthsSet.add(key);
        }
      }
    }
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [expenses, currentMonthKey]);

  // Selected month start & end dates
  const [selYear, selMon] = selectedMonth.split("-").map(Number);
  const selectedMonthStart = new Date(selYear, selMon - 1, 1);
  const daysInSelectedMonth = new Date(selYear, selMon, 0).getDate();

  // Filter expenses for selected month
  const selectedMonthExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!e.expense_date) return false;
      return e.expense_date.startsWith(selectedMonth);
    });
  }, [expenses, selectedMonth]);

  // Daily Dot Plot Data for selected month (1 entry per day of month)
  const dotPlotData = useMemo(() => {
    const map = new Map<number, { day: number; spend: number; count: number }>();
    for (let i = 1; i <= daysInSelectedMonth; i++) {
      map.set(i, { day: i, spend: 0, count: 0 });
    }

    for (const e of selectedMonthExpenses) {
      if (e.category?.toLowerCase() === "home-mandatory") continue;
      const d = new Date(e.expense_date).getDate();
      if (map.has(d)) {
        const item = map.get(d)!;
        item.spend += Number(e.total_paid);
        item.count += 1;
      }
    }

    return Array.from(map.values());
  }, [selectedMonthExpenses, daysInSelectedMonth]);

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

  const monthBudget = 20000;

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

  const subCategoryData = useMemo(() => {
    const targetSubCategories = [
      "Snacks",
      "Eating Out",
      "Milk",
      "Bread",
      "Vegetables",
      "Fruits",
      "Eggs",
    ];

    const totals: Record<string, number> = {};
    for (const sub of targetSubCategories) {
      totals[sub] = 0;
    }

    for (const e of thisMonth) {
      const itemStr = (e.item_name || "").toLowerCase();
      const catStr = (e.category || "").toLowerCase();
      const subCatStr = (e.sub_category || "").toLowerCase();
      const remarksStr = (e.remarks || "").toLowerCase();

      for (const target of targetSubCategories) {
        const targetLower = target.toLowerCase();
        if (
          subCatStr.includes(targetLower) ||
          itemStr.includes(targetLower) ||
          catStr.includes(targetLower) ||
          remarksStr.includes(targetLower) ||
          (targetLower === "eating out" && (catStr.includes("dining") || itemStr.includes("restaurant") || itemStr.includes("swiggy") || itemStr.includes("zomato"))) ||
          (targetLower === "vegetables" && (itemStr.includes("veggie") || itemStr.includes("sabzi") || itemStr.includes("tomato") || itemStr.includes("potato") || itemStr.includes("onion"))) ||
          (targetLower === "fruits" && (itemStr.includes("apple") || itemStr.includes("banana") || itemStr.includes("mango") || itemStr.includes("orange"))) ||
          (targetLower === "snacks" && (itemStr.includes("snack") || itemStr.includes("chip") || itemStr.includes("biscuit") || itemStr.includes("namkeen")))
        ) {
          totals[target] += Number(e.total_paid);
          break;
        }
      }
    }

    const colors: Record<string, string> = {
      Snacks: "#E65100",
      "Eating Out": "#C2185B",
      Milk: "#1565C0",
      Bread: "#8D6E63",
      Vegetables: "#2E7D32",
      Fruits: "#F57C00",
      Eggs: "#FBC02D",
    };

    return targetSubCategories.map((name) => ({
      name,
      value: totals[name],
      fill: colors[name] || "#64748b",
    }));
  }, [thisMonth]);

  const budgetPct = monthBudget > 0 ? Math.min(100, (totalThis / monthBudget) * 100) : 0;

  const { data: sessionData } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) return null;
      const res = await fetch("http://localhost:8000/api/v1/auth/session", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const userName = sessionData?.user?.full_name || sessionData?.user?.email?.split("@")[0];

  const formatMonthLabel = (mKey: string) => {
    const [y, m] = mKey.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {userName ? `Welcome back, ${userName}` : "Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground">Your money at a glance.</p>
        </div>
      </div>

      {/* Top Bar Chart for Daily Spend */}
      <div className="card-soft p-5">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Daily Spend Breakdown
            </div>
            <div className="text-xs text-muted-foreground">
              Day-by-day expenditure for {formatMonthLabel(selectedMonth)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Select Month:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={dotPlotData} margin={{ top: 15, right: 10, bottom: 5, left: 10 }}>
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
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-border/80 bg-card p-3 shadow-lg text-xs space-y-1">
                        <div className="font-semibold text-foreground">
                          Day {data.day} ({formatMonthLabel(selectedMonth)})
                        </div>
                        <div className="text-primary font-medium">
                          Total Spend: {formatINR(data.spend)}
                        </div>
                        <div className="text-muted-foreground">
                          {data.count} transaction{data.count === 1 ? "" : "s"}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="spend" radius={[4, 4, 0, 0]} maxBarSize={30}>
                {dotPlotData.map((entry, index) => (
                  <Cell
                    key={`daily-bar-${index}`}
                    fill={entry.spend > 0 ? "oklch(0.48 0.16 275)" : "oklch(0.92 0.008 260)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
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

      <div className="card-soft p-5">
        <div className="text-sm font-semibold mb-1">Sub-category Spending</div>
        <div className="text-xs text-muted-foreground mb-4">
          Spending breakdown across key daily sub-categories
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={subCategoryData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid
                stroke="oklch(0.92 0.008 260)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="name"
                stroke="oklch(0.6 0.02 260)"
                fontSize={12}
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
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
                {subCategoryData.map((entry, index) => (
                  <Cell key={`sub-cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
