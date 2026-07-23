import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { LayoutDashboard, Receipt, Table2, LogOut } from "lucide-react";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search views, ask the AI, or type a command…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/transactions")}>
            <Table2 className="mr-2 h-4 w-4" /> Transactions
          </CommandItem>
          <CommandItem onSelect={() => go("/receipts")}>
            <Receipt className="mr-2 h-4 w-4" /> Receipts
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={async () => {
              onOpenChange(false);
              const token = localStorage.getItem("auth_token");
              if (token) {
                await fetch("http://localhost:8000/api/v1/auth/logout", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}` },
                }).catch(() => {});
                localStorage.removeItem("auth_token");
              }
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
