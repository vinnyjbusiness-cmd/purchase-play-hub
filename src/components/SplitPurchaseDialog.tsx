import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Scissors, Plus, X } from "lucide-react";
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

type SplitMode = "singles" | "pairs" | "trios" | "quads" | "custom";

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
  const [customGroups, setCustomGroups] = useState<number[]>([1, 1]);

  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";

  const groupSize = splitMode === "singles" ? 1 : splitMode === "pairs" ? 2 : splitMode === "trios" ? 3 : splitMode === "quads" ? 4 : 0;

  const groups = useMemo(() => {
    if (splitMode === "custom") {
      const sum = customGroups.reduce((s, g) => s + g, 0);
      if (sum !== currentQuantity || customGroups.length < 2) return [];
      if (customGroups.some(g => g < 1)) return [];
      return customGroups;
    }
    if (!groupSize || groupSize >= currentQuantity) return [];
    return computeGroups(currentQuantity, groupSize);
  }, [splitMode, groupSize, currentQuantity, customGroups]);

  const customSum = customGroups.reduce((s, g) => s + g, 0);
  const customRemaining = currentQuantity - customSum;

  const addCustomGroup = () => setCustomGroups(prev => [...prev, 1]);
  const removeCustomGroup = (i: number) => setCustomGroups(prev => prev.filter((_, idx) => idx !== i));
  const updateCustomGroup = (i: number, val: number) => setCustomGroups(prev => prev.map((g, idx) => idx === i ? (val || 1) : g));

  const handleSplit = async () => {
    if (groups.length < 2) {
      toast.error("Nothing to split");
      return;
    }

    setLoading(true);
    try {
      const { data: purchase } = await supabase
        .from("purchases")
        .select("*")
        .eq("id", purchaseId)
        .single();

      if (!purchase) throw new Error("Purchase not found");

      const { data: allInventory } = await supabase
        .from("inventory")
        .select("id, status")
        .eq("purchase_id", purchaseId)
        .eq("status", "available");

      const availableInv = allInventory || [];
      const [firstGroup, ...restGroups] = groups;

      const { error: updateErr } = await supabase
        .from("purchases")
        .update({ quantity: firstGroup })
        .eq("id", purchaseId);
      if (updateErr) throw updateErr;

      let invOffset = firstGroup;
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
            <Select value={splitMode} onValueChange={(v) => {
              setSplitMode(v as SplitMode);
              if (v === "custom") setCustomGroups([Math.floor(currentQuantity / 2), Math.ceil(currentQuantity / 2)]);
            }}>
              <SelectTrigger><SelectValue placeholder="Select split type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="singles">Singles (1s)</SelectItem>
                <SelectItem value="pairs">Pairs (2s)</SelectItem>
                <SelectItem value="trios">Trios (3s)</SelectItem>
                <SelectItem value="quads">Quads (4s)</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom split editor */}
          {splitMode === "custom" && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                {customGroups.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-14">Group {i + 1}</span>
                    <Input
                      type="number"
                      min={1}
                      max={currentQuantity}
                      value={g}
                      onChange={(e) => updateCustomGroup(i, parseInt(e.target.value) || 1)}
                      className="h-8 text-sm"
                    />
                    {customGroups.length > 2 && (
                      <button onClick={() => removeCustomGroup(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addCustomGroup} className="w-full text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Group
              </Button>
              <p className={`text-xs font-medium ${customRemaining === 0 ? "text-success" : "text-destructive"}`}>
                {customRemaining === 0
                  ? "✓ All tickets allocated"
                  : customRemaining > 0
                    ? `${customRemaining} ticket${customRemaining !== 1 ? "s" : ""} remaining`
                    : `${Math.abs(customRemaining)} too many`}
              </p>
            </div>
          )}

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

          {splitMode && splitMode !== "custom" && groups.length < 2 && (
            <p className="text-xs text-muted-foreground">Not enough tickets to split into {splitMode}</p>
          )}
        </div>

        <Button
          onClick={handleSplit}
          disabled={loading || groups.length < 2}
          className="w-full"
        >
          {loading ? "Splitting..." : groups.length >= 2 ? `Split into ${groups.join(" + ")}` : "Select a split type"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
