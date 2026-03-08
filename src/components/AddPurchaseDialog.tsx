import { useState, useEffect, useMemo } from "react";
import { formatEventLabel } from "@/lib/eventDisplay";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, ChevronsUpDown, Check } from "lucide-react";
import { toast } from "sonner";
import { CLUBS, STANDARD_SECTIONS, HOSPITALITY_OPTIONS } from "@/lib/seatingSections";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import InlineAddContact from "@/components/InlineAddContact";

interface Props {
  onCreated: () => void;
  defaultClub?: string;
}

interface EventRow {
  id: string;
  match_code: string;
  home_team: string;
  away_team: string;
  event_date: string;
  competition: string;
}

interface SupplierRow {
  id: string;
  name: string;
  display_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
}

export default function AddPurchaseDialog({ onCreated, defaultClub }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

  const [form, setForm] = useState({
    club: defaultClub || "",
    event_id: "",
    supplier_id: "",
    supplier_name: "",
    supplier_number: "",
    category_type: "" as "" | "standard" | "hospitality",
    section: "",
    block: "",
    hospitality_option: "",
    currency: "GBP",
    quantity: "1",
    unit_cost: "",
    split_type: "",
    notes: "",
  });

  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id);
  const isTrade = selectedSupplier?.name?.toLowerCase() === "trade";

  const selectedSection = STANDARD_SECTIONS.find((s) => s.label === form.section);
  const isWorldCup = form.club === "world-cup";

  useEffect(() => {
    if (open) {
      supabase.from("suppliers").select("id, name, display_id, contact_name, contact_phone").then(({ data }) => {
        // Filter out "websites" — suppliers only
        setSuppliers((data || []).filter(s => s.name.toLowerCase() !== "websites"));
      });
      supabase
        .from("events")
        .select("id, match_code, home_team, away_team, event_date, competition")
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
        return e.competition?.toLowerCase().includes("world cup");
      }
      const search = club.label.split(" (")[0].toLowerCase();
      return e.home_team.toLowerCase().includes(search) || e.away_team.toLowerCase().includes(search);
    });
  }, [form.club, events]);

  const resetForm = () => {
    setForm({
      club: defaultClub || "", event_id: "", supplier_id: "", supplier_name: "", supplier_number: "",
      category_type: "", section: "", block: "", hospitality_option: "",
      currency: "GBP", quantity: "1", unit_cost: "", split_type: "", notes: "",
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
      if (form.notes.trim()) noteParts.push(form.notes.trim());

      let category = "";
      if (isWorldCup) {
        category = form.category_type;
      } else if (form.category_type === "hospitality") {
        category = form.hospitality_option || "Hospitality";
      } else {
        category = form.section || "Standard Seating";
      }

      const section = form.category_type === "standard" ? form.block || null : null;

      const { data: inserted, error } = await supabase.from("purchases").insert({
        supplier_id: form.supplier_id,
        event_id: form.event_id,
        category,
        section,
        quantity: parseInt(form.quantity),
        unit_cost: parseFloat(form.unit_cost),
        fees: 0,
        currency: form.currency as "GBP" | "USD" | "EUR",
        exchange_rate: 1,
        status: "confirmed" as const,
        split_type: form.split_type || null,
        notes: noteParts.length > 0 ? noteParts.join(" | ") : null,
      } as any).select("id").single();
      if (error) throw error;

      // Auto-create inventory records
      const inventoryRows = Array.from({ length: parseInt(form.quantity) }, () => ({
        event_id: form.event_id,
        purchase_id: inserted.id,
        category,
        section,
        face_value: parseFloat(form.unit_cost),
        source: selectedSupplier?.name || "IJK",
        split_type: form.split_type || null,
        status: "available" as const,
      }));
      await supabase.from("inventory").insert(inventoryRows as any);

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
    if (key === "club") {
      updates.event_id = "";
      updates.currency = value === "world-cup" ? "USD" : "GBP";
    }
    if (key === "category_type") {
      updates.section = "";
      updates.block = "";
      updates.hospitality_option = "";
    }
    if (key === "section") updates.block = "";
    if (key === "supplier_id") {
      // Auto-fill contact info from supplier
      const sup = suppliers.find(s => s.id === value);
      if (sup) {
        updates.supplier_name = sup.contact_name || "";
        updates.supplier_number = sup.contact_phone || "";
      }
    }
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
          {/* Club & Event */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Club / Tournament *</Label>
              {defaultClub ? (
                <Input value={CLUBS.find(c => c.value === defaultClub)?.label || defaultClub} disabled className="bg-muted" />
              ) : (
                <Select value={form.club} onValueChange={(v) => set("club", v)}>
                  <SelectTrigger><SelectValue placeholder="Select club" /></SelectTrigger>
                  <SelectContent>
                    {CLUBS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Event *</Label>
              <Select value={form.event_id} onValueChange={(v) => set("event_id", v)} disabled={!form.club}>
                <SelectTrigger><SelectValue placeholder={form.club ? "Select event" : "Pick a club first"} /></SelectTrigger>
                <SelectContent>
                  {filteredEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {formatEventLabel(e.home_team, e.away_team, e.event_date, e.match_code)}
                    </SelectItem>
                  ))}
                  {filteredEvents.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No events found</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Searchable Supplier dropdown */}
          <div className="space-y-1.5">
            <Label>Contact *</Label>
            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedSupplier ? selectedSupplier.name : "Search contacts..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Type name or code..." />
                  <CommandList>
                    <CommandEmpty>No contact found.</CommandEmpty>
                    <CommandGroup>
                      {suppliers.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={`${s.name} ${s.display_id || ""}`}
                          onSelect={() => {
                            set("supplier_id", s.id);
                            setSupplierOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", form.supplier_id === s.id ? "opacity-100" : "opacity-0")} />
                          <span className="font-medium">{s.name}</span>
                        </CommandItem>
                      ))}
                      <CommandItem
                        value="__add_new_contact__"
                        onSelect={() => {
                          setSupplierOpen(false);
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

          {showAddContact && (
            <InlineAddContact
              onCancel={() => setShowAddContact(false)}
              onCreated={(contact) => {
                setSuppliers((prev) => [...prev, { id: contact.id, name: contact.name, display_id: null, contact_name: null, contact_phone: contact.contact_phone }]);
                set("supplier_id", contact.id);
                setShowAddContact(false);
              }}
            />
          )}

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

          {/* Currency selector for World Cup */}
          {isWorldCup && (
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category */}
          {isWorldCup ? (
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={form.category_type} onValueChange={(v) => set("category_type", v)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {["Cat 1", "Cat 2", "Cat 3", "Cat 4"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
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
            </>
          )}

          {/* Quantity, Cost & Split Type */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cost Per Ticket *</Label>
              <Input type="number" step="0.01" min="0" value={form.unit_cost} onChange={(e) => set("unit_cost", e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Split Type
                <TooltipProvider><Tooltip><TooltipTrigger asChild><span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-muted-foreground text-[10px] cursor-help">?</span></TooltipTrigger><TooltipContent className="max-w-[200px]"><p className="text-xs">Singles = 1 ticket each · Pairs = 2 together · Trios = 3 together · Quads = 4 together · All Together = entire batch</p></TooltipContent></Tooltip></TooltipProvider>
              </Label>
              <Select value={form.split_type} onValueChange={(v) => set("split_type", v)}>
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
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional info..." maxLength={500} rows={2} />
          </div>

          <div className="space-y-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button type="submit" className="w-full" disabled={loading || !form.supplier_id || !form.event_id || !form.unit_cost || !form.category_type}>
                      {loading ? "Saving..." : "Add Purchase"}
                    </Button>
                  </div>
                </TooltipTrigger>
                {(!form.supplier_id || !form.event_id || !form.unit_cost || !form.category_type) && (
                  <TooltipContent><p className="text-xs">Fill required fields to continue</p></TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <p className="text-[10px] text-muted-foreground text-center">Esc to close · Enter to submit</p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
