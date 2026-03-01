import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Package, CheckCircle2, Zap } from "lucide-react";

interface Props {
  orderId: string;
  eventId: string;
  orderCategory: string;
  orderQuantity: number;
  onClose: () => void;
  onAssigned: () => void;
}

interface AvailablePurchase {
  purchase_id: string;
  supplier_name: string;
  supplier_contact_name: string | null;
  supplier_order_id: string | null;
  category: string;
  section: string | null;
  unit_cost: number;
  currency: string;
  available_count: number;
  total_inventory: number;
  match_score: number;
  lead_booker: string | null;
  seat_summary: string | null;
}

export default function AssignPurchaseDialog({ orderId, eventId, orderCategory, orderQuantity, onClose, onAssigned }: Props) {
  const [purchases, setPurchases] = useState<AvailablePurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  // How many tickets does this order still need?
  const [linkedCount, setLinkedCount] = useState(0);
  const needed = orderQuantity - linkedCount;

  useEffect(() => {
    async function load() {
      const { data: existingLines } = await supabase
        .from("order_lines")
        .select("id")
        .eq("order_id", orderId);
      setLinkedCount(existingLines?.length || 0);

      const { data: eventPurchases } = await supabase
        .from("purchases")
        .select("id, category, section, unit_cost, currency, supplier_order_id, quantity, suppliers(name, contact_name)")
        .eq("event_id", eventId);

      if (!eventPurchases || eventPurchases.length === 0) {
        setPurchases([]);
        setLoading(false);
        return;
      }

      const purchaseIds = eventPurchases.map(p => p.id);
      const { data: allInventory } = await supabase
        .from("inventory")
        .select("id, purchase_id, status, row_name, seat, first_name, last_name")
        .in("purchase_id", purchaseIds);

      const result: AvailablePurchase[] = eventPurchases.map((p: any) => {
        const inv = (allInventory || []).filter(i => i.purchase_id === p.id);
        const availableInv = inv.filter(i => i.status === "available");
        let score = 0;
        if (p.category.toLowerCase() === orderCategory.toLowerCase()) score += 3;
        if (availableInv.length > 0) score += 2;

        // Lead booker from first inventory with a name
        const bookerInv = availableInv.find(i => (i as any).first_name || (i as any).last_name);
        const leadBooker = bookerInv ? [(bookerInv as any).first_name, (bookerInv as any).last_name].filter(Boolean).join(" ") : null;

        // Seat summary
        const rows = [...new Set(availableInv.map(i => (i as any).row_name).filter(Boolean))];
        const seats = availableInv.map(i => (i as any).seat).filter(Boolean);
        const seatParts: string[] = [];
        if (rows.length > 0) seatParts.push(`Row ${rows.join(", ")}`);
        if (seats.length > 0 && seats.length <= 6) seatParts.push(`Seats ${seats.join(", ")}`);
        else if (seats.length > 6) seatParts.push(`${seats.length} seats`);

        return {
          purchase_id: p.id,
          supplier_name: p.suppliers?.name || "Inventory",
          supplier_contact_name: (p.suppliers as any)?.contact_name || null,
          supplier_order_id: p.supplier_order_id,
          category: p.category,
          section: p.section,
          unit_cost: Number(p.unit_cost),
          currency: p.currency,
          available_count: availableInv.length,
          total_inventory: inv.length,
          match_score: score,
          lead_booker: leadBooker,
          seat_summary: seatParts.length > 0 ? seatParts.join(" · ") : null,
        };
      }).filter((p: AvailablePurchase) => p.available_count > 0 && p.unit_cost > 0)
        .sort((a: AvailablePurchase, b: AvailablePurchase) => b.match_score - a.match_score);

      setPurchases(result);
      setLoading(false);
    }
    load();
  }, [orderId, eventId, orderCategory]);

  const handleAssign = async (purchaseId: string, availableCount: number) => {
    const toAssign = Math.min(needed, availableCount);
    if (toAssign <= 0) return;
    setAssigning(purchaseId);

    try {
      // Get available inventory from this purchase
      const { data: availableInv } = await supabase
        .from("inventory")
        .select("id")
        .eq("purchase_id", purchaseId)
        .eq("status", "available")
        .limit(toAssign);

      if (!availableInv || availableInv.length === 0) {
        toast.error("No available tickets");
        return;
      }

      const ids = availableInv.map(i => i.id);

      // Create order_lines
      const lines = ids.map(invId => ({ order_id: orderId, inventory_id: invId }));
      const { error: lineErr } = await supabase.from("order_lines").insert(lines);
      if (lineErr) throw lineErr;

      // Mark inventory as sold
      const { error: invErr } = await supabase
        .from("inventory")
        .update({ status: "sold" as any })
        .in("id", ids);
      if (invErr) throw invErr;

      toast.success(`${ids.length} ticket${ids.length !== 1 ? "s" : ""} assigned`);
      onAssigned();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAssigning(null);
    }
  };

  const sym = (c: string) => (c === "GBP" ? "£" : c === "USD" ? "$" : "€");

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" /> Quick Assign
          </DialogTitle>
        </DialogHeader>

        {needed <= 0 ? (
          <div className="py-8 text-center text-sm">
            <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
            <p className="font-medium">Order fully assigned</p>
            <p className="text-muted-foreground text-xs mt-1">All {orderQuantity} tickets are linked</p>
          </div>
        ) : loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading purchases...</div>
        ) : purchases.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No available purchases for this event</p>
            <p className="text-xs mt-1">Add a purchase first</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Need <span className="font-bold text-foreground">{needed}</span> more ticket{needed !== 1 ? "s" : ""}. Pick a purchase to assign from:
            </p>
            <div className="space-y-2">
              {purchases.map(p => (
                <div
                  key={p.purchase_id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    p.match_score >= 3 ? "border-success/30 bg-success/5" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">
                        {p.supplier_contact_name || p.supplier_name}
                      </span>
                      <span className="text-xs text-muted-foreground">({p.supplier_name})</span>
                      {p.match_score >= 3 && (
                        <Badge variant="outline" className="text-[10px] py-0 bg-success/10 text-success border-success/20">Best match</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.section || "—"} · {sym(p.currency)}{p.unit_cost.toFixed(2)}/ea
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.available_count} available of {p.total_inventory}
                      {p.supplier_order_id ? ` · ${p.supplier_order_id}` : ""}
                    </p>
                    {p.seat_summary && (
                      <p className="text-xs text-muted-foreground">{p.seat_summary}</p>
                    )}
                    {p.lead_booker && (
                      <p className="text-xs">
                        <span className="text-muted-foreground">Lead Booker:</span>{" "}
                        <span className="font-medium text-foreground">{p.lead_booker}</span>
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={p.match_score >= 3 ? "default" : "outline"}
                    className="h-8 text-xs ml-3 shrink-0"
                    disabled={assigning === p.purchase_id}
                    onClick={() => handleAssign(p.purchase_id, p.available_count)}
                  >
                    {assigning === p.purchase_id ? "..." : `Assign ${Math.min(needed, p.available_count)}`}
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
