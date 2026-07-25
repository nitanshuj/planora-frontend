import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, Calendar, ListFilter, CheckCircle2 } from "lucide-react";
import { formatINR, formatDateHelper } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/export")({
  component: ExportExpensePage,
});

type Expense = {
  id: string;
  expense_date: string;
  total_paid: number;
  item_name: string;
  category: string;
  sub_category?: string | null;
  service?: string | null;
  brand?: string | null;
  location?: string | null;
  payment_method?: string | null;
  remarks?: string | null;
};

const REQUIRED_COLUMNS = [
  "Date",
  "Item Name",
  "Service",
  "Category",
  "Sub-Category",
  "Brand",
  "Location",
  "Method of Payment",
  "Total Paid (INR)",
  "Remarks",
];

function ExportExpensePage() {
  const currentMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery<Expense[]>({
    queryKey: ["expenses"],
    queryFn: () => apiFetch("/expenses"),
  });

  // Extract available months from expense dates
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add(currentMonthKey);
    rows.forEach((r) => {
      if (r.expense_date) {
        const monthKey = r.expense_date.substring(0, 7);
        if (/^\d{4}-\d{2}$/.test(monthKey)) {
          monthsSet.add(monthKey);
        }
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [rows, currentMonthKey]);

  // Extract available categories
  const categoriesList = useMemo(() => {
    const catSet = new Set<string>();
    rows.forEach((r) => {
      if (r.category) catSet.add(r.category);
    });
    return Array.from(catSet).sort();
  }, [rows]);

  // Filtered expenses based on month and category
  const filteredExpenses = useMemo(() => {
    return rows.filter((item) => {
      const matchMonth =
        selectedMonth === "all" ||
        (item.expense_date && item.expense_date.startsWith(selectedMonth));
      const matchCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchMonth && matchCategory;
    });
  }, [rows, selectedMonth, categoryFilter]);

  const monthTotalAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + (Number(item.total_paid) || 0), 0);
  }, [filteredExpenses]);

  const formatMonthLabel = (mKey: string) => {
    if (mKey === "all") return "All Months";
    const [year, month] = mKey.split("-");
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const handleDownloadExcel = () => {
    if (filteredExpenses.length === 0) {
      toast.error("No expenses found for the selected month/filters to export.");
      return;
    }

    try {
      // Map data with exact requested columns
      const exportData = filteredExpenses.map((expense) => ({
        Date: expense.expense_date || "",
        "Item Name": expense.item_name || "",
        Service: expense.service || "",
        Category: expense.category || "",
        "Sub-Category": expense.sub_category || "",
        Brand: expense.brand || "",
        Location: expense.location || "",
        "Method of Payment": expense.payment_method || "",
        "Total Paid (INR)": Number(expense.total_paid) || 0,
        Remarks: expense.remarks || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto width calculation for clean formatting
      const columnWidths = REQUIRED_COLUMNS.map((colHeader) => {
        let maxLen = colHeader.length;
        exportData.forEach((row) => {
          const val = String((row as any)[colHeader] || "");
          if (val.length > maxLen) maxLen = val.length;
        });
        return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
      });

      worksheet["!cols"] = columnWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Expense Data");

      const fileMonth = selectedMonth === "all" ? "All_Months" : selectedMonth;
      const fileName = `Planora_Expenses_${fileMonth}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      toast.success(`Successfully downloaded ${fileName} (${filteredExpenses.length} records)`);
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to generate Excel file. Please try again.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Title Block */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span>Data Export Module</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Export Expense Data
        </h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Select a month to filter your transactions, then download your data directly in standard
          Excel (.xlsx) format.
        </p>
      </div>

      {/* Integrated Control & Download Toolbar Card */}
      <div className="p-5 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-4">
          {/* Filters & Actions Flow */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 flex-1">
            {/* Month Selector */}
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Select Month
              </label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full h-10 font-medium">
                  <SelectValue placeholder="Choose month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months (Complete Export)</SelectItem>
                  {availableMonths.map((mKey) => (
                    <SelectItem key={mKey} value={mKey}>
                      {formatMonthLabel(mKey)} ({mKey})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-1.5 flex-1 min-w-[180px]">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ListFilter className="h-3.5 w-3.5 text-primary" /> Filter Category
              </label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full h-10 font-medium">
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categoriesList.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Download Excel Button placed right inline after selecting month/category */}
            <Button
              size="default"
              onClick={handleDownloadExcel}
              disabled={isLoading || filteredExpenses.length === 0}
              className="h-10 px-5 gap-2 font-semibold shadow-xs shrink-0 self-end"
            >
              <Download className="h-4 w-4" />
              Download Excel (.xlsx)
            </Button>
          </div>
        </div>

        {/* Integrated Summary Footer Bar */}
        <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              Total Spent:{" "}
              <strong className="text-foreground text-sm font-semibold">
                {formatINR(monthTotalAmount)}
              </strong>
            </span>
            <span>•</span>
            <span>
              Records:{" "}
              <strong className="text-foreground text-sm font-semibold">
                {filteredExpenses.length}
              </strong>
            </span>
          </div>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
            Ready for export
          </span>
        </div>
      </div>

      {/* Included Columns Specification Indicator */}
      <div className="p-4 rounded-xl border border-border/80 bg-muted/30">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Export Excel Schema Columns (10
          Columns)
        </h3>
        <div className="flex flex-wrap gap-2">
          {REQUIRED_COLUMNS.map((col) => (
            <span
              key={col}
              className="px-2.5 py-1 rounded-md bg-background border border-border/70 text-xs font-medium text-foreground shadow-2xs"
            >
              {col}
            </span>
          ))}
        </div>
      </div>

      {/* Data Table Preview */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div>
            <h2 className="text-base font-semibold text-foreground">Preview Data Table</h2>
            <p className="text-xs text-muted-foreground">
              Showing preview of data matching selected filters ({filteredExpenses.length} items)
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Loading expense data...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            No expense records found for the selected month or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Sub-Category</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Method of Payment</th>
                  <th className="py-3 px-4 text-right">Total Paid (INR)</th>
                  <th className="py-3 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground whitespace-nowrap">
                      {formatDateHelper(expense.expense_date)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">{expense.item_name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{expense.service || "—"}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        {expense.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {expense.sub_category || "—"}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{expense.brand || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{expense.location || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {expense.payment_method || "—"}
                    </td>
                    <td className="py-3 px-4 font-semibold text-right text-foreground whitespace-nowrap">
                      {formatINR(Number(expense.total_paid) || 0)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground max-w-[200px] truncate">
                      {expense.remarks || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
