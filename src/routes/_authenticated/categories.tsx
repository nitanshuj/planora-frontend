import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Layers, Edit2, Save, Plus, AlertCircle, Trash2, Filter, BarChart3, Calendar } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import { formatINR } from "@/lib/utils";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/categories")({
  component: CategoriesPage,
});

type Category = {
  id: string;
  name: string;
  is_mandatory: boolean;
  monthly_limit?: number | null;
  created_at: string;
};

export function CategoriesPage() {
  const queryClient = useQueryClient();
  
  // Selection state for adding a category limit
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [addLimitValue, setAddLimitValue] = useState<string>("");

  // Editing state for existing limits
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLimitValue, setEditLimitValue] = useState<string>("");

  // View filter: false = show only categories with limits set, true = show all
  const [showAll, setShowAll] = useState<boolean>(false);

  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      options.push({ value, label });
    }
    return options;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: categories = [], isLoading, error } = useQuery<Category[]>({
    queryKey: ["categories", selectedMonth],
    queryFn: () => apiFetch(`/categories?month_year=${selectedMonth}`),
  });

  const { data: expenses = [] } = useQuery<{ category: string; total_paid: number; expense_date: string }[]>({
    queryKey: ["expenses"],
    queryFn: () => apiFetch("/expenses"),
  });

  const categoryLimitData = useMemo(() => {
    return categories
      .filter((c) => c.monthly_limit !== null && c.monthly_limit !== undefined && Number(c.monthly_limit) > 0)
      .map((c) => {
        const catNameClean = c.name.trim().toLowerCase();
        const spend = expenses
          .filter((e) => e.expense_date?.startsWith(selectedMonth) && (e.category || "").trim().toLowerCase() === catNameClean)
          .reduce((sum, e) => sum + Number(e.total_paid), 0);
        const limit = Number(c.monthly_limit);
        const pct = limit > 0 ? (spend / limit) * 100 : 0;
        return {
          id: c.id,
          name: c.name,
          spend,
          limit,
          pct: Math.round(pct),
          status: pct > 100 ? "exceeded" : pct >= 80 ? "warning" : "good",
        };
      });
  }, [categories, expenses, selectedMonth]);

  const sideBySideCategoryData = useMemo(() => {
    return categoryLimitData.map((c) => {
      const remaining = Math.max(0, c.limit - c.spend);
      return {
        name: c.name,
        "Monthly Limit": c.limit,
        "Actual Spend": c.spend,
        "Remaining Budget": remaining,
      };
    });
  }, [categoryLimitData]);

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, monthly_limit }: { id: string; monthly_limit: number | null }) => {
      return apiFetch(`/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthly_limit }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingId(null);
      setSelectedCatId("");
      setAddLimitValue("");
    },
  });

  const handleStartEdit = (id: string, currentLimit?: number | null) => {
    setEditingId(id);
    setEditLimitValue(currentLimit !== undefined && currentLimit !== null ? String(currentLimit) : "");
  };

  const handleAddCategoryLimit = () => {
    if (!selectedCatId) return;
    const limitNum = addLimitValue.trim() === "" ? null : parseFloat(addLimitValue);
    updateCategoryMutation.mutate({ id: selectedCatId, monthly_limit: limitNum });
  };

  const handleSaveCatLimit = (catId: string) => {
    const limitNum = editLimitValue.trim() === "" ? null : parseFloat(editLimitValue);
    updateCategoryMutation.mutate({ id: catId, monthly_limit: limitNum });
  };

  const handleRemoveCatLimit = (catId: string) => {
    updateCategoryMutation.mutate({ id: catId, monthly_limit: null });
  };

  // Categories that currently have a monthly limit set
  const categoriesWithLimits = categories.filter((c) => c.monthly_limit !== null && c.monthly_limit !== undefined);
  
  // Categories available to set a new limit on
  const categoriesWithoutLimits = categories.filter((c) => c.monthly_limit === null || c.monthly_limit === undefined);

  // Active display list based on showAll toggle
  const displayedCategories = showAll
    ? categories
    : categoriesWithLimits;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-44 bg-card animate-pulse rounded-xl border" />
          <div className="h-44 bg-card animate-pulse rounded-xl border" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 text-destructive p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <div>
            <h3 className="font-semibold">Error loading categories</h3>
            <p className="text-sm opacity-90">{(error as Error).message}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Category Monthly Limits</h1>
          <p className="text-muted-foreground text-sm">
            Select a category to set its monthly budget limit.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={() => setShowAll((prev) => !prev)}
        >
          <Filter className="h-3.5 w-3.5" />
          {showAll ? "Showing All Categories" : "Showing Only Configured Limits"}
        </Button>
      </div>

      {/* Category Spend vs. Monthly Limit Progress Visualization */}
      {categoryLimitData.length > 0 && (
        <Card className="p-5 space-y-4">
          <CardHeader className="p-0 pb-1 flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Category Budget Utilization
              </CardTitle>
              <CardDescription className="text-xs">
                Live tracking of actual spend vs. configured category monthly limits.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 min-w-[160px]">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="text-xs">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sideBySideCategoryData}
                  barGap={0}
                  barCategoryGap="25%"
                  margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" stroke="oklch(0.6 0.02 260)" fontSize={12} tickLine={false} />
                  <YAxis stroke="oklch(0.6 0.02 260)" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatINR(value), name]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid oklch(0.92 0.008 260)",
                      backgroundColor: "var(--color-card)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  <Bar dataKey="Monthly Limit" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="Actual Spend" fill="#F87171" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="Remaining Budget" fill="#FBBF24" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Monthly Limit for a Category */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Set Monthly Limit for Category
          </CardTitle>
          <CardDescription className="text-xs">
            Choose a category from your list and specify a monthly spending cap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-64">
              <Select value={selectedCatId} onValueChange={setSelectedCatId}>
                <SelectTrigger className="bg-background text-sm">
                  <SelectValue placeholder="Select Category..." />
                </SelectTrigger>
                <SelectContent>
                  {categoriesWithoutLimits.length > 0 ? (
                    categoriesWithoutLimits.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.is_mandatory ? "(Mandatory)" : ""}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-xs text-muted-foreground">
                      All categories already have limits set.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-44">
              <Input
                type="number"
                placeholder="Monthly limit (₹)"
                value={addLimitValue}
                onChange={(e) => setAddLimitValue(e.target.value)}
                className="bg-background text-sm"
                min={0}
              />
            </div>

            <Button
              onClick={handleAddCategoryLimit}
              disabled={!selectedCatId || !addLimitValue.trim() || updateCategoryMutation.isPending}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> Save Limit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configured Category Limits List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Configured Category Limits ({displayedCategories.length})
          </h2>
        </div>

        {displayedCategories.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <div className="text-muted-foreground text-sm">
              No category limits configured yet. Select a category above to set a monthly limit!
            </div>
          </Card>
        ) : (
          displayedCategories.map((cat) => {
            const isCatEditing = editingId === cat.id;

            return (
              <Card key={cat.id} className="overflow-hidden transition-all duration-200 hover:shadow-sm">
                <CardHeader className="py-4 bg-muted/20">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-base">{cat.name}</span>
                      {cat.is_mandatory && (
                        <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                          Mandatory
                        </Badge>
                      )}
                    </div>

                    {/* Category Limit Controls */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Monthly Limit</div>
                        <div className="text-sm font-semibold text-primary">
                          {cat.monthly_limit !== null && cat.monthly_limit !== undefined
                            ? formatINR(cat.monthly_limit)
                            : "No Limit"}
                        </div>
                      </div>

                      {isCatEditing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            placeholder="Limit (₹)"
                            value={editLimitValue}
                            onChange={(e) => setEditLimitValue(e.target.value)}
                            className="w-28 h-8 text-sm bg-background"
                            min={0}
                          />
                          <Button
                            size="sm"
                            className="h-8 px-2.5"
                            onClick={() => handleSaveCatLimit(cat.id)}
                            disabled={updateCategoryMutation.isPending}
                          >
                            <Save className="h-3.5 w-3.5 mr-1" /> Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => handleStartEdit(cat.id, cat.monthly_limit)}
                          >
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" /> Edit Limit
                          </Button>

                          {cat.monthly_limit !== null && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Remove category limit"
                              onClick={() => handleRemoveCatLimit(cat.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
