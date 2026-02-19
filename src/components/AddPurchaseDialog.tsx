import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onCreated: () => void;
}

export default function AddPurchaseDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; match_code: string; home_team: string; away_team: string }[]>([]);

  const [form, setForm] = useState({
    supplier_id: "",
    event_id: "",
    supplier_order_id: "",
    supplier_name: "",
    supplier_number: "",
    category: "Cat 1",
    quantity: "1",
    unit_cost: "",
    notes: "",
  });

  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id);
  const isTrade = selectedSupplier?.name?.toLowerCase() === "trade";
  const isWebsites = selectedSupplier?.name?.toLowerCase() === "websites";

  useEffect(() => {
    if (open) {
      supabase.from("suppliers").select("id, name").then(({ data }) => setSuppliers(data || []));
      supabase.from("events").select("id, match_code, home_team, away_team").order("event_date").then(({ data }) => setEvents(data || []));
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id || !form.event_id || !form.unit_cost) return;
    setLoading(true);
    try {
      const noteParts: string[] = [];
      if (isTrade && form.supplier_name.trim()) noteParts.push(`Name: ${form.supplier_name.trim()}`);
      if (isTrade && form.supplier_number.trim()) noteParts.push(`Phone: ${form.supplier_number.trim()}`);
      if (isWebsites && form.supplier_name.trim()) noteParts.push(`Website: ${form.supplier_name.trim()}`);
      if (form.notes.trim()) noteParts.push(form.notes.trim());

      const { error } = await supabase.from("purchases").insert({
        supplier_id: form.supplier_id,
        event_id: form.event_id,
        supplier_order_id: form.supplier_order_id || null,
        category: form.category,
        quantity: parseInt(form.quantity),
        unit_cost: parseFloat(form.unit_cost),
        fees: 0,
        currency: "GBP" as const,
        exchange_rate: 1,
        status: "confirmed" as const,
        notes: noteParts.length > 0 ? noteParts.join(" | ") : null,
      });
      if (error) throw error;
      toast.success("Purchase added");
      setForm({
        supplier_id: "",
        event_id: "",
        supplier_order_id: "",
        supplier_name: "",
        supplier_number: "",
        category: "Cat 1",
        quantity: "1",
        unit_cost: "",
        notes: "",
      });
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Purchase</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Purchase</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Event *</Label>
              <Select value={form.event_id} onValueChange={(v) => setForm({ ...form, event_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                <SelectContent>
                  {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.match_code} — {e.home_team} vs {e.away_team}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isTrade && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={form.supplier_name}
                  onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                  placeholder="e.g. John Smith"
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Number</Label>
                <Input
                  value={form.supplier_number}
                  onChange={(e) => setForm({ ...form, supplier_number: e.target.value })}
                  placeholder="e.g. +44 7700 900000"
                  maxLength={20}
                />
              </div>
            </div>
          )}

          {isWebsites && (
            <div className="space-y-1.5">
              <Label>Website Name</Label>
              <Input
                value={form.supplier_name}
                onChange={(e) => setForm({ ...form, supplier_name: e.target.value })}
                placeholder="e.g. Tixstock, FanPass"
                maxLength={100}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Order ID</Label>
              <Input value={form.supplier_order_id} onChange={(e) => setForm({ ...form, supplier_order_id: e.target.value })} placeholder="e.g. ORD-1234" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Cat 1", "Cat 2", "Cat 3", "Cat 4", "VIP", "Hospitality"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Cost Per Ticket *</Label>
              <Input type="number" step="0.01" min="0" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} placeholder="0.00" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional info..."
              maxLength={500}
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !form.supplier_id || !form.event_id || !form.unit_cost}>
            {loading ? "Saving..." : "Add Purchase"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
