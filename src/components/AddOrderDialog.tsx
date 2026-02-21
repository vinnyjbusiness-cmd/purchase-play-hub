import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Smartphone, Link2 } from "lucide-react";
import { toast } from "sonner";
import { STANDARD_SECTIONS, HOSPITALITY_OPTIONS, CLUBS } from "@/lib/seatingSections";

interface Props {
  onCreated: () => void;
}

export default function AddOrderDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; match_code: string; home_team: string; away_team: string; event_date: string; competition: string }[]>([]);

  const [form, setForm] = useState({
    platform_id: "",
    club: "",
    event_id: "",
    order_ref: "",
    buyer_name: "",
    buyer_phone: "",
    category: "",
    quantity: "1",
    sale_price: "",
    delivery_type: "mobile_transfer" as "mobile_transfer" | "email",
    notes: "",
  });

  const isWorldCup = form.club === "world-cup";

  // Filter events by selected club
  const filteredEvents = events.filter((e) => {
    if (!form.club) return false;
    if (form.club === "world-cup") return e.competition?.toLowerCase().includes("world cup");
    const clubLabel = CLUBS.find((c) => c.value === form.club)?.label || "";
    return e.home_team === clubLabel || e.away_team === clubLabel;
  });

  useEffect(() => {
    if (open) {
      supabase.from("platforms").select("id, name").then(({ data }) => setPlatforms(data || []));
      supabase.from("events").select("id, match_code, home_team, away_team, event_date, competition").order("event_date").then(({ data }) => setEvents(data || []));
    }
  }, [open]);

  // Reset event & category when club changes
  useEffect(() => {
    setForm((f) => ({ ...f, event_id: "", category: "" }));
  }, [form.club]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from("orders").insert({
        platform_id: form.platform_id || null,
        event_id: form.event_id,
        order_ref: form.order_ref || null,
        buyer_name: form.buyer_name || null,
        buyer_phone: form.buyer_phone || null,
        category: form.category || "General",
        quantity: parseInt(form.quantity),
        sale_price: parseFloat(form.sale_price),
        fees: 0,
        currency: "GBP",
        delivery_type: form.delivery_type,
        notes: form.notes || null,
      });
      if (error) throw error;
      toast.success("Order added");
      setOpen(false);
      setForm({
        platform_id: "", club: "", event_id: "", order_ref: "", buyer_name: "", buyer_phone: "",
        category: "", quantity: "1", sale_price: "", delivery_type: "mobile_transfer", notes: "",
      });
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
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Order / Sale</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Platform */}
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select value={form.platform_id} onValueChange={(v) => setForm({ ...form, platform_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
              <SelectContent>
                {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Club → Event */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Club *</Label>
              <Select value={form.club} onValueChange={(v) => setForm({ ...form, club: v })}>
                <SelectTrigger><SelectValue placeholder="Select club" /></SelectTrigger>
                <SelectContent>
                  {CLUBS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Event *</Label>
              <Select value={form.event_id} onValueChange={(v) => setForm({ ...form, event_id: v })} disabled={!form.club}>
                <SelectTrigger><SelectValue placeholder={form.club ? "Select event" : "Pick club first"} /></SelectTrigger>
                <SelectContent>
                  {filteredEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.home_team} vs {e.away_team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Order Number & Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Order Number</Label>
              <Input value={form.order_ref} onChange={(e) => setForm({ ...form, order_ref: e.target.value })} placeholder="e.g. ORD-123" />
            </div>
            <div className="space-y-1.5">
              <Label>Customer Name</Label>
              <Input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} placeholder="e.g. John Smith" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Customer Phone</Label>
            <Input value={form.buyer_phone} onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })} placeholder="e.g. +44 7700 900000" />
          </div>

          {/* Category — club-based */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              {isWorldCup ? (
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {["Cat 1", "Cat 2", "Cat 3", "Cat 4"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {STANDARD_SECTIONS.map((s) => (
                      <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>
                    ))}
                    {HOSPITALITY_OPTIONS.map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
          </div>

          {/* Sale Price */}
          <div className="space-y-1.5">
            <Label>Sale Price (£) *</Label>
            <Input type="number" step="0.01" min="0" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} placeholder="0.00" />
          </div>

          {/* Delivery Type — compact toggle */}
          <div className="space-y-1.5">
            <Label>Delivery</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={form.delivery_type === "mobile_transfer" ? "default" : "outline"}
                className="flex-1 gap-1.5"
                onClick={() => setForm({ ...form, delivery_type: "mobile_transfer" })}
              >
                <Smartphone className="h-3.5 w-3.5" /> Phone
              </Button>
              <Button
                type="button"
                size="sm"
                variant={form.delivery_type === "email" ? "default" : "outline"}
                className="flex-1 gap-1.5"
                onClick={() => setForm({ ...form, delivery_type: "email" })}
              >
                <Link2 className="h-3.5 w-3.5" /> Link
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional info..."
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !form.event_id || !form.sale_price}>
            {loading ? "Saving..." : "Add Order"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
