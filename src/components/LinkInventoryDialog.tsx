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
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
  block: string | null;
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
  block: string | null;
  currency: string;
  leadBooker: string | null;
  tickets: AvailableTicket[];
}

const GRADIENT_PALETTE = [
  "from-violet-600/90 to-indigo-700/90",
  "from-emerald-600/90 to-teal-700/90",
  "from-rose-600/90 to-pink-700/90",
  "from-amber-600/90 to-orange-700/90",
  "from-sky-600/90 to-cyan-700/90",
  "from-fuchsia-600/90 to-purple-700/90",
];

export default function LinkInventoryDialog({ orderId, eventId, existingInventoryIds, onClose, onLinked }: Props) {
  const [tickets, setTickets] = useState<AvailableTicket[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const { data: inventory } = await supabase
        .from("inventory")
        .select("id, category, section, block, row_name, seat, purchase_id, status, face_value, first_name, last_name")
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
              block: (inv as any).block || null,
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

  // Group tickets: first by section, then by purchase/row within each section
  const sectionGroups = useMemo(() => {
    if (tickets.length === 0) return [];

    // Build ticket groups (by purchase or row)
    const groupMap = new Map<string, TicketGroup>();
    tickets.forEach(t => {
      let key: string;
      if (t.purchase_id) {
        key = `purchase:${t.purchase_id}`;
      } else {
        const sig = [t.section || t.category || "", t.row_name || ""].join("|");
        key = `inv:${t.supplier_name}|${sig}`;
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          supplierName: t.supplier_name,
          section: t.section,
          block: t.block,
          currency: t.currency,
          leadBooker: null,
          tickets: [],
        });
      }
      groupMap.get(key)!.tickets.push(t);
    });

    // Finalize groups
    for (const g of groupMap.values()) {
      const bt = g.tickets.find(t => t.first_name || t.last_name);
      if (bt) g.leadBooker = [bt.first_name, bt.last_name].filter(Boolean).join(" ");
      g.tickets.sort((a, b) => (parseInt(a.seat || "0") || 0) - (parseInt(b.seat || "0") || 0));
    }

    // Group by section name
    const sectionMap = new Map<string, TicketGroup[]>();
    for (const g of groupMap.values()) {
      const sec = g.section || g.tickets[0]?.category || "Other";
      if (!sectionMap.has(sec)) sectionMap.set(sec, []);
      sectionMap.get(sec)!.push(g);
    }

    // Sort groups within each section by size desc
    const result = Array.from(sectionMap.entries()).map(([name, groups]) => ({
      name,
      groups: groups.sort((a, b) => b.tickets.length - a.tickets.length),
      totalTickets: groups.reduce((s, g) => s + g.tickets.length, 0),
    }));

    return result.sort((a, b) => b.totalTickets - a.totalTickets);
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

  const toggleSection = (sectionName: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      next.has(sectionName) ? next.delete(sectionName) : next.add(sectionName);
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

  const totalCost = selectedArray.reduce((s, id) => {
    const t = tickets.find((t) => t.id === id);
    return s + (t?.unit_cost || 0);
  }, 0);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>Link Tickets to Order</DialogTitle>
        </DialogHeader>

        {tickets.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground px-5">
            <p>No available tickets for this event</p>
            <p className="text-xs mt-1">Add a purchase first to create inventory</p>
          </div>
        ) : (
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground px-5 mb-3">
              Tap individual seats or tap the card header to select all.
            </p>

            <div className="space-y-4 max-h-[55vh] overflow-y-auto px-5 pb-3">
              {sectionGroups.map((section) => {
                const isSectionCollapsed = collapsedSections.has(section.name);
                const sectionSelectedCount = section.groups.reduce(
                  (s, g) => s + g.tickets.filter(t => selectedIds.has(t.id)).length, 0
                );

                return (
                  <div key={section.name}>
                    {/* Section header */}
                    <button
                      onClick={() => toggleSection(section.name)}
                      className="w-full flex items-center gap-2 mb-2"
                    >
                      {isSectionCollapsed
                        ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      }
                      <h3 className="text-xs font-black uppercase tracking-wide text-foreground">{section.name}</h3>
                      <Badge variant="outline" className="text-[9px] font-bold">
                        {section.totalTickets} ticket{section.totalTickets !== 1 ? "s" : ""}
                      </Badge>
                      {sectionSelectedCount > 0 && (
                        <Badge className="text-[9px] bg-primary text-primary-foreground">
                          {sectionSelectedCount} selected
                        </Badge>
                      )}
                    </button>

                    {/* Groups within section */}
                    {!isSectionCollapsed && (
                      <div className="space-y-3">
                        {section.groups.map((group, groupIdx) => {
                          const groupSelectedCount = group.tickets.filter(t => selectedIds.has(t.id)).length;
                          const allSelected = groupSelectedCount === group.tickets.length;
                          const gradient = GRADIENT_PALETTE[groupIdx % GRADIENT_PALETTE.length];
                          const rows = [...new Set(group.tickets.map(t => t.row_name).filter(Boolean))];
                          const seats = group.tickets.map(t => t.seat).filter(Boolean).sort((a, b) => (parseInt(a!) || 0) - (parseInt(b!) || 0));

                          return (
                            <div key={group.key} className="rounded-xl overflow-hidden shadow-md">
                              {/* Gradient card header */}
                              <button
                                className={cn("w-full bg-gradient-to-br text-white px-4 py-3 text-left", gradient)}
                                onClick={() => toggleGroup(group)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold">{group.supplierName}</span>
                                      <Badge className="bg-white/20 text-white border-0 text-[9px] font-bold">
                                        {group.tickets.length} ticket{group.tickets.length !== 1 ? "s" : ""}
                                      </Badge>
                                      {groupSelectedCount > 0 && (
                                        <Badge className="bg-white/30 text-white border-0 text-[9px]">
                                          {groupSelectedCount} ✓
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-white/70 font-mono mt-1">
                                      {group.block && <><span className="text-white font-semibold">{group.block}</span> · </>}
                                      {rows.length > 0 && <>Row <span className="text-white font-semibold">{rows.join(", ")}</span> · </>}
                                      {seats.length > 0 && <>Seats <span className="text-white font-semibold">{seats.join(", ")}</span></>}
                                    </p>
                                    {group.leadBooker && (
                                      <p className="text-[10px] text-white/60 mt-1">
                                        Lead Booker: <span className="text-white/90 font-medium">{group.leadBooker}</span>
                                      </p>
                                    )}
                                  </div>
                                  <div className={cn(
                                    "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                                    allSelected ? "bg-white border-white" : "border-white/40"
                                  )}>
                                    {allSelected && <Check className="h-3 w-3 text-violet-700" />}
                                  </div>
                                </div>
                              </button>

                              {/* Seat chips */}
                              <div className="bg-card border border-t-0 rounded-b-xl px-3 py-3 flex flex-wrap gap-1.5">
                                {group.tickets.map(t => {
                                  const isSelected = selectedIds.has(t.id);
                                  const name = [t.first_name, t.last_name].filter(Boolean).join(" ").trim();
                                  return (
                                    <button
                                      key={t.id}
                                      onClick={() => toggleTicket(t.id)}
                                      title={name || undefined}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all",
                                        isSelected
                                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                          : "bg-muted/30 text-foreground border-border hover:border-primary/50 hover:bg-muted/60"
                                      )}
                                    >
                                      <span className={cn(
                                        "flex items-center justify-center h-6 w-6 rounded text-[11px] font-bold font-mono",
                                        isSelected ? "bg-white/20" : "bg-primary/10 text-primary"
                                      )}>
                                        {t.seat || "—"}
                                      </span>
                                      {t.row_name && (
                                        <span className={cn("text-[10px]", isSelected ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                          R{t.row_name}
                                        </span>
                                      )}
                                      {name && (
                                        <span className={cn("text-[10px]", isSelected ? "text-primary-foreground/60" : "text-muted-foreground")}>
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
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t px-5 py-4 space-y-3">
              {selectedArray.length > 0 && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{selectedArray.length} ticket{selectedArray.length !== 1 ? "s" : ""} selected</span>
                    <span className="font-bold font-mono">£{totalCost.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <Button onClick={handleLink} disabled={selectedArray.length === 0 || loading} className="w-full">
                {loading ? "Linking..." : `Link ${selectedArray.length} Ticket${selectedArray.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
