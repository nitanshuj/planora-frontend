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
import { LayoutDashboard, Receipt, Table2, Tags, Sparkles, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function CommandPalette({
  open,
  onOpenChange,
  onAskAi,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAskAi: () => void;
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
          <CommandItem onSelect={() => go("/categories")}>
            <Tags className="mr-2 h-4 w-4" /> Categories
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={onAskAi}>
            <Sparkles className="mr-2 h-4 w-4" /> Ask the AI Agent
          </CommandItem>
          <CommandItem
            onSelect={async () => {
              onOpenChange(false);
              await supabase.auth.signOut();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
