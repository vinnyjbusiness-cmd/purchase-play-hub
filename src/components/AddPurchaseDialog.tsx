import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CLUBS, STANDARD_SECTIONS, HOSPITALITY_OPTIONS } from "@/lib/seatingSections";
import { format } from "date-fns";

interface Props {
  onCreated: () => void;
}

interface EventRow {
  id: string;
  match_code: string;
  home_team: string;
  away_team: string;
  event_date: string;
}

export default function AddPurchaseDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);

  const [form, setForm] = useState({
    club: "",
    event_id: "",
    supplier_id: "",
    supplier_name: "",
    supplier_number: "",
    category_type: "" as "" | "standard" | "hospitality",
    section: "",
    block: "",
    hospitality_option: "",
    supplier_order_id: "",
    quantity: "1",
    unit_cost: "",
    notes: "",
  });

  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id);
  const isTrade = selectedSupplier?.name?.toLowerCase() === "trade";
  const isWebsites = selectedSupplier?.name?.toLowerCase() === "websites";

  const selectedSection = STANDARD_SECTIONS.find((s) => s.label === form.section);

  useEffect(() => {
    if (open) {
      supabase.from("suppliers").select("id, name").then(({ data }) => {
        // Only keep Website and Trade suppliers
        const filtered = (data || []).filter(
          (s) => s.name.toLowerCase() === "websites" || s.name.toLowerCase() === "trade"
        );
        setSuppliers(filtered);
      });
      supabase
        .from("events")
        .select("id, match_code, home_team, away_team, event_date")
        .order("event_date", { ascending: true })
        .then(({ data }) => setEvents(data || []));
    }
  }, [open]);

  // Filter events by selected club
  const filteredEvents = useMemo(() => {
    if (!form.club) return [];
    const club = CLUBS.find((c) => c.value === form.club);
    if (!club) return [];

    return events.filter((e) => {
      if (club.value === "world-cup") {
        const mc = e.match_code.toLowerCase();
        return mc.includes("stadium") || e.home_team.includes("TBC") || e.away_team.includes("TBC") || mc.includes("world-cup") || mc.includes("world cup");
      }
      const search = club.label.toLowerCase();
      return e.home_team.toLowerCase().includes(search) || e.away_team.toLowerCase().includes(search);
    });
  }, [form.club, events]);

  const resetForm = () => {
    setForm({
      club: "",
      event_id: "",
      supplier_id: "",
      supplier_name: "",
      supplier_number: "",
      category_type: "",
      section: "",
      block: "",
      hospitality_option: "",
      supplier_order_id: "",
      quantity: "1",
      unit_cost: "",
      notes: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplier_id || !form.event_id || !form.unit_cost || !form.category_type) return;
    setLoading(true);
    try {
      const noteParts: string[] = [];
      if (isTrade && form.supplier_name.trim()) noteParts.push(`Name: ${form.supplier_name.trim()}`);
      if (isTrade && form.supplier_number.trim()) noteParts.push(`Phone: ${form.supplier_number.trim()}`);
      if (isWebsites && form.supplier_name.trim()) noteParts.push(`Website: ${form.supplier_name.trim()}`);
      if (form.notes.trim()) noteParts.push(form.notes.trim());

      // Build category string
      let category = "";
      if (form.category_type === "hospitality") {
        category = form.hospitality_option || "Hospitality";
      } else {
        category = form.section || "Standard Seating";
      }

      // Store block in section field
      const section = form.category_type === "standard" ? form.block || null : null;

      const { error } = await supabase.from("purchases").insert({
        supplier_id: form.supplier_id,
        event_id: form.event_id,
        supplier_order_id: form.supplier_order_id || null,
        category,
        section,
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
      resetForm();
      setOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (key: string, value: string) => {
    const updates: Record<string, string> = { [key]: value };
    // Reset dependent fields
    if (key === "club") updates.event_id = "";
    if (key === "category_type") {
      updates.section = "";
      updates.block = "";
      updates.hospitality_option = "";
    }
    if (key === "section") updates.block = "";
    setForm((f) => ({ ...f, ...updates }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Purchase</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Purchase</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Club & Event */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Club / Tournament *</Label>
              <Select value={form.club} onValueChange={(v) => set("club", v)}>
                <SelectTrigger><SelectValue placeholder="Select club" /></SelectTrigger>
                <SelectContent>
                  {CLUBS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Event *</Label>
              <Select value={form.event_id} onValueChange={(v) => set("event_id", v)} disabled={!form.club}>
                <SelectTrigger><SelectValue placeholder={form.club ? "Select event" : "Pick a club first"} /></SelectTrigger>
                <SelectContent>
                  {filteredEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {format(new Date(e.event_date), "dd MMM yy")} — {e.home_team} vs {e.away_team}
                    </SelectItem>
                  ))}
                  {filteredEvents.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No events found</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Supplier */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={(v) => set("supplier_id", v)}>
                <SelectTrigger><SelectValue placeholder="Website or Trade" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Order ID</Label>
              <Input
                value={form.supplier_order_id}
                onChange={(e) => set("supplier_order_id", e.target.value)}
                placeholder="e.g. ORD-1234"
                maxLength={100}
              />
            </div>
          </div>

          {/* Trade fields */}
          {isTrade && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={form.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} placeholder="e.g. John Smith" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label>Number</Label>
                <Input value={form.supplier_number} onChange={(e) => set("supplier_number", e.target.value)} placeholder="e.g. +44 7700 900000" maxLength={20} />
              </div>
            </div>
          )}

          {/* Website field */}
          {isWebsites && (
            <div className="space-y-1.5">
              <Label>Website Name</Label>
              <Input value={form.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} placeholder="e.g. Tixstock, FanPass" maxLength={100} />
            </div>
          )}

          {/* Row 3: Category Type */}
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={form.category_type} onValueChange={(v) => set("category_type", v)}>
              <SelectTrigger><SelectValue placeholder="Standard Seating or Hospitality" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard Seating</SelectItem>
                <SelectItem value="hospitality">Hospitality</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Standard: Section + Block */}
          {form.category_type === "standard" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Section</Label>
                <Select value={form.section} onValueChange={(v) => set("section", v)}>
                  <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent>
                    {STANDARD_SECTIONS.map((s) => (
                      <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Block</Label>
                <Select value={form.block} onValueChange={(v) => set("block", v)} disabled={!form.section}>
                  <SelectTrigger><SelectValue placeholder={form.section ? "Select block" : "Pick section first"} /></SelectTrigger>
                  <SelectContent>
                    {selectedSection?.blocks.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Hospitality: Package */}
          {form.category_type === "hospitality" && (
            <div className="space-y-1.5">
              <Label>Hospitality Package</Label>
              <Select value={form.hospitality_option} onValueChange={(v) => set("hospitality_option", v)}>
                <SelectTrigger><SelectValue placeholder="Select package" /></SelectTrigger>
                <SelectContent>
                  {HOSPITALITY_OPTIONS.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Row 4: Quantity & Cost */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cost Per Ticket *</Label>
              <Input type="number" step="0.01" min="0" value={form.unit_cost} onChange={(e) => set("unit_cost", e.target.value)} placeholder="0.00" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional info..." maxLength={500} rows={2} />
          </div>

          <Button type="submit" className="w-full" disabled={loading || !form.supplier_id || !form.event_id || !form.unit_cost || !form.category_type}>
            {loading ? "Saving..." : "Add Purchase"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
