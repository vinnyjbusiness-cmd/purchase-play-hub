import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useOrg } from "@/hooks/useOrg";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function AddInventoryDialog({ onClose, onCreated }: Props) {
  const { orgId } = useOrg();
  const [events, setEvents] = useState<{ id: string; label: string }[]>([]);
  const [purchases, setPurchases] = useState<{ id: string; label: string }[]>([]);
  const [eventId, setEventId] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [category, setCategory] = useState("General");
  const [section, setSection] = useState("");
  const [rowName, setRowName] = useState("");
  const [seat, setSeat] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("events").select("id, match_code, home_team, away_team").order("event_date").then(({ data }) => {
      setEvents((data || []).map(e => ({ id: e.id, label: `${e.match_code} — ${e.home_team} vs ${e.away_team}` })));
    });
  }, []);

  useEffect(() => {
    if (!eventId) { setPurchases([]); return; }
    supabase.from("purchases").select("id, supplier_order_id, suppliers(name)").eq("event_id", eventId).then(({ data }) => {
      setPurchases((data || []).map((p: any) => ({
        id: p.id,
        label: `${p.suppliers?.name || "Unknown"} ${p.supplier_order_id ? `(${p.supplier_order_id})` : ""}`,
      })));
    });
  }, [eventId]);

  const handleSubmit = async () => {
    if (!eventId || !purchaseId) { toast.error("Select event and purchase"); return; }
    setLoading(true);
    const rows = Array.from({ length: quantity }, () => ({
      event_id: eventId,
      purchase_id: purchaseId,
      category,
      section: section || null,
      row_name: rowName || null,
      seat: seat || null,
      org_id: orgId,
      status: "available" as const,
    }));
    const { error } = await supabase.from("inventory").insert(rows);
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success(`${quantity} inventory item${quantity !== 1 ? "s" : ""} added`);
    setLoading(false);
    onCreated();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Inventory</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Event</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
              <SelectContent>
                {events.map(e => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Source Purchase</Label>
            <Select value={purchaseId} onValueChange={setPurchaseId} disabled={!eventId}>
              <SelectTrigger><SelectValue placeholder="Select purchase" /></SelectTrigger>
              <SelectContent>
                {purchases.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input value={category} onChange={e => setCategory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Input value={section} onChange={e => setSection(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Row</Label>
              <Input value={rowName} onChange={e => setRowName(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Seat</Label>
              <Input value={seat} onChange={e => setSeat(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? "Adding..." : "Add Inventory"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
