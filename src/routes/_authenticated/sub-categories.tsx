import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Target,
  Edit2,
  Save,
  Plus,
  AlertCircle,
  Trash2,
  Filter,
  Layers,
  BarChart3,
  Calendar,
} from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/sub-categories")({
  component: SubCategoriesPage,
});

type SubCategory = {
  id: string;
  category_id: string;
  name: string;
  monthly_limit?: number | null;
  created_at: string;
};

type Category = {
  id: string;
  name: string;
  is_mandatory: boolean;
  monthly_limit?: number | null;
  created_at: string;
  sub_categories?: SubCategory[];
};

export function SubCategoriesPage() {
  const queryClient = useQueryClient();

  // Add form state
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [selectedSubId, setSelectedSubId] = useState<string>("");
  const [customSubName, setCustomSubName] = useState<string>("");
  const [addLimitValue, setAddLimitValue] = useState<string>("");

  // Edit state
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editLimitValue, setEditLimitValue] = useState<string>("");

  // Filter state
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

  const {
    data: categories = [],
    isLoading,
    error,
  } = useQuery<Category[]>({
    queryKey: ["categories", selectedMonth],
    queryFn: () => apiFetch(`/categories?month_year=${selectedMonth}`),
  });

  const { data: expenses = [] } = useQuery<
    {
      category: string;
      sub_category?: string;
      item_name?: string;
      total_paid: number;
      expense_date: string;
    }[]
  >({
    queryKey: ["expenses"],
    queryFn: () => apiFetch("/expenses"),
  });

  const subCategoryLimitData = useMemo(() => {
    const subList: {
      id: string;
      name: string;
      categoryName: string;
      spend: number;
      limit: number;
      pct: number;
      status: string;
    }[] = [];
    categories.forEach((cat) => {
      if (cat.sub_categories) {
        cat.sub_categories.forEach((sub) => {
          if (
            sub.monthly_limit !== null &&
            sub.monthly_limit !== undefined &&
            Number(sub.monthly_limit) > 0
          ) {
            const subNameClean = sub.name.trim().toLowerCase();
            const catNameClean = cat.name.trim().toLowerCase();
            const spend = expenses
              .filter((e) => {
                if (!e.expense_date?.startsWith(selectedMonth)) return false;
                const eSub = (e.sub_category || "").trim().toLowerCase();
                const eItem = (e.item_name || "").trim().toLowerCase();
                const eCat = (e.category || "").trim().toLowerCase();

                // Case-insensitive subcategory or item match
                const subMatches =
                  (eSub !== "" && (eSub.includes(subNameClean) || subNameClean.includes(eSub))) ||
                  (eItem !== "" && (eItem.includes(subNameClean) || subNameClean.includes(eItem)));

                if (!subMatches) return false;

                // Match category if specified or default to subcategory match
                return eCat === "" || eCat === catNameClean || subMatches;
              })
              .reduce((sum, e) => sum + Number(e.total_paid), 0);
            const limit = Number(sub.monthly_limit);
            const pct = limit > 0 ? (spend / limit) * 100 : 0;
            subList.push({
              id: sub.id,
              name: sub.name,
              categoryName: cat.name,
              spend,
              limit,
              pct: Math.round(pct),
              status: pct > 100 ? "exceeded" : pct >= 80 ? "warning" : "good",
            });
          }
        });
      }
    });
    return subList;
  }, [categories, expenses, selectedMonth]);

  const sideBySideSubCategoryData = useMemo(() => {
    return subCategoryLimitData.map((s) => {
      const remaining = Math.max(0, s.limit - s.spend);
      return {
        name: s.name,
        "Monthly Limit": s.limit,
        "Actual Spend": s.spend,
        "Remaining Budget": remaining,
      };
    });
  }, [subCategoryLimitData]);

  // Flat list of all subcategories with category details attached
  const allSubCategories = useMemo(() => {
    const list: (SubCategory & { category_name: string; category_is_mandatory: boolean })[] = [];
    categories.forEach((cat) => {
      if (cat.sub_categories) {
        cat.sub_categories.forEach((sub) => {
          list.push({
            ...sub,
            category_name: cat.name,
            category_is_mandatory: cat.is_mandatory,
          });
        });
      }
    });
    return list;
  }, [categories]);

  // Subcategories for selected category in add form
  const availableSubCatsForSelectedCat = useMemo(() => {
    if (!selectedCatId) return [];
    const cat = categories.find((c) => c.id === selectedCatId);
    return cat?.sub_categories || [];
  }, [categories, selectedCatId]);

  const updateSubCategoryMutation = useMutation({
    mutationFn: async ({ id, monthly_limit }: { id: string; monthly_limit: number | null }) => {
      return apiFetch(`/sub-categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthly_limit }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setEditingSubId(null);
      setSelectedSubId("");
      setAddLimitValue("");
      setCustomSubName("");
    },
  });

  const createSubCategoryMutation = useMutation({
    mutationFn: async ({
      category_id,
      name,
      monthly_limit,
    }: {
      category_id: string;
      name: string;
      monthly_limit?: number | null;
    }) => {
      return apiFetch("/sub-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id, name, monthly_limit, month_year: selectedMonth }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setSelectedSubId("");
      setAddLimitValue("");
      setCustomSubName("");
    },
  });

  const handleAddSubCategoryLimit = () => {
    if (!selectedCatId) return;
    const limitNum = addLimitValue.trim() === "" ? null : parseFloat(addLimitValue);

    if (selectedSubId && selectedSubId !== "NEW") {
      // Update existing subcategory limit
      updateSubCategoryMutation.mutate({ id: selectedSubId, monthly_limit: limitNum });
    } else if (customSubName.trim()) {
      // Create new subcategory with limit
      createSubCategoryMutation.mutate({
        category_id: selectedCatId,
        name: customSubName.trim(),
        monthly_limit: limitNum,
      });
    }
  };

  const handleSaveSubLimit = (subId: string) => {
    const limitNum = editLimitValue.trim() === "" ? null : parseFloat(editLimitValue);
    updateSubCategoryMutation.mutate({ id: subId, monthly_limit: limitNum });
  };

  const handleRemoveSubLimit = (subId: string) => {
    updateSubCategoryMutation.mutate({ id: subId, monthly_limit: null });
  };

  const displayedSubCategories = useMemo(() => {
    if (showAll) return allSubCategories;
    return allSubCategories.filter(
      (sub) => sub.monthly_limit !== null && sub.monthly_limit !== undefined,
    );
  }, [allSubCategories, showAll]);

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
            <h3 className="font-semibold">Error loading sub-categories</h3>
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
          <h1 className="text-2xl font-bold tracking-tight">Sub-Category Monthly Limits</h1>
          <p className="text-muted-foreground text-sm">
            Select a parent category and sub-category to set fine-grained monthly spending caps.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          onClick={() => setShowAll((prev) => !prev)}
        >
          <Filter className="h-3.5 w-3.5" />
          {showAll ? "Showing All Sub-Categories" : "Showing Only Configured Limits"}
        </Button>
      </div>

      {/* Sub-Category Spend vs. Monthly Limit Progress Visualization */}
      {subCategoryLimitData.length > 0 && (
        <Card className="p-5 space-y-4">
          <CardHeader className="p-0 pb-1 flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Sub-Category Budget Utilization
              </CardTitle>
              <CardDescription className="text-xs">
                Live tracking of actual spend vs. configured sub-category monthly limits.
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
                  data={sideBySideSubCategoryData}
                  barGap={0}
                  barCategoryGap="25%"
                  margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="name"
                    stroke="oklch(0.6 0.02 260)"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="oklch(0.6 0.02 260)"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(v) => `₹${v}`}
                  />
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
                  <Bar
                    dataKey="Remaining Budget"
                    fill="#FBBF24"
                    radius={[4, 4, 0, 0]}
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Sub-Category Monthly Limit Card */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Set Monthly Limit for Sub-Category
          </CardTitle>
          <CardDescription className="text-xs">
            Choose a parent category and target sub-category to assign a monthly limit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            {/* 1. Parent Category Select */}
            <div className="w-full sm:w-56">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Parent Category
              </label>
              <Select
                value={selectedCatId}
                onValueChange={(val) => {
                  setSelectedCatId(val);
                  setSelectedSubId("");
                  setCustomSubName("");
                }}
              >
                <SelectTrigger className="bg-background text-sm">
                  <SelectValue placeholder="Select Category..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Sub-Category Select */}
            <div className="w-full sm:w-56">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Sub-Category
              </label>
              <Select
                disabled={!selectedCatId}
                value={selectedSubId}
                onValueChange={(val) => {
                  setSelectedSubId(val);
                  if (val !== "NEW") {
                    const found = availableSubCatsForSelectedCat.find((s) => s.id === val);
                    if (found?.monthly_limit) {
                      setAddLimitValue(String(found.monthly_limit));
                    }
                  }
                }}
              >
                <SelectTrigger className="bg-background text-sm">
                  <SelectValue
                    placeholder={selectedCatId ? "Select Sub-Category..." : "Select Category First"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableSubCatsForSelectedCat.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.monthly_limit ? `(Limit: ${formatINR(s.monthly_limit)})` : ""}
                    </SelectItem>
                  ))}
                  <SelectItem value="NEW">+ Create New Sub-Category</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 2b. Custom Sub-Category Name (if NEW selected) */}
            {selectedSubId === "NEW" && (
              <div className="w-full sm:w-48">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  New Sub-Category Name
                </label>
                <Input
                  placeholder="e.g. Snacks, Groceries"
                  value={customSubName}
                  onChange={(e) => setCustomSubName(e.target.value)}
                  className="bg-background text-sm"
                />
              </div>
            )}

            {/* 3. Monthly Limit Input */}
            <div className="w-full sm:w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Monthly Limit (₹)
              </label>
              <Input
                type="number"
                placeholder="Limit (₹)"
                value={addLimitValue}
                onChange={(e) => setAddLimitValue(e.target.value)}
                className="bg-background text-sm"
                min={0}
              />
            </div>

            <div>
              <Button
                onClick={handleAddSubCategoryLimit}
                disabled={
                  !selectedCatId ||
                  !selectedSubId ||
                  (selectedSubId === "NEW" && !customSubName.trim()) ||
                  !addLimitValue.trim() ||
                  updateSubCategoryMutation.isPending ||
                  createSubCategoryMutation.isPending
                }
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" /> Save Limit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configured Sub-Category Limits List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Configured Sub-Category Limits ({displayedSubCategories.length})
        </h2>

        {displayedSubCategories.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <div className="text-muted-foreground text-sm">
              No sub-category limits configured yet. Select a sub-category above to set a monthly
              limit!
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {displayedSubCategories.map((sub) => {
              const isEditing = editingSubId === sub.id;

              return (
                <Card
                  key={sub.id}
                  className="p-4 flex items-center justify-between border-border/60 hover:shadow-sm transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{sub.name}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal text-muted-foreground"
                      >
                        {sub.category_name}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Monthly Limit:{" "}
                      <span className="font-semibold text-primary">
                        {sub.monthly_limit !== null && sub.monthly_limit !== undefined
                          ? formatINR(sub.monthly_limit)
                          : "No Limit"}
                      </span>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        placeholder="Limit (₹)"
                        value={editLimitValue}
                        onChange={(e) => setEditLimitValue(e.target.value)}
                        className="w-24 h-7 text-xs bg-background"
                        min={0}
                      />
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleSaveSubLimit(sub.id)}
                        disabled={updateSubCategoryMutation.isPending}
                      >
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-1.5 text-xs"
                        onClick={() => setEditingSubId(null)}
                      >
                        ✕
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingSubId(sub.id);
                          setEditLimitValue(
                            sub.monthly_limit !== null && sub.monthly_limit !== undefined
                              ? String(sub.monthly_limit)
                              : "",
                          );
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </Button>

                      {sub.monthly_limit !== null && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveSubLimit(sub.id)}
                          title="Remove subcategory limit"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
