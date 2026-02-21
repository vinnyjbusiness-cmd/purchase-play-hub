import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Scissors } from "lucide-react";
import { toast } from "sonner";

interface Props {
  purchaseId: string;
  currentQuantity: number;
  category: string;
  section: string | null;
  unitCost: number;
  currency: string;
  supplierName: string;
  onClose: () => void;
  onSplit: () => void;
}

type SplitMode = "singles" | "pairs" | "trios" | "quads";

function computeGroups(total: number, groupSize: number): number[] {
  const groups: number[] = [];
  let remaining = total;
  while (remaining > 0) {
    const chunk = Math.min(groupSize, remaining);
    groups.push(chunk);
    remaining -= chunk;
  }
  return groups;
}

export default function SplitPurchaseDialog({
  purchaseId, currentQuantity, category, section, unitCost, currency, supplierName, onClose, onSplit,
}: Props) {
  const [splitMode, setSplitMode] = useState<SplitMode | "">("");
  const [loading, setLoading] = useState(false);

  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";

  const groupSize = splitMode === "singles" ? 1 : splitMode === "pairs" ? 2 : splitMode === "trios" ? 3 : splitMode === "quads" ? 4 : 0;

  const groups = useMemo(() => {
    if (!groupSize || groupSize >= currentQuantity) return [];
    return computeGroups(currentQuantity, groupSize);
  }, [groupSize, currentQuantity]);

  const handleSplit = async () => {
    if (groups.length < 2) {
      toast.error("Nothing to split");
      return;
    }

    setLoading(true);
    try {
      // Get the purchase details to copy
      const { data: purchase } = await supabase
        .from("purchases")
        .select("*")
        .eq("id", purchaseId)
        .single();

      if (!purchase) throw new Error("Purchase not found");

      // Get available inventory for this purchase
      const { data: allInventory } = await supabase
        .from("inventory")
        .select("id, status")
        .eq("purchase_id", purchaseId)
        .eq("status", "available");

      const availableInv = allInventory || [];

      // First group keeps the original purchase, rest create new ones
      const [firstGroup, ...restGroups] = groups;

      // 1. Update original purchase quantity
      const { error: updateErr } = await supabase
        .from("purchases")
        .update({ quantity: firstGroup })
        .eq("id", purchaseId);
      if (updateErr) throw updateErr;

      // 2. Create new purchases for remaining groups
      let invOffset = firstGroup; // skip inventory for original
      for (const qty of restGroups) {
        const { data: newPurchase, error: insertErr } = await supabase
          .from("purchases")
          .insert({
            supplier_id: purchase.supplier_id,
            event_id: purchase.event_id,
            supplier_order_id: purchase.supplier_order_id ? `${purchase.supplier_order_id}-split` : null,
            category: purchase.category,
            section: purchase.section,
            quantity: qty,
            unit_cost: purchase.unit_cost,
            fees: purchase.fees,
            currency: purchase.currency,
            exchange_rate: purchase.exchange_rate,
            status: purchase.status,
            supplier_paid: purchase.supplier_paid,
            purchase_date: purchase.purchase_date,
            notes: purchase.notes ? `${purchase.notes} | Split from original` : "Split from original",
          })
          .select("id")
          .single();
        if (insertErr) throw insertErr;

        // Move inventory
        const toMove = availableInv.slice(invOffset, invOffset + qty);
        if (toMove.length > 0 && newPurchase) {
          const { error: moveErr } = await supabase
            .from("inventory")
            .update({ purchase_id: newPurchase.id })
            .in("id", toMove.map(i => i.id));
          if (moveErr) throw moveErr;
        }
        invOffset += qty;
      }

      toast.success(`Split into ${groups.length} groups: ${groups.join(", ")}`);
      onSplit();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4" /> Split Purchase
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground">
          Split <span className="font-medium text-foreground">{supplierName}</span> · {category} · {sym}{unitCost.toFixed(2)}/ea · <span className="font-medium text-foreground">{currentQuantity} tickets</span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Split into</Label>
            <Select value={splitMode} onValueChange={(v) => setSplitMode(v as SplitMode)}>
              <SelectTrigger><SelectValue placeholder="Select split type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="singles">Singles (1s)</SelectItem>
                <SelectItem value="pairs">Pairs (2s)</SelectItem>
                <SelectItem value="trios">Trios (3s)</SelectItem>
                <SelectItem value="quads">Quads (4s)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {groups.length >= 2 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Result: {groups.length} groups</p>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g, i) => (
                    <div key={i} className={`px-3 py-2 rounded-lg border text-center text-sm ${i === 0 ? "bg-muted/30" : "border-primary/30 bg-primary/5"}`}>
                      <p className="font-bold">{g}</p>
                      <p className="text-xs text-muted-foreground">{sym}{(g * unitCost).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {splitMode && groups.length < 2 && (
            <p className="text-xs text-muted-foreground">Not enough tickets to split into {splitMode}</p>
          )}
        </div>

        <Button
          onClick={handleSplit}
          disabled={loading || groups.length < 2}
          className="w-full"
        >
          {loading ? "Splitting..." : groups.length >= 2 ? `Split into ${groups.length} × ${groups.join(", ")}` : "Select a split type"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
