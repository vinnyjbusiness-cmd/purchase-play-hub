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
import { Check } from "lucide-react";

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
  section: string | null;
  currency: string;
  leadBooker: string | null;
  tickets: AvailableTicket[];
}

export default function LinkInventoryDialog({ orderId, eventId, existingInventoryIds, onClose, onLinked }: Props) {
  const [tickets, setTickets] = useState<AvailableTicket[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
      // Group by purchase_id if available, otherwise by supplier+section (all loose inventory together)
      const key = t.purchase_id
        ? `purchase:${t.purchase_id}`
        : `inv:${t.supplier_name}|${t.section || ""}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          supplierName: t.supplier_name,
          section: t.section,
          currency: t.currency,
          leadBooker: null,
          tickets: [],
        });
      }
      map.get(key)!.tickets.push(t);
    });

    // Set lead booker from first ticket with a name, sort tickets
    for (const g of map.values()) {
      const bt = g.tickets.find(t => t.first_name || t.last_name);
      if (bt) g.leadBooker = [bt.first_name, bt.last_name].filter(Boolean).join(" ");

      g.tickets.sort((a, b) => {
        const rowCmp = (a.row_name || "").localeCompare(b.row_name || "");
        if (rowCmp !== 0) return rowCmp;
        const sA = parseInt(a.seat || "0") || 0;
        const sB = parseInt(b.seat || "0") || 0;
        return sA - sB;
      });
    }

    return Array.from(map.values()).sort((a, b) => b.tickets.length - a.tickets.length);
  }, [tickets]);

  const toggleTicket = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (group: TicketGroup) => {
    setSelectedIds(prev => {
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

  const selectedArray = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const handleLink = async () => {
    if (selectedArray.length === 0) return;
    setLoading(true);
    try {
      const lines = selectedArray.map((inventoryId) => ({
        order_id: orderId,
        inventory_id: inventoryId,
      }));
      const { error: lineError } = await supabase.from("order_lines").insert(lines);
      if (lineError) throw lineError;

      const { error: invError } = await supabase
        .from("inventory")
        .update({ status: "sold" as any })
        .in("id", selectedArray);
      if (invError) throw invError;

      toast.success(`${selectedArray.length} ticket${selectedArray.length !== 1 ? "s" : ""} linked`);
      onLinked();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sym = (c: string) => (c === "GBP" ? "£" : c === "USD" ? "$" : "€");
  const totalCost = selectedArray.reduce((s, id) => {
    const t = tickets.find((t) => t.id === id);
    return s + (t?.unit_cost || 0);
  }, 0);

  /** Display label for a ticket chip */
  const chipLabel = (t: AvailableTicket) => {
    const parts: string[] = [];
    if (t.row_name) parts.push(`R${t.row_name}`);
    if (t.seat) parts.push(`S${t.seat}`);
    if (parts.length === 0) return "Ticket";
    return parts.join(" ");
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
              Tap individual seats to select, or tap the header to select all.
            </p>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {groups.map((group) => {
                const groupSelectedCount = group.tickets.filter(t => selectedIds.has(t.id)).length;
                const allSelected = groupSelectedCount === group.tickets.length;

                return (
                  <div
                    key={group.key}
                    className={`rounded-lg border transition-colors ${
                      groupSelectedCount > 0 ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    {/* Group header - click to select all */}
                    <button
                      className="w-full p-3 text-left"
                      onClick={() => toggleGroup(group)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{group.supplierName}</span>
                            <Badge variant="secondary" className="text-xs">
                              {group.tickets.length} ticket{group.tickets.length !== 1 ? "s" : ""}
                            </Badge>
                            {groupSelectedCount > 0 && (
                              <Badge variant="default" className="text-[10px] py-0">
                                {groupSelectedCount} selected
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {group.section || "—"}
                          </p>
                          {group.leadBooker && (
                            <p className="text-xs mt-0.5">
                              <span className="text-muted-foreground">Lead Booker:</span>{" "}
                              <span className="font-medium text-foreground">{group.leadBooker}</span>
                            </p>
                          )}
                        </div>
                        <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          allSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                        }`}>
                          {allSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </div>
                    </button>

                    {/* Individual seat chips */}
                    <div className="px-3 pb-3 flex flex-wrap gap-2">
                      {group.tickets.map(t => {
                        const isSelected = selectedIds.has(t.id);
                        const name = [t.first_name, t.last_name].filter(Boolean).join(" ").trim();
                        const hasSeatInfo = t.seat || t.row_name;
                        return (
                          <button
                            key={t.id}
                            onClick={() => toggleTicket(t.id)}
                            title={name || undefined}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs border transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-muted/30 text-foreground border-border hover:border-primary/50 hover:bg-muted/60"
                            }`}
                          >
                            {hasSeatInfo ? (
                              <>
                                {t.seat && (
                                  <span className="font-bold text-sm tabular-nums">{t.seat}</span>
                                )}
                                {t.row_name && (
                                  <span className={`text-[11px] ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                    Row {t.row_name}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[11px]">{name || "Ticket"}</span>
                            )}
                            {name && hasSeatInfo && (
                              <span className={`text-[10px] ${isSelected ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                · {name}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedArray.length > 0 && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between">
                  <span>{selectedArray.length} ticket{selectedArray.length !== 1 ? "s" : ""} selected</span>
                  <span className="font-semibold">Total cost: £{totalCost.toFixed(2)}</span>
                </div>
              </div>
            )}

            <Button onClick={handleLink} disabled={selectedArray.length === 0 || loading} className="w-full">
              {loading ? "Linking..." : `Link ${selectedArray.length} Ticket${selectedArray.length !== 1 ? "s" : ""}`}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
