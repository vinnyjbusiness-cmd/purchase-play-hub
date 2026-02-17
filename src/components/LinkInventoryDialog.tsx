import { useEffect, useState } from "react";
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
  purchase_id: string;
  supplier_name: string;
  supplier_order_id: string | null;
  unit_cost: number;
  currency: string;
}

export default function LinkInventoryDialog({ orderId, eventId, existingInventoryIds, onClose, onLinked }: Props) {
  const [tickets, setTickets] = useState<AvailableTicket[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      // Get available inventory for this event that isn't already linked to this order
      const { data: inventory } = await supabase
        .from("inventory")
        .select("id, category, section, row_name, seat, purchase_id, status")
        .eq("event_id", eventId)
        .in("status", ["available", "reserved"]);

      if (!inventory || inventory.length === 0) {
        setTickets([]);
        return;
      }

      const filtered = inventory.filter((i) => !existingInventoryIds.includes(i.id));
      const purchaseIds = [...new Set(filtered.map((i) => i.purchase_id))];

      const { data: purchases } = await supabase
        .from("purchases")
        .select("id, unit_cost, currency, supplier_order_id, suppliers(name)")
        .in("id", purchaseIds);

      const purchaseMap = new Map((purchases || []).map((p) => [p.id, p]));

      setTickets(
        filtered.map((inv) => {
          const p = purchaseMap.get(inv.purchase_id) as any;
          return {
            id: inv.id,
            category: inv.category,
            section: inv.section,
            row_name: inv.row_name,
            seat: inv.seat,
            purchase_id: inv.purchase_id,
            supplier_name: p?.suppliers?.name || "Unknown",
            supplier_order_id: p?.supplier_order_id || null,
            unit_cost: Number(p?.unit_cost || 0),
            currency: p?.currency || "GBP",
          };
        })
      );
    }
    load();
  }, [eventId, existingInventoryIds]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLink = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      // Create order_lines
      const lines = [...selected].map((inventoryId) => ({
        order_id: orderId,
        inventory_id: inventoryId,
      }));
      const { error: lineError } = await supabase.from("order_lines").insert(lines);
      if (lineError) throw lineError;

      // Update inventory status to sold
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
              Select tickets from your inventory to link to this order. This tracks which supplier purchase fulfilled the sale.
            </p>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {tickets.map((t) => (
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
                      {t.category}
                      {t.section && ` · ${t.section}`}
                      {t.row_name && ` · Row ${t.row_name}`}
                      {t.seat && ` · Seat ${t.seat}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    {sym(t.currency)}{t.unit_cost.toFixed(2)}
                  </span>
                </label>
              ))}
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
