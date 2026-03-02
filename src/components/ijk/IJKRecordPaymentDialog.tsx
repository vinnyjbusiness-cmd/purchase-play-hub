import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string | null;
  onSaved: () => void;
}

export default function IJKRecordPaymentDialog({ open, onOpenChange, orgId, onSaved }: Props) {
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"to_ijk" | "from_ijk">("to_ijk");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    const { error } = await supabase.from("ijk_payments" as any).insert({
      amount: val,
      direction,
      notes: notes || null,
      org_id: orgId,
      payment_date: new Date().toISOString(),
    } as any);
    setSaving(false);
    if (error) { toast.error("Failed to record payment"); return; }
    toast.success("Payment recorded");
    setAmount(""); setNotes("");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record IJK Payment</DialogTitle>
          <DialogDescription>Log a payment made to or received from IJK</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Direction</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                size="sm"
                variant={direction === "to_ijk" ? "default" : "outline"}
                onClick={() => setDirection("to_ijk")}
              >
                Paid to IJK
              </Button>
              <Button
                type="button"
                size="sm"
                variant={direction === "from_ijk" ? "default" : "outline"}
                onClick={() => setDirection("from_ijk")}
              >
                Received from IJK
              </Button>
            </div>
          </div>
          <div>
            <Label>Amount (£)</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Bank transfer for Liverpool vs West Ham" rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Record Payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
