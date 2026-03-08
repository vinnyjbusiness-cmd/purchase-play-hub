import { useState, useEffect } from "react";
import { formatEventLabel, getMatchNumber } from "@/lib/eventDisplay";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Smartphone, Link2, ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";
import { STANDARD_SECTIONS, HOSPITALITY_OPTIONS, CLUBS } from "@/lib/seatingSections";
import { deduplicateEvents } from "@/lib/eventDedup";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import InlineAddContact from "@/components/InlineAddContact";

interface Props {
  onCreated: () => void;
  defaultClub?: string;
}

interface ContactRow {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
}

export default function AddOrderDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);
  const [events, setEvents] = useState<{ id: string; match_code: string; home_team: string; away_team: string; event_date: string; competition: string }[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactOpen, setContactOpen] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

  const [form, setForm] = useState({
    platform_id: "",
    club: "",
    event_id: "",
    order_ref: "",
    contact_id: "",
    buyer_name: "",
    buyer_phone: "",
    category: "",
    block: "",
    split_type: "",
    quantity: "1",
    sale_price: "",
    delivery_type: "mobile_transfer" as "mobile_transfer" | "email",
    notes: "",
  });

  const isWorldCup = form.club === "world-cup";

  const [eventOpen, setEventOpen] = useState(false);

  const filteredEvents = (() => {
    const matched = events.filter((e) => {
      if (!form.club) return false;
      if (form.club === "world-cup") {
        // Only show WC events with match numbers 1-104
        if (!e.match_code) return false;
        const m = e.match_code.match(/^(?:WC2026-M|#M)(\d+)/);
        if (!m) return false;
        const num = parseInt(m[1]);
        return num >= 1 && num <= 104;
      }
      const clubLabel = CLUBS.find((c) => c.value === form.club)?.label || "";
      const clubName = clubLabel.split(" (")[0].toLowerCase();
      return e.home_team.toLowerCase().includes(clubName) || e.away_team.toLowerCase().includes(clubName);
    });
    const deduped = deduplicateEvents(matched).unique;
    if (form.club === "world-cup") {
      // Sort by match number
      return deduped.sort((a, b) => {
        const numA = parseInt((a.match_code?.match(/^(?:WC2026-M|#M)(\d+)/)?.[1]) || "0");
        const numB = parseInt((b.match_code?.match(/^(?:WC2026-M|#M)(\d+)/)?.[1]) || "0");
        return numA - numB;
      });
    }
    return deduped;
  })();

  useEffect(() => {
    if (open) {
      supabase.from("platforms").select("id, name").then(({ data }) => setPlatforms(data || []));
      supabase.from("events").select("id, match_code, home_team, away_team, event_date, competition").order("event_date").then(({ data }) => setEvents(data || []));
      supabase.from("suppliers").select("id, name, contact_phone, contact_email").then(({ data }) => setContacts(data || []));
    }
  }, [open]);

  useEffect(() => {
    setForm((f) => ({ ...f, event_id: "", category: "" }));
  }, [form.club]);

  const handleSelectContact = (contact: ContactRow) => {
    setForm((f) => ({
      ...f,
      contact_id: contact.id,
      buyer_name: contact.name,
      buyer_phone: contact.contact_phone || "",
    }));
    setContactOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isContactSource = form.platform_id === "__contact__" && form.contact_id;
      const { data: insertedOrder, error } = await supabase.from("orders").insert({
        platform_id: isContactSource ? null : (form.platform_id || null),
        contact_id: isContactSource ? form.contact_id : null,
        event_id: form.event_id,
        order_ref: form.order_ref || null,
        buyer_name: form.buyer_name || null,
        buyer_phone: form.buyer_phone || null,
        category: form.category || "General",
        block: form.block || null,
        split_type: form.split_type || null,
        quantity: parseInt(form.quantity),
        sale_price: parseFloat(form.sale_price),
        fees: 0,
        currency: "GBP",
        delivery_type: form.delivery_type,
        notes: form.notes || null,
      } as any).select().single();
      if (error) throw error;

      // Auto-create balance entry for contact-sourced orders
      if (isContactSource && insertedOrder) {
        const contactName = contacts.find(c => c.id === form.contact_id)?.name || "Unknown";
        await supabase.from("balance_payments").insert({
          party_type: "supplier",
          party_id: form.contact_id,
          amount: parseFloat(form.sale_price) * parseInt(form.quantity),
          type: "adjustment",
          notes: `Auto: Order ${insertedOrder.id}`,
          contact_name: contactName,
        } as any);
      }

      toast.success("Order added");
      setOpen(false);
      setForm({
        platform_id: "", club: "", event_id: "", order_ref: "", contact_id: "",
        buyer_name: "", buyer_phone: "", category: "", block: "", split_type: "",
        quantity: "1", sale_price: "", delivery_type: "mobile_transfer", notes: "",
      });
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedContact = contacts.find((c) => c.id === form.contact_id);

  // Helper to clean WC event names for display
  const cleanEventLabel = (e: typeof events[number]) => {
    const matchNum = getMatchNumber(e.match_code);
    if (matchNum && e.home_team.startsWith("#M")) {
      const homeMatch = e.home_team.match(/^#M\d+\s*-\s*\((?:Group\s+\w+\s*-\s*)?(.+)$/);
      const awayMatch = e.away_team.match(/^(.+?)\)\s*Football World Cup/);
      const cleanHome = homeMatch ? homeMatch[1].trim() : e.home_team;
      const cleanAway = awayMatch ? awayMatch[1].trim() : e.away_team;
      const d = new Date(e.event_date);
      const dateStr = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
      return `M${matchNum} — ${cleanHome} vs ${cleanAway} — ${dateStr}`;
    }
    return formatEventLabel(e.home_team, e.away_team, e.event_date, e.match_code);
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
          {/* Platform / Source */}
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={form.platform_id} onValueChange={(v) => {
              if (v === "__contact__") {
                setForm({ ...form, platform_id: "__contact__" });
              } else {
                setForm({ ...form, platform_id: v, contact_id: "", buyer_name: "", buyer_phone: "" });
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__contact__">Contact</SelectItem>
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
              <Popover open={eventOpen} onOpenChange={setEventOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={!form.club}>
                    {form.event_id
                      ? (() => {
                          const ev = filteredEvents.find((e) => e.id === form.event_id);
                          return ev ? cleanEventLabel(ev) : "Select event";
                        })()
                      : (form.club ? "Search event..." : "Pick club first")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Type M1, M42..." />
                    <CommandList>
                      <CommandEmpty>No event found.</CommandEmpty>
                      <CommandGroup>
                        {filteredEvents.map((e) => {
                          const label = cleanEventLabel(e);
                          return (
                            <CommandItem
                              key={e.id}
                              value={label}
                              onSelect={() => {
                                setForm({ ...form, event_id: e.id });
                                setEventOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", form.event_id === e.id ? "opacity-100" : "opacity-0")} />
                              {label}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Order Number */}
          <div className="space-y-1.5">
            <Label>Order Number</Label>
            <Input value={form.order_ref} onChange={(e) => setForm({ ...form, order_ref: e.target.value })} placeholder="e.g. ORD-123" />
          </div>

          {/* Contact dropdown - only shown when source is Contact */}
          {form.platform_id === "__contact__" && (
          <div className="space-y-1.5">
            <Label>Contact (Source) *</Label>
            <Popover open={contactOpen} onOpenChange={setContactOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedContact ? selectedContact.name : "Search contacts..."}
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
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => handleSelectContact(c)}
                        >
                          <Check className={cn("mr-2 h-4 w-4", form.contact_id === c.id ? "opacity-100" : "opacity-0")} />
                          <span className="font-medium">{c.name}</span>
                        </CommandItem>
                      ))}
                      <CommandItem
                        value="__add_new_contact__"
                        onSelect={() => {
                          setContactOpen(false);
                          setShowAddContact(true);
                        }}
                        className="text-primary"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        <span className="font-medium">Add New Contact</span>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          )}

          {form.platform_id === "__contact__" && showAddContact && (
            <InlineAddContact
              onCancel={() => setShowAddContact(false)}
              onCreated={(contact) => {
                setContacts((prev) => [...prev, contact]);
                handleSelectContact(contact);
                setShowAddContact(false);
              }}
            />
          )}

          {/* Editable name/phone - only for contact source */}
          {form.platform_id === "__contact__" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Customer Name</Label>
              <Input value={form.buyer_name} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} placeholder="e.g. John Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Customer Phone</Label>
              <Input value={form.buyer_phone} onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })} placeholder="e.g. +44 7700 900000" />
            </div>
          </div>
          )}

          {/* Category & Block */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{isWorldCup ? "Category *" : "Section *"}</Label>
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
              <Label>Block</Label>
              <Input value={form.block} onChange={(e) => setForm({ ...form, block: e.target.value })} placeholder="e.g. 305" />
            </div>
          </div>

          {/* Quantity & Split Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Split Type</Label>
              <Select value={form.split_type} onValueChange={(v) => setForm({ ...form, split_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select split" /></SelectTrigger>
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

          {/* Sale Price */}
          <div className="space-y-1.5">
            <Label>Price per Ticket (£) *</Label>
            <Input type="number" step="0.01" min="0" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} placeholder="0.00" />
          </div>

          {/* Delivery Type */}
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

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional info..." rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !form.event_id || !form.sale_price}>
            {loading ? "Saving..." : "Add Order"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
