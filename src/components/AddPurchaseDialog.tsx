import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    category: "Cat 1",
    section: "",
    quantity: "1",
    unit_cost: "",
    fees: "0",
    currency: "GBP" as "GBP" | "USD" | "EUR",
    exchange_rate: "1.0",
    status: "confirmed" as "pending" | "confirmed" | "received" | "cancelled",
  });

  useEffect(() => {
    if (open) {
      supabase.from("suppliers").select("id, name").then(({ data }) => setSuppliers(data || []));
      supabase.from("events").select("id, match_code, home_team, away_team").order("event_date").then(({ data }) => setEvents(data || []));
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from("purchases").insert({
        supplier_id: form.supplier_id,
        event_id: form.event_id,
        supplier_order_id: form.supplier_order_id || null,
        category: form.category,
        section: form.section || null,
        quantity: parseInt(form.quantity),
        unit_cost: parseFloat(form.unit_cost),
        fees: parseFloat(form.fees),
        currency: form.currency,
        exchange_rate: parseFloat(form.exchange_rate),
        status: form.status,
      });
      if (error) throw error;
      toast.success("Purchase added");
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Supplier Order ID</Label>
              <Input value={form.supplier_order_id} onChange={(e) => setForm({ ...form, supplier_order_id: e.target.value })} placeholder="e.g. TX-1234" />
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

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit Cost *</Label>
              <Input type="number" step="0.01" min="0" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Fees</Label>
              <Input type="number" step="0.01" min="0" value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v: any) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Exchange Rate</Label>
              <Input type="number" step="0.0001" min="0" value={form.exchange_rate} onChange={(e) => setForm({ ...form, exchange_rate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Section</Label>
            <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="e.g. Block A" />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !form.supplier_id || !form.event_id || !form.unit_cost}>
            {loading ? "Saving..." : "Add Purchase"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
