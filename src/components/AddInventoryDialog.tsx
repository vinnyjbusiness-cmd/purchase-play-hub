import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useOrg } from "@/hooks/useOrg";
import { VENUES, getVenue } from "@/lib/seatingSections";
import { Upload } from "lucide-react";

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
  const [category, setCategory] = useState<"GA" | "HOSPO">("GA");
  const [section, setSection] = useState("");
  const [block, setBlock] = useState("");
  const [rowName, setRowName] = useState("");
  const [seat, setSeat] = useState("");
  const [faceValue, setFaceValue] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [ticketName, setTicketName] = useState("");
  const [supporterId, setSupporterId] = useState("");
  const [iphonePassLink, setIphonePassLink] = useState("");
  const [androidPassLink, setAndroidPassLink] = useState("");
  const [pkPassFile, setPkPassFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const now = new Date().toISOString();
    supabase
      .from("events")
      .select("id, match_code, home_team, away_team, event_date, venue, competition")
      .gte("event_date", now)
      .order("event_date")
      .then(({ data }) => setEvents(data || []));
  }, []);

  const filteredEvents = useMemo(() => {
    if (!venue) return [];
    const venueConfig = getVenue(venue);
    if (!venueConfig) return events;
    if (venue === "world-cup") {
      return events.filter(e => e.competition?.toLowerCase().includes("world cup"));
    }
    const clubName = venueConfig.label.split(" (")[0].toLowerCase();
    return events.filter(e =>
      e.home_team?.toLowerCase().includes(clubName) ||
      e.venue?.toLowerCase().includes(clubName)
    );
  }, [venue, events]);

  const venueConfig = getVenue(venue);
  const gaSections = venueConfig?.sections.GA || [];
  const hospoOptions = venueConfig?.sections.HOSPO || [];
  const selectedGaSection = gaSections.find(s => s.label === section);
  const blocks = selectedGaSection?.blocks || [];

  const handlePkPassUpload = async (): Promise<string | null> => {
    if (!pkPassFile) return null;
    const path = `pk-passes/${orgId}/${Date.now()}-${pkPassFile.name}`;
    const { error } = await supabase.storage.from("logos").upload(path, pkPassFile);
    if (error) { toast.error("Failed to upload PK pass"); return null; }
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!eventId) { toast.error("Select an event"); return; }
    setLoading(true);

    let pkPassUrl: string | null = null;
    if (pkPassFile) {
      pkPassUrl = await handlePkPassUpload();
    }

    const rows = Array.from({ length: quantity }, () => ({
      event_id: eventId,
      purchase_id: null,
      category: category === "HOSPO" ? `HOSPO — ${section}` : "GA",
      section: category === "GA" ? section : null,
      block: category === "GA" ? (block || null) : null,
      row_name: rowName || null,
      seat: seat || null,
      face_value: faceValue ? parseFloat(faceValue) : null,
      ticket_name: ticketName || null,
      supporter_id: supporterId || null,
      iphone_pass_link: iphonePassLink || null,
      android_pass_link: androidPassLink || null,
      pk_pass_url: pkPassUrl,
      org_id: orgId,
      status: "available" as const,
    }));
    const { error } = await supabase.from("inventory").insert(rows);
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success(`${quantity} ticket${quantity !== 1 ? "s" : ""} added`);
    setLoading(false);
    onCreated();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".pkpass") || file.name.endsWith(".pk"))) {
      setPkPassFile(file);
    } else {
      toast.error("Please drop a .pkpass file");
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          {/* Event */}
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
                  <div className="px-3 py-2 text-sm text-muted-foreground">No upcoming events</div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Name & Supporter ID */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={ticketName} onChange={e => setTicketName(e.target.value)} placeholder="Ticket holder name" />
            </div>
            <div className="space-y-1.5">
              <Label>Supporter ID</Label>
              <Input value={supporterId} onChange={e => setSupporterId(e.target.value)} placeholder="e.g. LFC-12345" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            </div>
          </div>

          {/* Section */}
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

          {/* Block (GA only) */}
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

          {/* Pass Links */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>iPhone Pass Link</Label>
              <Input value={iphonePassLink} onChange={e => setIphonePassLink(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label>Android Pass Link</Label>
              <Input value={androidPassLink} onChange={e => setAndroidPassLink(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          {/* PK Pass Upload */}
          <div className="space-y-1.5">
            <Label>PK Pass File</Label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pkpass,.pk"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPkPassFile(file);
                }}
              />
              {pkPassFile ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Upload className="h-4 w-4 text-primary" />
                  <span className="font-medium">{pkPassFile.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setPkPassFile(null); }} className="text-muted-foreground hover:text-destructive ml-2">✕</button>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <Upload className="h-5 w-5 mx-auto mb-1 opacity-50" />
                  Drag & drop .pkpass file or click to browse
                </div>
              )}
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
