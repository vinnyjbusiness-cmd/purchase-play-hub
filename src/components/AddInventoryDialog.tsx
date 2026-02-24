import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useOrg } from "@/hooks/useOrg";
import { VENUES, getVenue } from "@/lib/seatingSections";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

interface EventRow {
  id: string;
  match_code: string;
  home_team: string;
  away_team: string;
  event_date: string;
  venue: string | null;
  competition: string;
}

export default function AddInventoryDialog({ onClose, onCreated }: Props) {
  const { orgId } = useOrg();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [venue, setVenue] = useState("");
  const [eventId, setEventId] = useState("");
  const [sourcePurchase, setSourcePurchase] = useState("");
  const [category, setCategory] = useState<"GA" | "HOSPO">("GA");
  const [section, setSection] = useState("");
  const [block, setBlock] = useState("");
  const [rowName, setRowName] = useState("");
  const [seat, setSeat] = useState("");
  const [faceValue, setFaceValue] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  // We need to find the purchase_id. Since source purchase is now text-based,
  // we'll try to match or just use a placeholder approach.
  const [purchases, setPurchases] = useState<{ id: string; supplier_order_id: string | null }[]>([]);

  useEffect(() => {
    const now = new Date().toISOString();
    supabase
      .from("events")
      .select("id, match_code, home_team, away_team, event_date, venue, competition")
      .gte("event_date", now)
      .order("event_date")
      .then(({ data }) => setEvents(data || []));
  }, []);

  // Filter events based on selected venue
  const filteredEvents = useMemo(() => {
    if (!venue) return [];
    const venueConfig = getVenue(venue);
    if (!venueConfig) return events;
    // World Cup matches all WC events, club names match home_team
    if (venue === "world-cup") {
      return events.filter(e => e.competition?.toLowerCase().includes("world cup"));
    }
    const clubName = venueConfig.label.split(" (")[0].toLowerCase();
    return events.filter(e =>
      e.home_team?.toLowerCase().includes(clubName) ||
      e.venue?.toLowerCase().includes(clubName)
    );
  }, [venue, events]);

  // Load purchases for selected event
  useEffect(() => {
    if (!eventId) { setPurchases([]); return; }
    supabase
      .from("purchases")
      .select("id, supplier_order_id")
      .eq("event_id", eventId)
      .then(({ data }) => setPurchases(data || []));
  }, [eventId]);

  const venueConfig = getVenue(venue);

  const gaSections = venueConfig?.sections.GA || [];
  const hospoOptions = venueConfig?.sections.HOSPO || [];

  const selectedGaSection = gaSections.find(s => s.label === section);
  const blocks = selectedGaSection?.blocks || [];

  const handleSubmit = async () => {
    if (!eventId) { toast.error("Select an event"); return; }
    setLoading(true);

    // Try to find a matching purchase by supplier_order_id, or use the first purchase for this event
    let purchaseId = purchases.find(p => p.supplier_order_id === sourcePurchase)?.id;
    if (!purchaseId && purchases.length > 0) purchaseId = purchases[0].id;
    if (!purchaseId) {
      toast.error("No purchase found for this event. Create a purchase first.");
      setLoading(false);
      return;
    }

    const rows = Array.from({ length: quantity }, () => ({
      event_id: eventId,
      purchase_id: purchaseId!,
      category: category === "HOSPO" ? `HOSPO — ${section}` : "GA",
      section: category === "GA" ? section : null,
      block: category === "GA" ? (block || null) : null,
      row_name: rowName || null,
      seat: seat || null,
      face_value: faceValue ? parseFloat(faceValue) : null,
      org_id: orgId,
      status: "available" as const,
    }));
    const { error } = await supabase.from("inventory").insert(rows);
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success(`${quantity} ticket${quantity !== 1 ? "s" : ""} added`);
    setLoading(false);
    onCreated();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Inventory</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Venue / Club */}
          <div className="space-y-1.5">
            <Label>Club / Venue</Label>
            <Select value={venue} onValueChange={(v) => { setVenue(v); setEventId(""); setSection(""); setBlock(""); }}>
              <SelectTrigger><SelectValue placeholder="Select venue" /></SelectTrigger>
              <SelectContent>
                {VENUES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Event (filtered by venue, no past games) */}
          <div className="space-y-1.5">
            <Label>Event</Label>
            <Select value={eventId} onValueChange={setEventId} disabled={!venue}>
              <SelectTrigger><SelectValue placeholder={venue ? "Select event" : "Select venue first"} /></SelectTrigger>
              <SelectContent>
                {filteredEvents.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.match_code} — {e.home_team} vs {e.away_team}
                  </SelectItem>
                ))}
                {filteredEvents.length === 0 && venue && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">No upcoming events for this venue</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Source Purchase (free-text) */}
          <div className="space-y-1.5">
            <Label>Source Purchase Reference</Label>
            <Input
              value={sourcePurchase}
              onChange={e => setSourcePurchase(e.target.value)}
              placeholder="Type purchase reference..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => { setCategory(v as "GA" | "HOSPO"); setSection(""); setBlock(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GA">GA (General Admission)</SelectItem>
                  <SelectItem value="HOSPO">HOSPO (Hospitality)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            </div>
          </div>

          {/* Section (depends on category & venue) */}
          <div className="space-y-1.5">
            <Label>Section</Label>
            {category === "GA" ? (
              <Select value={section} onValueChange={(v) => { setSection(v); setBlock(""); }} disabled={!venue}>
                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  {gaSections.map(s => <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Select value={section} onValueChange={setSection} disabled={!venue}>
                <SelectTrigger><SelectValue placeholder="Select hospitality package" /></SelectTrigger>
                <SelectContent>
                  {hospoOptions.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Block (only for GA) */}
          {category === "GA" && (
            <div className="space-y-1.5">
              <Label>Block</Label>
              <Select value={block} onValueChange={setBlock} disabled={!section}>
                <SelectTrigger><SelectValue placeholder="Select block" /></SelectTrigger>
                <SelectContent>
                  {blocks.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Row</Label>
              <Input value={rowName} onChange={e => setRowName(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Seat</Label>
              <Input value={seat} onChange={e => setSeat(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Face Value (£)</Label>
              <Input type="number" min={0} step="0.01" value={faceValue} onChange={e => setFaceValue(e.target.value)} placeholder="0.00" />
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
