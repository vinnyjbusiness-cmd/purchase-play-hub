import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { STANDARD_SECTIONS, HOSPITALITY_OPTIONS } from "@/lib/seatingSections";

interface Purchase {
  id: string;
  supplier_order_id: string | null;
  category: string;
  section: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  status: string;
  supplier_paid: boolean;
  purchase_date: string;
  notes: string | null;
  event_id: string;
  split_type: string | null;
  suppliers: { name: string; contact_name: string | null; contact_phone: string | null } | null;
  events: { match_code: string; home_team: string; away_team: string; event_date: string } | null;
}

interface Props {
  purchase: Purchase | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditPurchaseDialog({ purchase, open, onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    category: "",
    section: "",
    quantity: "1",
    unit_cost: "",
    supplier_order_id: "",
    split_type: "",
    notes: "",
    status: "confirmed",
  });

  useEffect(() => {
    if (purchase && open) {
      setForm({
        category: purchase.category || "",
        section: purchase.section || "",
        quantity: String(purchase.quantity),
        unit_cost: String(purchase.unit_cost),
        supplier_order_id: purchase.supplier_order_id || "",
        split_type: purchase.split_type || "",
        notes: purchase.notes || "",
        status: purchase.status || "confirmed",
      });
    }
  }, [purchase, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchase) return;
    setLoading(true);
    try {
      const qty = parseInt(form.quantity);
      const unitCost = parseFloat(form.unit_cost);
      const totalCost = qty * unitCost;

      const { error } = await supabase.from("purchases").update({
        category: form.category,
        section: form.section || null,
        quantity: qty,
        unit_cost: unitCost,
        supplier_order_id: form.supplier_order_id || null,
        split_type: form.split_type || null,
        notes: form.notes || null,
        status: form.status as any,
      }).eq("id", purchase.id);
      if (error) throw error;

      // Sync inventory: ensure correct number of inventory records exist
      const { data: existingInv } = await supabase
        .from("inventory")
        .select("id, status")
        .eq("purchase_id", purchase.id);

      const currentCount = (existingInv || []).length;

      if (qty > currentCount) {
        // Create additional inventory records
        const toCreate = Array.from({ length: qty - currentCount }, () => ({
          event_id: purchase.event_id,
          purchase_id: purchase.id,
          category: form.category,
          section: form.section || null,
          face_value: unitCost,
          source: purchase.suppliers?.name || "IJK",
          split_type: form.split_type || null,
          status: "available" as const,
        }));
        await supabase.from("inventory").insert(toCreate as any);
      } else if (qty < currentCount) {
        // Remove excess available inventory (only remove unsold ones)
        const available = (existingInv || []).filter(i => i.status === "available");
        const toRemove = available.slice(0, currentCount - qty).map(i => i.id);
        if (toRemove.length > 0) {
          await supabase.from("inventory").delete().in("id", toRemove);
        }
      }

      // Update category/section on remaining inventory
      await supabase.from("inventory").update({
        category: form.category,
        section: form.section || null,
        face_value: unitCost,
        split_type: form.split_type || null,
      }).eq("purchase_id", purchase.id);

      toast.success("Purchase updated");
      onClose();
      onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!purchase) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Purchase</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {purchase.events?.home_team} vs {purchase.events?.away_team} · {purchase.suppliers?.name}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Input value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Longside Upper" />
          </div>

          {/* Section/Block */}
          <div className="space-y-1.5">
            <Label>Section / Block</Label>
            <Input value={form.section} onChange={(e) => setForm(f => ({ ...f, section: e.target.value }))} placeholder="e.g. Block 305" />
          </div>

          {/* Quantity & Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Cost Per Ticket *</Label>
              <Input type="number" step="0.01" min="0" value={form.unit_cost} onChange={(e) => setForm(f => ({ ...f, unit_cost: e.target.value }))} placeholder="0.00" />
            </div>
          </div>

          {/* Total display */}
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-sm text-muted-foreground">Total Cost</p>
            <p className="text-lg font-bold">
              £{((parseInt(form.quantity) || 0) * (parseFloat(form.unit_cost) || 0)).toFixed(2)}
            </p>
          </div>

          {/* Split Type */}
          <div className="space-y-1.5">
            <Label>Split Type</Label>
            <Select value={form.split_type} onValueChange={(v) => setForm(f => ({ ...f, split_type: v }))}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="singles">Singles</SelectItem>
                <SelectItem value="pairs">Pairs</SelectItem>
                <SelectItem value="trios">Trios</SelectItem>
                <SelectItem value="quads">Quads</SelectItem>
                <SelectItem value="all_together">All Together</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Order ID */}
          <div className="space-y-1.5">
            <Label>Contact Order ID</Label>
            <Input value={form.supplier_order_id} onChange={(e) => setForm(f => ({ ...f, supplier_order_id: e.target.value }))} placeholder="Reference number" />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional info..." maxLength={500} rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !form.category || !form.unit_cost}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
