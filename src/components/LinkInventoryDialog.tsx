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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

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
  supplier_name: string;
  supplier_order_id: string | null;
  unit_cost: number;
  currency: string;
}

interface SeatGroup {
  key: string;
  label: string;
  tickets: AvailableTicket[];
}

export default function LinkInventoryDialog({ orderId, eventId, existingInventoryIds, onClose, onLinked }: Props) {
  const [tickets, setTickets] = useState<AvailableTicket[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: inventory } = await supabase
        .from("inventory")
        .select("id, category, section, row_name, seat, purchase_id, status, face_value")
        .eq("event_id", eventId)
        .in("status", ["available", "reserved"]);

      if (!inventory || inventory.length === 0) {
        setTickets([]);
        return;
      }

      const filtered = inventory.filter((i) => !existingInventoryIds.includes(i.id));
      
      // Only look up purchases for items that have a purchase_id
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
        filtered.map((inv) => {
          const p = inv.purchase_id ? purchaseMap.get(inv.purchase_id) as any : null;
          const unitCost = Number(p?.unit_cost || 0);
          const faceValue = Number(inv.face_value || 0);
          return {
            id: inv.id,
            category: inv.category,
            section: inv.section,
            row_name: inv.row_name,
            seat: inv.seat,
            purchase_id: inv.purchase_id,
            face_value: inv.face_value,
            supplier_name: p?.suppliers?.name || (inv.purchase_id ? "Unknown" : "Manual Entry"),
            supplier_order_id: p?.supplier_order_id || null,
            unit_cost: unitCost > 0 ? unitCost : faceValue,
            currency: p?.currency || "GBP",
          };
        })
      );
    }
    load();
  }, [eventId, existingInventoryIds]);

  // Group adjacent seats
  const groups = useMemo((): SeatGroup[] => {
    if (tickets.length === 0) return [];

    const sorted = [...tickets].sort((a, b) => {
      const secCmp = (a.section || "").localeCompare(b.section || "");
      if (secCmp !== 0) return secCmp;
      const rowCmp = (a.row_name || "").localeCompare(b.row_name || "");
      if (rowCmp !== 0) return rowCmp;
      return (parseInt(a.seat || "0") || 0) - (parseInt(b.seat || "0") || 0);
    });

    const result: SeatGroup[] = [];
    let current: AvailableTicket[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const sameSec = (prev.section || "") === (curr.section || "");
      const sameRow = (prev.row_name || "") === (curr.row_name || "");
      const prevSeat = parseInt(prev.seat || "0") || 0;
      const currSeat = parseInt(curr.seat || "0") || 0;
      const consecutive = prevSeat > 0 && currSeat > 0 && currSeat === prevSeat + 1;

      if (sameSec && sameRow && consecutive) {
        current.push(curr);
      } else {
        result.push(buildGroup(current));
        current = [curr];
      }
    }
    result.push(buildGroup(current));
    return result;
  }, [tickets]);

  function buildGroup(items: AvailableTicket[]): SeatGroup {
    if (items.length === 1) {
      const t = items[0];
      return {
        key: t.id,
        label: "",
        tickets: items,
      };
    }
    const first = items[0];
    const last = items[items.length - 1];
    const sizeLabel = items.length === 2 ? "Pair" : `Group of ${items.length}`;
    const label = `${sizeLabel} — Row ${first.row_name || "?"}, Seats ${first.seat}–${last.seat}`;
    return {
      key: items.map(t => t.id).join(","),
      label,
      tickets: items,
    };
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (group: SeatGroup) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = group.tickets.every(t => next.has(t.id));
      if (allSelected) {
        group.tickets.forEach(t => next.delete(t.id));
      } else {
        group.tickets.forEach(t => next.add(t.id));
      }
      return next;
    });
  };

  const handleLink = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const lines = [...selected].map((inventoryId) => ({
        order_id: orderId,
        inventory_id: inventoryId,
      }));
      const { error: lineError } = await supabase.from("order_lines").insert(lines);
      if (lineError) throw lineError;

      const { error: invError } = await supabase
        .from("inventory")
        .update({ status: "sold" as any })
        .in("id", [...selected]);
      if (invError) throw invError;

      toast.success(`${selected.size} ticket${selected.size !== 1 ? "s" : ""} linked`);
      onLinked();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sym = (c: string) => (c === "GBP" ? "£" : c === "USD" ? "$" : "€");
  const totalCost = [...selected].reduce((s, id) => {
    const t = tickets.find((t) => t.id === id);
    return s + (t?.unit_cost || 0);
  }, 0);

  const renderTicket = (t: AvailableTicket) => (
    <label
      key={t.id}
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        selected.has(t.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
      }`}
    >
      <Checkbox
        checked={selected.has(t.id)}
        onCheckedChange={() => toggle(t.id)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{t.supplier_name}</span>
          {t.supplier_order_id && (
            <Badge variant="secondary" className="text-xs">{t.supplier_order_id}</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {t.section && `${t.section}`}
          {t.row_name && ` · Row ${t.row_name}`}
          {t.seat && ` · Seat ${t.seat}`}
        </p>
      </div>
      <span className="text-sm font-semibold">
        {sym(t.currency)}{t.unit_cost.toFixed(2)}
      </span>
    </label>
  );

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
              Select tickets from your inventory to link to this order.
            </p>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {groups.map((group) => {
                if (group.tickets.length === 1) {
                  return renderTicket(group.tickets[0]);
                }
                const allSelected = group.tickets.every(t => selected.has(t.id));
                return (
                  <div key={group.key} className="rounded-lg border-2 border-dashed border-primary/30 p-2 space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-semibold text-primary">{group.label}</span>
                      <Button
                        size="sm"
                        variant={allSelected ? "default" : "outline"}
                        className="h-6 text-xs px-2"
                        onClick={() => toggleGroup(group)}
                      >
                        {allSelected ? "Deselect" : "Select"} {group.tickets.length === 2 ? "Pair" : `All ${group.tickets.length}`}
                      </Button>
                    </div>
                    {group.tickets.map(renderTicket)}
                  </div>
                );
              })}
            </div>

            {selected.size > 0 && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span>{selected.size} ticket{selected.size !== 1 ? "s" : ""} selected</span>
                  <span className="font-semibold">Total cost: £{totalCost.toFixed(2)}</span>
                </div>
              </div>
            )}

            <Button onClick={handleLink} disabled={selected.size === 0 || loading} className="w-full">
              {loading ? "Linking..." : `Link ${selected.size} Ticket${selected.size !== 1 ? "s" : ""}`}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
