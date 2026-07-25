import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
  Cell,
  BarChart,
  Bar,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/api";


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

type SubCategory = {
  id: string;
  name: string;
  monthly_limit?: number | null;
};

type Category = {
  id: string;
  name: string;
  is_mandatory: boolean;
  monthly_limit?: number | null;
  sub_categories?: SubCategory[];
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function Dashboard() {
  const qc = useQueryClient();

  // Selected period state in YYYY-MM or YYYY-YEAR format
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(currentMonthKey);

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: () => apiFetch("/expenses"),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => apiFetch("/categories"),
  });

  // Generate period options (months and full-year totals)
  const { monthOptions, yearOptions } = useMemo(() => {
    const monthsSet = new Set<string>();
    const yearsSet = new Set<string>();

    monthsSet.add(currentMonthKey);
    yearsSet.add(currentMonthKey.slice(0, 4));

    for (const e of expenses) {
      if (e.expense_date) {
        const mKey = e.expense_date.slice(0, 7); // YYYY-MM
        const yKey = e.expense_date.slice(0, 4); // YYYY
        if (/^\d{4}-\d{2}$/.test(mKey)) monthsSet.add(mKey);
        if (/^\d{4}$/.test(yKey)) yearsSet.add(yKey);
      }
    }

    const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
    const sortedYears = Array.from(yearsSet)
      .sort((a, b) => b.localeCompare(a))
      .map((y) => `${y}-YEAR`);

    return { monthOptions: sortedMonths, yearOptions: sortedYears };
  }, [expenses, currentMonthKey]);

  const isYearMode = selectedPeriod.endsWith("-YEAR");
  const selectedYear = Number(selectedPeriod.split("-")[0]);
  const selectedMonthNum = isYearMode ? null : Number(selectedPeriod.split("-")[1]);

  const formatPeriodLabel = (pKey: string) => {
    if (pKey.endsWith("-YEAR")) {
      const y = pKey.split("-")[0];
      return `Total (${y})`;
    }
    const [y, m] = pKey.split("-").map(Number);
    const date = new Date(y, m - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Filter expenses for selected period (excluding mandatory home expenses for graph analysis)
  const selectedPeriodExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!e.expense_date) return false;
      if (isYearMode) {
        return e.expense_date.startsWith(`${selectedYear}`);
      }
      return e.expense_date.startsWith(selectedPeriod);
    });
  }, [expenses, selectedPeriod, isYearMode, selectedYear]);

  const discretionaryExpenses = useMemo(() => {
    return selectedPeriodExpenses.filter(
      (e) =>
        e.category?.toLowerCase() !== "home-mandatory" &&
        e.category?.toLowerCase() !== "extra charge",
    );
  }, [selectedPeriodExpenses]);

  // Previous Period Expenses for comparison %
  const prevPeriodExpenses = useMemo(() => {
    if (isYearMode) {
      const prevYearStr = `${selectedYear - 1}`;
      return expenses.filter(
        (e) =>
          e.expense_date?.startsWith(prevYearStr) &&
          e.category?.toLowerCase() !== "home-mandatory" &&
          e.category?.toLowerCase() !== "extra charge",
      );
    } else if (selectedMonthNum !== null) {
      const prevDate = new Date(selectedYear, selectedMonthNum - 2, 1);
      const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
      return expenses.filter(
        (e) =>
          e.expense_date?.startsWith(prevMonthKey) &&
          e.category?.toLowerCase() !== "home-mandatory" &&
          e.category?.toLowerCase() !== "extra charge",
      );
    }
    return [];
  }, [expenses, isYearMode, selectedYear, selectedMonthNum]);

  const totalThisPeriod = discretionaryExpenses.reduce(
    (s, e) => s + Number(e.total_paid),
    0,
  );
  const totalPrevPeriod = prevPeriodExpenses.reduce(
    (s, e) => s + Number(e.total_paid),
    0,
  );
  const delta =
    totalPrevPeriod > 0
      ? ((totalThisPeriod - totalPrevPeriod) / totalPrevPeriod) * 100
      : 0;

  // Primary Breakdown Chart Data (Daily for Month mode, Monthly for Year mode)
  const breakdownChartData = useMemo(() => {
    if (isYearMode) {
      const map = new Map<number, { label: string; monthName: string; spend: number; count: number }>();
      for (let m = 1; m <= 12; m++) {
        map.set(m, { label: MONTH_NAMES[m - 1], monthName: MONTH_NAMES[m - 1], spend: 0, count: 0 });
      }
      for (const e of discretionaryExpenses) {
        const dateObj = new Date(e.expense_date);
        const m = dateObj.getMonth() + 1;
        if (map.has(m)) {
          const item = map.get(m)!;
          item.spend += Number(e.total_paid);
          item.count += 1;
        }
      }
      return Array.from(map.values());
    } else if (selectedMonthNum !== null) {
      const daysInMonth = new Date(selectedYear, selectedMonthNum, 0).getDate();
      const map = new Map<number, { label: number; day: number; spend: number; count: number }>();
      for (let d = 1; d <= daysInMonth; d++) {
        map.set(d, { label: d, day: d, spend: 0, count: 0 });
      }
      for (const e of discretionaryExpenses) {
        const d = new Date(e.expense_date).getDate();
        if (map.has(d)) {
          const item = map.get(d)!;
          item.spend += Number(e.total_paid);
          item.count += 1;
        }
      }
      return Array.from(map.values());
    }
    return [];
  }, [discretionaryExpenses, isYearMode, selectedYear, selectedMonthNum]);

  // Cumulative Line Chart Data
  const lineData = useMemo(() => {
    if (isYearMode) {
      let cum = 0;
      return MONTH_NAMES.map((mName, idx) => {
        const monthNum = idx + 1;
        const monthSpend = discretionaryExpenses
          .filter((e) => new Date(e.expense_date).getMonth() + 1 === monthNum)
          .reduce((s, e) => s + Number(e.total_paid), 0);
        cum += monthSpend;
        return { label: mName, value: cum };
      });
    } else if (selectedMonthNum !== null) {
      const daysInMonth = new Date(selectedYear, selectedMonthNum, 0).getDate();
      let cum = 0;
      const res = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const daySpend = discretionaryExpenses
          .filter((e) => new Date(e.expense_date).getDate() === d)
          .reduce((s, e) => s + Number(e.total_paid), 0);
        cum += daySpend;
        res.push({ label: d, value: cum });
      }
      return res;
    }
    return [];
  }, [discretionaryExpenses, isYearMode, selectedYear, selectedMonthNum]);

  // Category Breakdown Bar Data (X: Category, Y: Cost till now)
  const categoryData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of discretionaryExpenses) {
      if (!e.category) continue;
      totals.set(e.category, (totals.get(e.category) ?? 0) + Number(e.total_paid));
    }

    const categoryColors: Record<string, string> = {
      Groceries: "#2E7D32",
      Leisure: "#0284C7",
      "Extra Charge": "#E11D48",
      "Home Items": "#7C3AED",
      "Home-Mandatory": "#D97706",
      Food_Office: "#EA580C",
      Cosmetics: "#DB2777",
      "Medical Health": "#059669",
      Home: "#4F46E5",
      Puja: "#F59E0B",
      Travel: "#0891B2",
      "PC Rig": "#9333EA",
      Clothes: "#C026D3",
      Mandir: "#B45309",
      Electronics: "#2563EB",
      "Phone Recharge": "#10B981",
      Activa: "#65A30D",
      Dining: "#E65100",
      Transport: "#455A64",
      Shopping: "#6A1B9A",
      Utilities: "#1565C0",
      Entertainment: "#C2185B",
      Health: "#00838F",
      Other: "#64748B",
    };

    const entries = Array.from(totals.entries()).filter((d) => d[1] > 0);
    entries.sort((a, b) => b[1] - a[1]);

    return entries.map(([name, value]) => {
      let color = categoryColors[name];
      if (!color) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        color = `hsl(${hue}, 65%, 45%)`;
      }
      return {
        name,
        value,
        color,
      };
    });
  }, [discretionaryExpenses]);

  // Sub-category Breakdown Data
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

    for (const e of discretionaryExpenses) {
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
          (targetLower === "eating out" &&
            (catStr.includes("dining") ||
              itemStr.includes("restaurant") ||
              itemStr.includes("swiggy") ||
              itemStr.includes("zomato"))) ||
          (targetLower === "vegetables" &&
            (itemStr.includes("veggie") ||
              itemStr.includes("sabzi") ||
              itemStr.includes("tomato") ||
              itemStr.includes("potato") ||
              itemStr.includes("onion"))) ||
          (targetLower === "fruits" &&
            (itemStr.includes("apple") ||
              itemStr.includes("banana") ||
              itemStr.includes("mango") ||
              itemStr.includes("orange"))) ||
          (targetLower === "snacks" &&
            (itemStr.includes("snack") ||
              itemStr.includes("chip") ||
              itemStr.includes("biscuit") ||
              itemStr.includes("namkeen")))
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
  }, [discretionaryExpenses]);

  const { data: sessionData } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      if (!token) return null;
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/session`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const userName =
    sessionData?.user?.full_name || sessionData?.user?.email?.split("@")[0];

  const prevPeriodLabel = isYearMode
    ? `${selectedYear - 1}`
    : selectedMonthNum !== null
      ? formatPeriodLabel(
          `${new Date(selectedYear, selectedMonthNum - 2, 1).getFullYear()}-${String(
            new Date(selectedYear, selectedMonthNum - 2, 1).getMonth() + 1,
          ).padStart(2, "0")}`,
        )
      : "previous period";

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

      {/* Top Bar Chart for Spend Breakdown & Global Date Filter */}
      <div className="card-soft p-5">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />{" "}
              {isYearMode ? "Monthly Spend Breakdown" : "Daily Spend Breakdown"}
            </div>
            <div className="text-xs text-muted-foreground">
              {isYearMode
                ? `Month-by-month expenditure for ${formatPeriodLabel(selectedPeriod)}`
                : `Day-by-day expenditure for ${formatPeriodLabel(selectedPeriod)}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Select Period:</span>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[190px] h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
                    Monthly Views
                  </SelectLabel>
                  {monthOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {formatPeriodLabel(m)}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
                    Annual Totals
                  </SelectLabel>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>
                      {formatPeriodLabel(y)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={breakdownChartData} margin={{ top: 15, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid
                stroke="oklch(0.92 0.008 260)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
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
                          {isYearMode
                            ? `${data.monthName} (${selectedYear})`
                            : `Day ${data.day} (${formatPeriodLabel(selectedPeriod)})`}
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
              <Bar dataKey="spend" radius={[4, 4, 0, 0]} maxBarSize={35}>
                {breakdownChartData.map((entry, index) => (
                  <Cell
                    key={`bar-${index}`}
                    fill={entry.spend > 0 ? "oklch(0.48 0.16 275)" : "oklch(0.92 0.008 260)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title={isYearMode ? `Spent in ${selectedYear}` : "Spent this month"}
          value={formatINR(totalThisPeriod)}
          icon={Wallet}
          sub={`${discretionaryExpenses.length} transactions (${formatPeriodLabel(selectedPeriod)})`}
        />
        <StatCard
          title={isYearMode ? "vs last year" : "vs last month"}
          value={`${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`}
          icon={delta >= 0 ? TrendingUp : TrendingDown}
          sub={`${formatINR(totalPrevPeriod)} (${prevPeriodLabel})`}
          tone={delta >= 0 ? "warn" : "good"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Cumulative spend</div>
              <div className="text-xs text-muted-foreground">
                {isYearMode
                  ? `${selectedYear}, month by month`
                  : `${formatPeriodLabel(selectedPeriod)}, day by day`}
              </div>
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
                  dataKey="label"
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

        <div className="card-soft p-5">
          <div className="text-sm font-semibold mb-1">Spending breakdown</div>
          <div className="text-xs text-muted-foreground mb-3">
            Expenditure by area till now
          </div>
          {categoryData.length === 0 ? (
            <div className="h-72 grid place-items-center text-sm text-muted-foreground">
              No spending recorded for {formatPeriodLabel(selectedPeriod)}.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
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
                    interval={0}
                    angle={-20}
                    textAnchor="end"
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
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={45}>
                    {categoryData.map((entry, index) => (
                      <Cell key={`cat-cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>


      <div className="card-soft p-5">
        <div className="text-sm font-semibold mb-1">Daily & Item Spending</div>
        <div className="text-xs text-muted-foreground mb-4">
          Spending breakdown across key items ({formatPeriodLabel(selectedPeriod)})
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

