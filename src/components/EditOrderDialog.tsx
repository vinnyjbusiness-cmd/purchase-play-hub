import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Smartphone, Link2, ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STANDARD_SECTIONS, HOSPITALITY_OPTIONS } from "@/lib/seatingSections";

interface OrderData {
  id: string;
  platform_id: string | null;
  contact_id?: string | null;
  event_id: string;
  order_ref: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  category: string;
  block?: string | null;
  split_type?: string | null;
  quantity: number;
  sale_price: number;
  delivery_type: string;
  device_type: string | null;
  notes: string | null;
}

interface Props {
  order: OrderData;
  onClose: () => void;
  onUpdated: () => void;
}

export default function EditOrderDialog({ order, onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(false);
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<{ id: string; name: string; contact_phone: string | null }[]>([]);
  const [contactOpen, setContactOpen] = useState(false);

  const [form, setForm] = useState({
    platform_id: order.contact_id ? "__contact__" : (order.platform_id || ""),
    contact_id: (order as any).contact_id || "",
    order_ref: order.order_ref || "",
    buyer_name: order.buyer_name || "",
    buyer_phone: order.buyer_phone || "",
    buyer_email: order.buyer_email || "",
    category: order.category || "",
    block: (order as any).block || "",
    split_type: (order as any).split_type || "",
    quantity: String(order.quantity),
    sale_price: String(order.sale_price),
    delivery_type: order.delivery_type as "mobile_transfer" | "email",
    device_type: order.device_type || "",
    notes: order.notes || "",
  });

  useEffect(() => {
    supabase.from("platforms").select("id, name").then(({ data }) => setPlatforms(data || []));
    supabase.from("suppliers").select("id, name, contact_phone").then(({ data }) => setContacts(data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isContactSource = form.platform_id === "__contact__" && form.contact_id;
      const wasContactSource = !!(order as any).contact_id;

      const { error } = await supabase
        .from("orders")
        .update({
          platform_id: isContactSource ? null : (form.platform_id || null),
          contact_id: isContactSource ? form.contact_id : null,
          order_ref: form.order_ref || null,
          buyer_name: form.buyer_name || null,
          buyer_phone: form.buyer_phone || null,
          buyer_email: form.buyer_email || null,
          category: form.category || "General",
          block: form.block || null,
          split_type: form.split_type || null,
          quantity: parseInt(form.quantity),
          sale_price: parseFloat(form.sale_price),
          delivery_type: form.delivery_type,
          device_type: form.device_type || null,
          notes: form.notes || null,
        } as any)
        .eq("id", order.id);
      if (error) throw error;

      // Handle balance_payments sync
      const autoNotes = `Auto: Order ${order.id}`;
      if (isContactSource) {
        // Delete old balance entry and create new one
        await supabase.from("balance_payments").delete().ilike("notes", autoNotes);
        const contactName = contacts.find(c => c.id === form.contact_id)?.name || "Unknown";
        await supabase.from("balance_payments").insert({
          party_type: "supplier",
          party_id: form.contact_id,
          amount: parseFloat(form.sale_price) * parseInt(form.quantity),
          type: "adjustment",
          notes: autoNotes,
          contact_name: contactName,
        } as any);
      } else if (wasContactSource) {
        // Switched away from contact — delete balance entry
        await supabase.from("balance_payments").delete().ilike("notes", autoNotes);
      }

      toast.success("Order updated");
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={form.platform_id} onValueChange={(v) => {
              if (v === "__contact__") {
                setForm({ ...form, platform_id: "__contact__" });
              } else {
                setForm({ ...form, platform_id: v, contact_id: "" });
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__contact__">Contact</SelectItem>
                {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.platform_id === "__contact__" && (
            <div className="space-y-1.5">
              <Label>Contact *</Label>
              <Popover open={contactOpen} onOpenChange={setContactOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {contacts.find(c => c.id === form.contact_id)?.name || "Search contacts..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Type name..." />
                    <CommandList>
                      <CommandEmpty>No contact found.</CommandEmpty>
                      <CommandGroup>
                        {contacts.map((c) => (
                          <CommandItem key={c.id} value={c.name} onSelect={() => {
                            setForm(f => ({ ...f, contact_id: c.id, buyer_name: c.name, buyer_phone: c.contact_phone || f.buyer_phone }));
                            setContactOpen(false);
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", form.contact_id === c.id ? "opacity-100" : "opacity-0")} />
                            <span className="font-medium">{c.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Order Number</Label>
            <Input value={form.order_ref} onChange={(e) => setForm({ ...form, order_ref: e.target.value })} placeholder="e.g. ORD-123" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Customer Name</Label>
              <Input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Customer Phone</Label>
              <Input value={form.buyer_phone} onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Customer Email</Label>
            <Input value={form.buyer_email} onChange={(e) => setForm({ ...form, buyer_email: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {["Cat 1", "Cat 2", "Cat 3", "Cat 4"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  {STANDARD_SECTIONS.map((s) => <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>)}
                  {HOSPITALITY_OPTIONS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Block</Label>
              <Input value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} placeholder="e.g. 305" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Price per Ticket (£)</Label>
              <Input type="number" step="0.01" min="0" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Split Type</Label>
              <Select value={form.split_type} onValueChange={(v) => setForm({ ...form, split_type: v })}>
                <SelectTrigger><SelectValue placeholder="Split" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="singles">Singles</SelectItem>
                  <SelectItem value="pairs">Pairs</SelectItem>
                  <SelectItem value="trios">Trios</SelectItem>
                  <SelectItem value="quads">Quads</SelectItem>
                  <SelectItem value="all_together">All Together</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Delivery</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={form.delivery_type === "mobile_transfer" ? "default" : "outline"} className="flex-1 gap-1.5" onClick={() => setForm({ ...form, delivery_type: "mobile_transfer" })}>
                <Smartphone className="h-3.5 w-3.5" /> Phone
              </Button>
              <Button type="button" size="sm" variant={form.delivery_type === "email" ? "default" : "outline"} className="flex-1 gap-1.5" onClick={() => setForm({ ...form, delivery_type: "email" })}>
                <Link2 className="h-3.5 w-3.5" /> Link
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>

          <div className="sticky bottom-0 bg-background pt-3 pb-1 -mx-6 px-6 border-t border-border mt-2">
            <Button type="submit" className="w-full" disabled={loading || !form.sale_price}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
