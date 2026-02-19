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

export default function AddOrderDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; match_code: string; home_team: string; away_team: string }[]>([]);

  const [form, setForm] = useState({
    platform_id: "",
    event_id: "",
    order_ref: "",
    buyer_ref: "",
    buyer_name: "",
    buyer_phone: "",
    buyer_email: "",
    category: "Cat 1",
    quantity: "1",
    sale_price: "",
    fees: "0",
    currency: "GBP" as "GBP" | "USD" | "EUR",
    delivery_type: "email" as "email" | "physical" | "mobile_transfer" | "will_call" | "instant",
  });

  useEffect(() => {
    if (open) {
      supabase.from("platforms").select("id, name").then(({ data }) => setPlatforms(data || []));
      supabase.from("events").select("id, match_code, home_team, away_team").order("event_date").then(({ data }) => setEvents(data || []));
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from("orders").insert({
        platform_id: form.platform_id || null,
        event_id: form.event_id,
        order_ref: form.order_ref || null,
        buyer_ref: form.buyer_ref || null,
        buyer_name: form.buyer_name || null,
        buyer_phone: form.buyer_phone || null,
        buyer_email: form.buyer_email || null,
        category: form.category,
        quantity: parseInt(form.quantity),
        sale_price: parseFloat(form.sale_price),
        fees: parseFloat(form.fees),
        currency: form.currency,
        delivery_type: form.delivery_type,
      });
      if (error) throw error;
      toast.success("Order added");
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
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Order</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Order / Sale</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform_id} onValueChange={(v) => setForm({ ...form, platform_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
              <Label>Order Ref</Label>
              <Input value={form.order_ref} onChange={(e) => setForm({ ...form, order_ref: e.target.value })} placeholder="e.g. ORD-123" />
            </div>
            <div className="space-y-1.5">
              <Label>Buyer Ref</Label>
              <Input value={form.buyer_ref} onChange={(e) => setForm({ ...form, buyer_ref: e.target.value })} placeholder="e.g. BUY-A1" />
            </div>
          </div>

          {/* Customer details */}
          <div className="space-y-1.5">
            <Label>Customer Name</Label>
            <Input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} placeholder="e.g. John Smith" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Customer Phone</Label>
              <Input value={form.buyer_phone} onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })} placeholder="e.g. +44 7700 900000" />
            </div>
            <div className="space-y-1.5">
              <Label>Customer Email</Label>
              <Input type="email" value={form.buyer_email} onChange={(e) => setForm({ ...form, buyer_email: e.target.value })} placeholder="e.g. john@example.com" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Cat 1", "Cat 2", "Cat 3", "Cat 4", "VIP", "Hospitality"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Sale Price *</Label>
              <Input type="number" step="0.01" min="0" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Fees</Label>
              <Input type="number" step="0.01" min="0" value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Delivery Type</Label>
            <Select value={form.delivery_type} onValueChange={(v: any) => setForm({ ...form, delivery_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="physical">Physical</SelectItem>
                <SelectItem value="mobile_transfer">Mobile Transfer</SelectItem>
                <SelectItem value="will_call">Will Call</SelectItem>
                <SelectItem value="instant">Instant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !form.event_id || !form.sale_price}>
            {loading ? "Saving..." : "Add Order"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
