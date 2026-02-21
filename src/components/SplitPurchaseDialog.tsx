import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default function SplitPurchaseDialog({
  purchaseId, currentQuantity, category, section, unitCost, currency, supplierName, onClose, onSplit,
}: Props) {
  const [splitQty, setSplitQty] = useState(Math.floor(currentQuantity / 2));
  const [loading, setLoading] = useState(false);

  const remaining = currentQuantity - splitQty;
  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";

  const handleSplit = async () => {
    if (splitQty < 1 || splitQty >= currentQuantity) {
      toast.error("Split quantity must be between 1 and " + (currentQuantity - 1));
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

      // 1. Update original purchase quantity (total_cost is auto-generated)
      const { error: updateErr } = await supabase
        .from("purchases")
        .update({
          quantity: remaining,
        })
        .eq("id", purchaseId);
      if (updateErr) throw updateErr;

      // 2. Create new purchase with the split amount (total_cost is auto-generated)
      const { data: newPurchase, error: insertErr } = await supabase
        .from("purchases")
        .insert({
          supplier_id: purchase.supplier_id,
          event_id: purchase.event_id,
          supplier_order_id: purchase.supplier_order_id ? `${purchase.supplier_order_id}-split` : null,
          category: purchase.category,
          section: purchase.section,
          quantity: splitQty,
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

      // 3. Move some available inventory to new purchase
      const toMove = availableInv.slice(0, splitQty);
      if (toMove.length > 0 && newPurchase) {
        const { error: moveErr } = await supabase
          .from("inventory")
          .update({ purchase_id: newPurchase.id })
          .in("id", toMove.map(i => i.id));
        if (moveErr) throw moveErr;
      }

      toast.success(`Purchase split: ${remaining} + ${splitQty}`);
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
          Split <span className="font-medium text-foreground">{supplierName}</span> · {category} · {sym}{unitCost.toFixed(2)}/ea
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Split off how many tickets?</Label>
            <Input
              type="number"
              min={1}
              max={currentQuantity - 1}
              value={splitQty}
              onChange={(e) => setSplitQty(parseInt(e.target.value) || 1)}
            />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-lg border bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Original</p>
              <p className="text-lg font-bold">{remaining}</p>
              <p className="text-xs text-muted-foreground">{sym}{(remaining * unitCost).toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-center">
              <p className="text-xs text-muted-foreground">New Split</p>
              <p className="text-lg font-bold">{splitQty}</p>
              <p className="text-xs text-muted-foreground">{sym}{(splitQty * unitCost).toFixed(2)}</p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSplit}
          disabled={loading || splitQty < 1 || splitQty >= currentQuantity}
          className="w-full"
        >
          {loading ? "Splitting..." : `Split into ${remaining} + ${splitQty}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
