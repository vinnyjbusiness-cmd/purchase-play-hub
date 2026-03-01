import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useOrg } from "@/hooks/useOrg";
import { VENUES, getVenue } from "@/lib/seatingSections";
import { ChevronDown, ChevronRight, LayoutGrid, Table2, Upload, X, Plus, FileSpreadsheet } from "lucide-react";

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

export interface TicketEntry {
  id: string;
  row: string;
  seat: string;
  faceValue: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

const createTicket = (): TicketEntry => ({
  id: crypto.randomUUID(),
  row: "",
  seat: "",
  faceValue: "",
  firstName: "",
  lastName: "",
  email: "",
  password: "",
});

export default function AddInventoryDialog({ onClose, onCreated }: Props) {
  const { orgId } = useOrg();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [venue, setVenue] = useState("");
  const [eventId, setEventId] = useState("");
  const [category, setCategory] = useState<"GA" | "HOSPO">("GA");
  const [section, setSection] = useState("");
  const [block, setBlock] = useState("");
  const [splitType, setSplitType] = useState("");
  const [source, setSource] = useState("IJK");
  const [customSource, setCustomSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<TicketEntry[]>([createTicket()]);
  const [quantity, setQuantity] = useState(1);
  const [viewMode, setViewMode] = useState<"cards" | "grid">("cards");
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from("events")
      .select("id, match_code, home_team, away_team, event_date, venue, competition")
      .order("event_date", { ascending: false })
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

  // Sync quantity with tickets array
  const handleQuantityChange = useCallback((newQty: number) => {
    const clamped = Math.max(1, Math.min(newQty, 200));
    setQuantity(clamped);
    setTickets(prev => {
      if (clamped > prev.length) {
        const lastTicket = prev[prev.length - 1];
        const lastSeatNum = parseInt(lastTicket?.seat || "0");
        const additions = Array.from({ length: clamped - prev.length }, (_, i) => {
          const t = createTicket();
          if (!isNaN(lastSeatNum) && lastSeatNum > 0) {
            t.seat = String(lastSeatNum + prev.length + i - (prev.length - 1));
          }
          t.row = lastTicket?.row || "";
          t.faceValue = lastTicket?.faceValue || "";
          return t;
        });
        return [...prev, ...additions];
      }
      return prev.slice(0, clamped);
    });
  }, []);

  // Auto-increment seats when first seat is set
  const handleTicketChange = useCallback((index: number, field: keyof TicketEntry, value: string) => {
    setTickets(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };

      // Auto-fill seats sequentially when changing seat on first ticket
      if (field === "seat" && index === 0) {
        const num = parseInt(value);
        if (!isNaN(num)) {
          for (let i = 1; i < next.length; i++) {
            if (!next[i].seat || next[i].seat === String(num + i - 1)) {
              next[i] = { ...next[i], seat: String(num + i) };
            }
          }
        }
      }
      // Auto-fill row and faceValue from first ticket
      if (field === "row" && index === 0) {
        for (let i = 1; i < next.length; i++) {
          if (!next[i].row) next[i] = { ...next[i], row: value };
        }
      }
      if (field === "faceValue" && index === 0) {
        for (let i = 1; i < next.length; i++) {
          if (!next[i].faceValue) next[i] = { ...next[i], faceValue: value };
        }
      }
      return next;
    });
  }, []);

  const removeTicket = useCallback((index: number) => {
    setTickets(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      setQuantity(next.length);
      return next;
    });
  }, []);

  const addTicketRow = useCallback(() => {
    setTickets(prev => [...prev, createTicket()]);
    setQuantity(prev => prev + 1);
  }, []);

  // CSV Import
  const handleCsvImport = useCallback((text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) { toast.error("CSV needs a header row and at least one data row"); return; }

    const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
    const colMap: Record<string, number> = {};
    const aliases: Record<string, string[]> = {
      row: ["row", "row_name"],
      seat: ["seat", "seat_number"],
      faceValue: ["face_value", "facevalue", "face value", "price"],
      firstName: ["first_name", "firstname", "first name"],
      lastName: ["last_name", "lastname", "last name"],
      email: ["email"],
      password: ["password"],
      section: ["section"],
      block: ["block"],
    };

    for (const [key, names] of Object.entries(aliases)) {
      const idx = header.findIndex(h => names.includes(h));
      if (idx !== -1) colMap[key] = idx;
    }

    const imported: TicketEntry[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      if (cols.every(c => !c)) continue;
      imported.push({
        id: crypto.randomUUID(),
        row: cols[colMap.row] || "",
        seat: cols[colMap.seat] || "",
        faceValue: cols[colMap.faceValue] || "",
        firstName: cols[colMap.firstName] || "",
        lastName: cols[colMap.lastName] || "",
        email: cols[colMap.email] || "",
        password: cols[colMap.password] || "",
      });
      // If section/block found in CSV, set shared fields from first row
      if (i === 1) {
        if (colMap.section !== undefined && cols[colMap.section]) setSection(cols[colMap.section]);
        if (colMap.block !== undefined && cols[colMap.block]) setBlock(cols[colMap.block]);
      }
    }

    if (imported.length === 0) { toast.error("No valid rows found"); return; }
    setTickets(imported);
    setQuantity(imported.length);
    setShowImport(false);
    setCsvText("");
    toast.success(`${imported.length} ticket${imported.length !== 1 ? "s" : ""} imported`);
  }, []);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) handleCsvImport(text);
    };
    reader.readAsText(file);
  }, [handleCsvImport]);

  const validTickets = tickets.filter(t => !removedIds.has(t.id));
  const totalFaceValue = validTickets.reduce((sum, t) => sum + (parseFloat(t.faceValue) || 0), 0);
  const hasErrors = !eventId;

  const handleSubmit = async () => {
    if (!eventId) { toast.error("Select an event"); return; }
    if (validTickets.length === 0) { toast.error("Add at least one ticket"); return; }
    setLoading(true);

    const resolvedSource = source === "__custom__" ? (customSource || "IJK") : source;

    const rows = validTickets.map(t => ({
      event_id: eventId,
      purchase_id: null,
      category: category === "HOSPO" ? `HOSPO — ${section}` : "GA",
      section: category === "GA" ? section : null,
      block: category === "GA" ? (block || null) : null,
      row_name: t.row || null,
      seat: t.seat || null,
      face_value: t.faceValue ? parseFloat(t.faceValue) : null,
      ticket_name: [t.firstName, t.lastName].filter(Boolean).join(" ") || null,
      first_name: t.firstName || null,
      last_name: t.lastName || null,
      supporter_id: null,
      email: t.email || null,
      password: t.password || null,
      iphone_pass_link: null,
      android_pass_link: null,
      pk_pass_url: null,
      org_id: orgId,
      status: "available" as const,
      source: resolvedSource,
      split_type: splitType || null,
    }));

    const { error } = await supabase.from("inventory").insert(rows as any);
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success(`${validTickets.length} ticket${validTickets.length !== 1 ? "s" : ""} added`);
    setLoading(false);
    onCreated();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">Add Inventory</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(!showImport)}
              className="gap-1.5 text-xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Import CSV
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-4">
          {/* CSV Import Panel */}
          {showImport && (
            <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Import from CSV</p>
                <button onClick={() => setShowImport(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Expected columns: Section, Block, Row, Seat, Face Value, First Name, Last Name, Email, Password
              </p>
              <div
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
                onDragOver={(e) => e.preventDefault()}
                className="border rounded-md p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".csv";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFileUpload(file);
                  };
                  input.click();
                }}
              >
                <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Drag & drop .csv or click to browse</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Or paste CSV data</Label>
                <textarea
                  className="w-full h-24 text-xs font-mono rounded-md border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder="row,seat,face_value,first_name,last_name,email,password&#10;A,1,150,John,Smith,john@test.com,pass123"
                />
                <Button size="sm" variant="secondary" onClick={() => handleCsvImport(csvText)} disabled={!csvText.trim()}>
                  Parse & Import
                </Button>
              </div>
            </div>
          )}

          {/* Shared Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Club / Venue</Label>
              <Select value={venue} onValueChange={(v) => { setVenue(v); setEventId(""); setSection(""); setBlock(""); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select venue" /></SelectTrigger>
                <SelectContent>
                  {VENUES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Event</Label>
              <Select value={eventId} onValueChange={setEventId} disabled={!venue}>
                <SelectTrigger className="h-9"><SelectValue placeholder={venue ? "Select event" : "Select venue first"} /></SelectTrigger>
                <SelectContent>
                  {filteredEvents.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.home_team} vs {e.away_team} — {new Date(e.event_date).toLocaleDateString()}
                    </SelectItem>
                  ))}
                  {filteredEvents.length === 0 && venue && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No events found</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={(v) => { setCategory(v as "GA" | "HOSPO"); setSection(""); setBlock(""); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GA">General Admission</SelectItem>
                  <SelectItem value="HOSPO">Hospitality</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Section</Label>
              {category === "GA" ? (
                <Select value={section} onValueChange={(v) => { setSection(v); setBlock(""); }} disabled={!venue}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Section" /></SelectTrigger>
                  <SelectContent>
                    {gaSections.map(s => <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={section} onValueChange={setSection} disabled={!venue}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Package" /></SelectTrigger>
                  <SelectContent>
                    {hospoOptions.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            {category === "GA" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Block</Label>
                <Select value={block} onValueChange={setBlock} disabled={!section}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Block" /></SelectTrigger>
                  <SelectContent>
                    {blocks.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Split Type</Label>
              <Select value={splitType} onValueChange={setSplitType}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IJK">IJK</SelectItem>
                  <SelectItem value="Own">Own</SelectItem>
                  <SelectItem value="__custom__">Other…</SelectItem>
                </SelectContent>
              </Select>
              {source === "__custom__" && (
                <Input value={customSource} onChange={e => setCustomSource(e.target.value)} placeholder="Enter source name" className="h-8 mt-1 text-xs" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={quantity}
                onChange={e => handleQuantityChange(Number(e.target.value))}
                className="h-9"
              />
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-sm font-medium">Tickets ({validTickets.length})</p>
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              <button
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded text-xs ${viewMode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded text-xs ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Table2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Card View */}
          {viewMode === "cards" && (
            <div className="space-y-2">
              {tickets.map((ticket, idx) => {
                if (removedIds.has(ticket.id)) return null;
                const isExpanded = expandedTickets.has(ticket.id);
                return (
                  <div key={ticket.id} className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Ticket {idx + 1}</span>
                      <button
                        onClick={() => removeTicket(idx)}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                        title="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Row</Label>
                        <Input
                          value={ticket.row}
                          onChange={e => handleTicketChange(idx, "row", e.target.value)}
                          className="h-8 text-xs"
                          placeholder="A"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Seat</Label>
                        <Input
                          value={ticket.seat}
                          onChange={e => handleTicketChange(idx, "seat", e.target.value)}
                          className="h-8 text-xs"
                          placeholder={idx === 0 ? "50" : ""}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Face Value (£)</Label>
                        <Input
                          type="number"
                          value={ticket.faceValue}
                          onChange={e => handleTicketChange(idx, "faceValue", e.target.value)}
                          className="h-8 text-xs"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Login Details Collapsible */}
                    <Collapsible open={isExpanded} onOpenChange={() => {
                      setExpandedTickets(prev => {
                        const next = new Set(prev);
                        next.has(ticket.id) ? next.delete(ticket.id) : next.add(ticket.id);
                        return next;
                      });
                    }}>
                      <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Login Details
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">First Name</Label>
                            <Input value={ticket.firstName} onChange={e => handleTicketChange(idx, "firstName", e.target.value)} className="h-8 text-xs" placeholder="John" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Last Name</Label>
                            <Input value={ticket.lastName} onChange={e => handleTicketChange(idx, "lastName", e.target.value)} className="h-8 text-xs" placeholder="Smith" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Email</Label>
                            <Input value={ticket.email} onChange={e => handleTicketChange(idx, "email", e.target.value)} className="h-8 text-xs" placeholder="john@example.com" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Password</Label>
                            <Input value={ticket.password} onChange={e => handleTicketChange(idx, "password", e.target.value)} className="h-8 text-xs" placeholder="••••••" />
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
              <Button variant="ghost" size="sm" onClick={addTicketRow} className="w-full text-xs gap-1 border border-dashed">
                <Plus className="h-3.5 w-3.5" /> Add Ticket
              </Button>
            </div>
          )}

          {/* Grid View */}
          {viewMode === "grid" && (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground w-8">#</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Row</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Seat</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Face Val</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">First Name</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Last Name</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Password</th>
                    <th className="px-2 py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket, idx) => {
                    if (removedIds.has(ticket.id)) return null;
                    return (
                      <tr key={ticket.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-2 py-1 text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="px-1 py-1">
                          <input
                            value={ticket.row}
                            onChange={e => handleTicketChange(idx, "row", e.target.value)}
                            className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs"
                            placeholder="A"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={ticket.seat}
                            onChange={e => handleTicketChange(idx, "seat", e.target.value)}
                            className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs"
                            placeholder="50"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            value={ticket.faceValue}
                            onChange={e => handleTicketChange(idx, "faceValue", e.target.value)}
                            className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={ticket.firstName}
                            onChange={e => handleTicketChange(idx, "firstName", e.target.value)}
                            className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs"
                            placeholder="John"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={ticket.lastName}
                            onChange={e => handleTicketChange(idx, "lastName", e.target.value)}
                            className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs"
                            placeholder="Smith"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={ticket.email}
                            onChange={e => handleTicketChange(idx, "email", e.target.value)}
                            className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs"
                            placeholder="email"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={ticket.password}
                            onChange={e => handleTicketChange(idx, "password", e.target.value)}
                            className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs"
                            placeholder="pass"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <button onClick={() => removeTicket(idx)} className="text-muted-foreground hover:text-destructive p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button
                onClick={addTicketRow}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-2 flex items-center justify-center gap-1 border-t hover:bg-muted/30 transition-colors"
              >
                <Plus className="h-3 w-3" /> Add Row
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="text-xs font-mono">
              {validTickets.length} ticket{validTickets.length !== 1 ? "s" : ""} ready
            </Badge>
            {totalFaceValue > 0 && (
              <span className="text-xs text-muted-foreground">
                Total FV: <span className="font-semibold text-foreground">£{totalFaceValue.toFixed(2)}</span>
              </span>
            )}
          </div>
          <Button onClick={handleSubmit} disabled={loading || hasErrors} size="sm" className="min-w-[140px]">
            {loading ? "Adding..." : `Add ${validTickets.length > 1 ? "All " : ""}${validTickets.length} Ticket${validTickets.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
