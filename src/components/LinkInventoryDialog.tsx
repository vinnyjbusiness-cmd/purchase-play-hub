import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";

interface Props {
  orderId: string;
  eventId: string;
  existingInventoryIds: string[];
  onClose: () => void;
  onLinked: () => void;
}

interface AvailableTicket {
  id: string;
  category: string;
  section: string | null;
  row_name: string | null;
  seat: string | null;
  purchase_id: string | null;
  face_value: number | null;
  first_name: string | null;
  last_name: string | null;
  supplier_name: string;
  supplier_order_id: string | null;
  unit_cost: number;
  currency: string;
}

interface TicketGroup {
  key: string;
  supplierName: string;
  category: string;
  section: string | null;
  unit_cost: number;
  currency: string;
  tickets: AvailableTicket[];
}

export default function LinkInventoryDialog({ orderId, eventId, existingInventoryIds, onClose, onLinked }: Props) {
  const [tickets, setTickets] = useState<AvailableTicket[]>([]);
  const [selectedCounts, setSelectedCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: inventory } = await supabase
        .from("inventory")
        .select("id, category, section, row_name, seat, purchase_id, status, face_value, first_name, last_name")
        .eq("event_id", eventId)
        .in("status", ["available", "reserved"]);

      if (!inventory || inventory.length === 0) {
        setTickets([]);
        return;
      }

      const filtered = inventory.filter((i) => !existingInventoryIds.includes(i.id));
      
      const purchaseIds = [...new Set(filtered.map((i) => i.purchase_id).filter(Boolean))] as string[];

      let purchaseMap = new Map();
      if (purchaseIds.length > 0) {
        const { data: purchases } = await supabase
          .from("purchases")
          .select("id, unit_cost, currency, supplier_order_id, suppliers(name)")
          .in("id", purchaseIds);
        purchaseMap = new Map((purchases || []).map((p) => [p.id, p]));
      }

      setTickets(
        filtered
          .map((inv) => {
            const p = inv.purchase_id ? purchaseMap.get(inv.purchase_id) as any : null;
            const unitCost = Number(p?.unit_cost || 0);
            const faceValue = Number(inv.face_value || 0);
            const effectiveCost = unitCost > 0 ? unitCost : faceValue;
            if (effectiveCost <= 0) return null;
            return {
              id: inv.id,
              category: inv.category,
              section: inv.section,
              row_name: inv.row_name,
              seat: inv.seat,
              purchase_id: inv.purchase_id,
              face_value: inv.face_value,
              first_name: inv.first_name,
              last_name: inv.last_name,
              supplier_name: p?.suppliers?.name || "Inventory",
              supplier_order_id: p?.supplier_order_id || null,
              unit_cost: effectiveCost,
              currency: p?.currency || "GBP",
            };
          })
          .filter(Boolean) as AvailableTicket[]
      );
    }
    load();
  }, [eventId, existingInventoryIds]);

  const groups = useMemo((): TicketGroup[] => {
    if (tickets.length === 0) return [];

    const map = new Map<string, TicketGroup>();
    tickets.forEach(t => {
      const key = `${t.supplier_name}|${t.category}|${t.section || ""}|${t.unit_cost}|${t.currency}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          supplierName: t.supplier_name,
          category: t.category,
          section: t.section,
          unit_cost: t.unit_cost,
          currency: t.currency,
          tickets: [],
        });
      }
      map.get(key)!.tickets.push(t);
    });

    return Array.from(map.values()).sort((a, b) => b.tickets.length - a.tickets.length);
  }, [tickets]);

  const adjustCount = (groupKey: string, delta: number, max: number) => {
    setSelectedCounts(prev => {
      const current = prev[groupKey] || 0;
      const next = Math.max(0, Math.min(max, current + delta));
      if (next === 0) {
        const { [groupKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [groupKey]: next };
    });
  };

  const selectAll = (groupKey: string, max: number) => {
    setSelectedCounts(prev => {
      const current = prev[groupKey] || 0;
      if (current === max) {
        const { [groupKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [groupKey]: max };
    });
  };

  const selectedIds = useMemo(() => {
    const ids: string[] = [];
    groups.forEach(g => {
      const count = selectedCounts[g.key] || 0;
      for (let i = 0; i < count && i < g.tickets.length; i++) {
        ids.push(g.tickets[i].id);
      }
    });
    return ids;
  }, [groups, selectedCounts]);

  const handleLink = async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      const lines = selectedIds.map((inventoryId) => ({
        order_id: orderId,
        inventory_id: inventoryId,
      }));
      const { error: lineError } = await supabase.from("order_lines").insert(lines);
      if (lineError) throw lineError;

      const { error: invError } = await supabase
        .from("inventory")
        .update({ status: "sold" as any })
        .in("id", selectedIds);
      if (invError) throw invError;

      toast.success(`${selectedIds.length} ticket${selectedIds.length !== 1 ? "s" : ""} linked`);
      onLinked();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sym = (c: string) => (c === "GBP" ? "£" : c === "USD" ? "$" : "€");
  const totalCost = selectedIds.reduce((s, id) => {
    const t = tickets.find((t) => t.id === id);
    return s + (t?.unit_cost || 0);
  }, 0);

  /** Build seat summary string from tickets in a group */
  const seatSummary = (groupTickets: AvailableTicket[]) => {
    const parts: string[] = [];
    const rows = [...new Set(groupTickets.map(t => t.row_name).filter(Boolean))];
    if (rows.length > 0) parts.push(`Row ${rows.join(", ")}`);
    const seats = groupTickets.map(t => t.seat).filter(Boolean);
    if (seats.length > 0 && seats.length <= 6) parts.push(`Seats ${seats.join(", ")}`);
    else if (seats.length > 6) parts.push(`${seats.length} seats`);
    return parts.length > 0 ? parts.join(" · ") : null;
  };

  /** Get lead booker name from first ticket that has one */
  const leadBooker = (groupTickets: AvailableTicket[]) => {
    const t = groupTickets.find(t => t.first_name || t.last_name);
    if (!t) return null;
    return [t.first_name, t.last_name].filter(Boolean).join(" ");
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Tickets to Order</DialogTitle>
        </DialogHeader>

        {tickets.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <p>No available tickets for this event</p>
            <p className="text-xs mt-1">Add a purchase first to create inventory</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              Select how many tickets to link from each source.
            </p>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {groups.map((group) => {
                const count = selectedCounts[group.key] || 0;
                const max = group.tickets.length;
                const booker = leadBooker(group.tickets);
                const seats = seatSummary(group.tickets);
                return (
                  <div
                    key={group.key}
                    className={`p-3 rounded-lg border transition-colors ${
                      count > 0 ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{group.supplierName}</span>
                          <Badge variant="secondary" className="text-xs">
                            {max} ticket{max !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {group.section || "—"}
                          {` · ${sym(group.currency)}${group.unit_cost.toFixed(2)}/ea`}
                        </p>
                        {seats && (
                          <p className="text-xs text-muted-foreground">{seats}</p>
                        )}
                        {booker && (
                          <p className="text-xs mt-0.5">
                            <span className="text-muted-foreground">Lead Booker:</span>{" "}
                            <span className="font-medium text-foreground">{booker}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          disabled={count <= 0}
                          onClick={() => adjustCount(group.key, -1, max)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <button
                          className="w-8 text-center text-sm font-bold tabular-nums"
                          onClick={() => selectAll(group.key, max)}
                          title="Toggle all"
                        >
                          {count}
                        </button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          disabled={count >= max}
                          onClick={() => adjustCount(group.key, 1, max)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedIds.length > 0 && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span>{selectedIds.length} ticket{selectedIds.length !== 1 ? "s" : ""} selected</span>
                  <span className="font-semibold">Total cost: £{totalCost.toFixed(2)}</span>
                </div>
              </div>
            )}

            <Button onClick={handleLink} disabled={selectedIds.length === 0 || loading} className="w-full">
              {loading ? "Linking..." : `Link ${selectedIds.length} Ticket${selectedIds.length !== 1 ? "s" : ""}`}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
