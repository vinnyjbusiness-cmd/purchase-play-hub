import { useEffect, useState, useCallback } from "react";
import { formatEventTitle } from "@/lib/eventDisplay";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, ShoppingCart, Users, CalendarDays, Scale } from "lucide-react";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  category: "Contacts" | "Orders" | "Events" | "Balances";
  path: string;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Cmd+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    const term = `%${q}%`;

    const [contactsRes, ordersRes, eventsRes, balancesRes] = await Promise.all([
      supabase.from("suppliers").select("id, name, display_id, contact_name").ilike("name", term).limit(5),
      supabase.from("orders").select("id, order_ref, buyer_name, sale_price, events(home_team, away_team)").or(`order_ref.ilike.${term},buyer_name.ilike.${term}`).limit(5),
      supabase.from("events").select("id, home_team, away_team, event_date, match_code").or(`home_team.ilike.${term},away_team.ilike.${term},match_code.ilike.${term}`).limit(5),
      supabase.from("balance_payments").select("id, party_id, contact_name, amount, type").ilike("contact_name", term).limit(5),
    ]);

    const items: SearchResult[] = [];

    (contactsRes.data || []).forEach(c => {
      items.push({
        id: c.id,
        label: c.name,
        sublabel: c.display_id || c.contact_name || undefined,
        category: "Contacts",
        path: "/suppliers",
      });
    });

    (ordersRes.data || []).forEach(o => {
      const evt = o.events as any;
      items.push({
        id: o.id,
        label: o.order_ref || o.id.slice(0, 8),
        sublabel: o.buyer_name || (evt ? `${evt.home_team} vs ${evt.away_team}` : undefined),
        category: "Orders",
        path: "/orders",
      });
    });

    (eventsRes.data || []).forEach(e => {
      items.push({
        id: e.id,
        label: formatEventTitle(e.home_team, e.away_team, e.match_code),
        sublabel: e.event_date ? new Date(e.event_date).toLocaleDateString("en-GB") : undefined,
        category: "Events",
        path: `/events/${e.id}`,
      });
    });

    (balancesRes.data || []).forEach(b => {
      items.push({
        id: b.id,
        label: b.contact_name || "Unknown",
        sublabel: `£${Number(b.amount).toFixed(2)} (${b.type})`,
        category: "Balances",
        path: "/balance",
      });
    });

    setResults(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 300);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    navigate(result.path);
  };

  const categoryIcon = {
    Contacts: Users,
    Orders: ShoppingCart,
    Events: CalendarDays,
    Balances: Scale,
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full max-w-sm"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search contacts, orders, events, balances..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? "Searching..." : query.length < 2 ? "Type at least 2 characters..." : "No results found."}
          </CommandEmpty>
          {Object.entries(grouped).map(([category, items]) => {
            const Icon = categoryIcon[category as keyof typeof categoryIcon];
            return (
              <CommandGroup key={category} heading={category}>
                {items.map(item => (
                  <CommandItem
                    key={item.id}
                    value={`${item.label} ${item.sublabel || ""}`}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">{item.label}</span>
                      {item.sublabel && (
                        <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
