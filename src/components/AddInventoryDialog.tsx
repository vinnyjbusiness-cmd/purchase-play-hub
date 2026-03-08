import { useEffect, useState, useMemo, useCallback } from "react";
import { formatEventLabel } from "@/lib/eventDisplay";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { useOrg } from "@/hooks/useOrg";
import { VENUES, getVenue } from "@/lib/seatingSections";
import { ChevronDown, ChevronRight, LayoutGrid, Table2, Upload, X, Plus, FileSpreadsheet, UserSearch, ExternalLink, Trash2, Search } from "lucide-react";

interface Props {
  onClose: () => void;
  onCreated: () => void;
  defaultVenue?: string;
}

interface EventRow {
  id: string;
  match_code: string;
  home_team: string;
  away_team: string;
  event_date: string;
  venue: string | null;
  city: string | null;
  competition: string;
}

interface MemberRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  member_password: string | null;
  email_password: string | null;
  pass_link: string | null;
  supporter_id: string | null;
  iphone_pass_link: string | null;
  android_pass_link: string | null;
  pk_pass_url: string | null;
  club: string | null;
}

const VENUE_CLUB_MAP: Record<string, string> = {
  liverpool: "liverpool",
  arsenal: "arsenal",
  "manchester-united": "manchester united",
  "world-cup": "world cup",
};

export interface TicketEntry {
  id: string;
  row: string;
  seat: string;
  faceValue: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  emailPassword: string;
  memberId: string;
  passLink: string;
  iphonePassLink: string;
  androidPassLink: string;
  pkPassUrl: string;
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
  emailPassword: "",
  memberId: "",
  passLink: "",
  iphonePassLink: "",
  androidPassLink: "",
  pkPassUrl: "",
});

const SPLIT_QTY_MAP: Record<string, number> = {
  singles: 1,
  pairs: 2,
  trios: 3,
  quads: 4,
};

/* ── World Cup multi-event row ── */
interface WCEventRow {
  id: string;
  eventId: string;
  category: string;
  priceUsd: string;
  quantity: number;
}

const createWCEventRow = (): WCEventRow => ({
  id: crypto.randomUUID(),
  eventId: "",
  category: "Category 3",
  priceUsd: "",
  quantity: 4,
});

const WC_CATEGORIES = ["Category 1", "Category 2", "Category 3", "Category 4"];

export default function AddInventoryDialog({ onClose, onCreated, defaultVenue }: Props) {
  const { orgId } = useOrg();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [venue, setVenue] = useState(defaultVenue || "");
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
  const [memberPopoverOpen, setMemberPopoverOpen] = useState<string | null>(null);

  // World Cup multi-event state
  const [wcAccount, setWcAccount] = useState("");
  const [wcRows, setWcRows] = useState<WCEventRow[]>([createWCEventRow()]);
  const [wcEventSearchOpen, setWcEventSearchOpen] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("events")
      .select("id, match_code, home_team, away_team, event_date, venue, city, competition")
      .order("event_date", { ascending: false })
      .then(({ data }) => setEvents(data || []));
  }, []);

  useEffect(() => {
    supabase
      .from("members")
      .select("id, first_name, last_name, email, member_password, email_password, pass_link, supporter_id, iphone_pass_link, android_pass_link, pk_pass_url, club")
      .order("first_name")
      .then(({ data }) => setMembers((data as any) || []));
  }, []);

  const isWorldCup = venue === "world-cup";

  const filteredMembers = useMemo(() => {
    if (!venue) return members;
    const clubKey = VENUE_CLUB_MAP[venue];
    if (!clubKey) return members;
    return members.filter(m => m.club?.toLowerCase().includes(clubKey));
  }, [venue, members]);

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

  const wcFilteredEvents = useMemo(() => {
    return events.filter(e => e.competition?.toLowerCase().includes("world cup"));
  }, [events]);

  const venueConfig = getVenue(venue);
  const gaSections = venueConfig?.sections.GA || [];
  const hospoOptions = venueConfig?.sections.HOSPO || [];
  const selectedGaSection = gaSections.find(s => s.label === section);
  const blocks = selectedGaSection?.blocks || [];

  // ── WC multi-event handlers ──
  const addWcRow = useCallback(() => {
    setWcRows(prev => {
      if (prev.length >= 10) { toast.error("Maximum 10 events"); return prev; }
      return [...prev, createWCEventRow()];
    });
  }, []);

  const removeWcRow = useCallback((id: string) => {
    setWcRows(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(r => r.id !== id);
    });
  }, []);

  const updateWcRow = useCallback((id: string, field: keyof WCEventRow, value: string | number) => {
    setWcRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }, []);

  const wcTotalTickets = wcRows.reduce((sum, r) => sum + (r.eventId ? r.quantity : 0), 0);

  const handleWcSubmit = async () => {
    const validRows = wcRows.filter(r => r.eventId);
    if (validRows.length === 0) { toast.error("Select at least one event"); return; }
    setLoading(true);

    const selectedMember = filteredMembers.find(m => m.id === wcAccount);
    const allInserts: any[] = [];
    for (const row of validRows) {
      for (let i = 0; i < row.quantity; i++) {
        allInserts.push({
          event_id: row.eventId,
          purchase_id: null,
          category: row.category,
          section: null,
          block: null,
          row_name: null,
          seat: null,
          face_value: row.priceUsd ? parseFloat(row.priceUsd) : null,
          ticket_name: selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name}`.trim() : null,
          first_name: selectedMember?.first_name || null,
          last_name: selectedMember?.last_name || null,
          supporter_id: null,
          email: selectedMember?.email || null,
          password: selectedMember?.member_password || null,
          email_password: selectedMember?.email_password || null,
          iphone_pass_link: null,
          android_pass_link: null,
          pk_pass_url: null,
          org_id: orgId,
          status: "available" as const,
          source: "IJK",
          split_type: null,
        });
      }
    }

    const { error } = await supabase.from("inventory").insert(allInserts);
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success(`${allInserts.length} ticket${allInserts.length !== 1 ? "s" : ""} added across ${validRows.length} event${validRows.length !== 1 ? "s" : ""}`);
    setLoading(false);
    onCreated();
  };

  // ── Regular (non-WC) handlers ──
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

  const handleSplitTypeChange = useCallback((val: string) => {
    setSplitType(val);
    const autoQty = SPLIT_QTY_MAP[val];
    if (autoQty) {
      handleQuantityChange(autoQty);
    }
  }, [handleQuantityChange]);

  const handleTicketChange = useCallback((index: number, field: keyof TicketEntry, value: string) => {
    setTickets(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };

      if (field === "seat" && index === 0) {
        const num = parseInt(value);
        if (!isNaN(num)) {
          for (let i = 1; i < next.length; i++) {
            const prevExpected = next[i].seat;
            const wasAutoFilled = !prevExpected || /^\d+$/.test(prevExpected);
            if (wasAutoFilled) {
              next[i] = { ...next[i], seat: String(num + i) };
            }
          }
        }
      }
      if (field === "row" && index === 0) {
        for (let i = 1; i < next.length; i++) {
          next[i] = { ...next[i], row: value };
        }
      }
      if (field === "faceValue" && index === 0) {
        for (let i = 1; i < next.length; i++) {
          if (!next[i].faceValue || next[i].faceValue === prev[0].faceValue) {
            next[i] = { ...next[i], faceValue: value };
          }
        }
      }
      return next;
    });
  }, []);

  const assignMember = useCallback((index: number, member: MemberRow) => {
    setTickets(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        memberId: member.id,
        firstName: member.first_name,
        lastName: member.last_name,
        email: member.email || "",
        password: member.member_password || "",
        emailPassword: member.email_password || "",
        passLink: member.pass_link || "",
        iphonePassLink: member.iphone_pass_link || "",
        androidPassLink: member.android_pass_link || "",
        pkPassUrl: member.pk_pass_url || "",
      };
      return next;
    });
    setMemberPopoverOpen(null);
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
        emailPassword: "",
        memberId: "",
        passLink: "",
        iphonePassLink: "",
        androidPassLink: "",
        pkPassUrl: "",
      });
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
      email_password: t.emailPassword || null,
      iphone_pass_link: t.iphonePassLink || t.passLink || null,
      android_pass_link: t.androidPassLink || null,
      pk_pass_url: t.pkPassUrl || null,
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

  const getMemberName = (ticket: TicketEntry) => {
    const name = [ticket.firstName, ticket.lastName].filter(Boolean).join(" ");
    return name || null;
  };

  /* ── Searchable WC match selector component ── */
  const WCMatchSelector = ({ rowId, selectedEventId, onSelect }: { rowId: string; selectedEventId: string; onSelect: (eventId: string) => void }) => {
    const selectedEvent = wcFilteredEvents.find(e => e.id === selectedEventId);
    const isOpen = wcEventSearchOpen === rowId;

    return (
      <Popover open={isOpen} onOpenChange={(open) => setWcEventSearchOpen(open ? rowId : null)}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-start h-9 text-xs gap-1.5 font-normal">
            <Search className="h-3 w-3 text-muted-foreground shrink-0" />
            {selectedEvent
              ? <span className="truncate">{formatEventLabel(selectedEvent.home_team, selectedEvent.away_team, selectedEvent.event_date, selectedEvent.match_code)}</span>
              : <span className="text-muted-foreground">Search match…</span>
            }
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[340px]" align="start">
          <Command filter={(value, search) => {
            const s = search.toLowerCase().trim();
            const v = value.toLowerCase();
            // If search looks like a match number (m + digits), require exact prefix match on the match code part
            const mMatch = s.match(/^m(\d+)$/);
            if (mMatch) {
              // Extract match code from value (first token like "wc2026-m42")
              const mcPart = v.split(" ")[0]; // e.g. "wc2026-m42"
              const numPart = mcPart.replace(/^wc2026-m/, "");
              return numPart === mMatch[1] ? 1 : 0;
            }
            // Default: check if all search terms appear in value
            return s.split(" ").every(term => v.includes(term)) ? 1 : 0;
          }}>
            <CommandInput placeholder="Type team name or match number…" />
            <CommandList>
              <CommandEmpty>No matches found</CommandEmpty>
              <CommandGroup>
                {wcFilteredEvents.map(e => (
                  <CommandItem
                    key={e.id}
                    value={`${e.match_code} ${e.home_team} ${e.away_team}`}
                    onSelect={() => { onSelect(e.id); setWcEventSearchOpen(null); }}
                    className="flex flex-col items-start py-2"
                  >
                    <span className="font-medium text-xs">
                      {formatEventLabel(e.home_team, e.away_team, e.event_date, e.match_code)}
                    </span>
                    {e.venue && <span className="text-[10px] text-muted-foreground">{e.venue}{e.city ? `, ${e.city}` : ""}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 md:max-w-[680px]">
        <DialogHeader className="px-4 sm:px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">Add Inventory</DialogTitle>
            {!isWorldCup && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowImport(!showImport)}
                className="gap-1.5 text-xs"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Import CSV
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 space-y-4">
          {/* CSV Import Panel — non-WC only */}
          {!isWorldCup && showImport && (
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

          {/* Venue Selector — always shown */}
          <div className="space-y-1.5">
            <Label className="text-xs">Club / Venue</Label>
            {defaultVenue ? (
              <Input value={VENUES.find(v => v.value === defaultVenue)?.label || defaultVenue} disabled className="bg-muted h-9" />
            ) : (
              <Select value={venue} onValueChange={(v) => { setVenue(v); setEventId(""); setSection(""); setBlock(""); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select venue" /></SelectTrigger>
                <SelectContent>
                  {VENUES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ═══════════════ WORLD CUP FLOW ═══════════════ */}
          {isWorldCup && (
            <div className="space-y-4">
              {/* Account Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Account (Member)</Label>
                <Select value={wcAccount} onValueChange={setWcAccount}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select member account" /></SelectTrigger>
                  <SelectContent>
                    {filteredMembers.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.first_name} {m.last_name}{m.email ? ` — ${m.email}` : ""}
                      </SelectItem>
                    ))}
                    {filteredMembers.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No World Cup members found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Event Rows */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Events</Label>
                <div className="space-y-2">
                  {wcRows.map((row, idx) => (
                    <div key={row.id} className="rounded-lg border bg-card p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">Event {idx + 1}</span>
                        <button
                          onClick={() => removeWcRow(row.id)}
                          className="text-muted-foreground hover:text-destructive p-1"
                          title="Remove event"
                          disabled={wcRows.length <= 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Match search */}
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Match</Label>
                        <WCMatchSelector
                          rowId={row.id}
                          selectedEventId={row.eventId}
                          onSelect={(eid) => updateWcRow(row.id, "eventId", eid)}
                        />
                      </div>

                      {/* Category / Price / Qty */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Category</Label>
                          <Select value={row.category} onValueChange={(v) => updateWcRow(row.id, "category", v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {WC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Price (USD)</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                            <Input
                              type="number"
                              value={row.priceUsd}
                              onChange={e => updateWcRow(row.id, "priceUsd", e.target.value)}
                              className="h-8 text-xs pl-5"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Qty</Label>
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            value={row.quantity}
                            onChange={e => updateWcRow(row.id, "quantity", Math.max(1, Math.min(20, Number(e.target.value))))}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {wcRows.length < 10 && (
                    <Button variant="ghost" size="sm" onClick={addWcRow} className="w-full text-xs gap-1 border border-dashed min-h-[44px]">
                      <Plus className="h-3.5 w-3.5" /> Add Event
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ REGULAR (non-WC) FLOW ═══════════════ */}
          {!isWorldCup && (
            <>
              {/* Event selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Event</Label>
                <Select value={eventId} onValueChange={setEventId} disabled={!venue}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={venue ? "Select event" : "Select venue first"} /></SelectTrigger>
                  <SelectContent>
                    {filteredEvents.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {formatEventLabel(e.home_team, e.away_team, e.event_date, e.match_code)}
                      </SelectItem>
                    ))}
                    {filteredEvents.length === 0 && venue && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No events found</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  <Select value={splitType} onValueChange={handleSplitTypeChange}>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    const memberName = getMemberName(ticket);
                    return (
                      <div key={ticket.id} className="rounded-lg border bg-card p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">
                            Ticket {idx + 1}
                            {memberName && <span className="text-foreground ml-1">— {memberName}</span>}
                          </span>
                          <button
                            onClick={() => removeTicket(idx)}
                            className="text-muted-foreground hover:text-destructive p-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-0.5 flex items-center justify-center"
                            title="Remove"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                          <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1">
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            Login Details
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-2 space-y-2">
                            {/* Assign Member dropdown */}
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Assign Member</Label>
                              <Popover open={memberPopoverOpen === ticket.id} onOpenChange={(open) => setMemberPopoverOpen(open ? ticket.id : null)}>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="w-full justify-start h-8 text-xs gap-1.5">
                                    <UserSearch className="h-3 w-3 text-muted-foreground shrink-0" />
                                    {ticket.memberId
                                      ? `${ticket.firstName} ${ticket.lastName}`
                                      : "Search members…"
                                    }
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] sm:w-72" align="start">
                                  <Command>
                                    <CommandInput placeholder="Search by name or email…" />
                                    <CommandList>
                                      <CommandEmpty>No members found</CommandEmpty>
                                      <CommandGroup>
                                        {filteredMembers.map(m => (
                                          <CommandItem
                                            key={m.id}
                                            value={`${m.first_name} ${m.last_name} ${m.email || ""}`}
                                            onSelect={() => assignMember(idx, m)}
                                            className="flex flex-col items-start py-2"
                                          >
                                            <span className="font-medium text-xs">{m.first_name} {m.last_name}</span>
                                            {m.email && <span className="text-[10px] text-muted-foreground">{m.email}</span>}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              {filteredMembers.length === 0 && venue && (
                                <p className="text-[10px] text-muted-foreground mt-1">No members tagged with this club/tournament</p>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

                            {/* Pass Links */}
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Pass Link</Label>
                              <div className="flex items-center gap-1">
                                <Input value={ticket.passLink} onChange={e => handleTicketChange(idx, "passLink", e.target.value)} className="h-8 text-xs" placeholder="https://..." />
                                {ticket.passLink && (
                                  <a href={ticket.passLink} target="_blank" rel="noopener" className="p-1.5 rounded hover:bg-muted/60 shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center">
                                    <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    );
                  })}
                  <Button variant="ghost" size="sm" onClick={addTicketRow} className="w-full text-xs gap-1 border border-dashed min-h-[44px]">
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
                              <input value={ticket.row} onChange={e => handleTicketChange(idx, "row", e.target.value)} className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs" placeholder="A" />
                            </td>
                            <td className="px-1 py-1">
                              <input value={ticket.seat} onChange={e => handleTicketChange(idx, "seat", e.target.value)} className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs" placeholder="50" />
                            </td>
                            <td className="px-1 py-1">
                              <input type="number" value={ticket.faceValue} onChange={e => handleTicketChange(idx, "faceValue", e.target.value)} className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs" placeholder="0.00" />
                            </td>
                            <td className="px-1 py-1">
                              <input value={ticket.firstName} onChange={e => handleTicketChange(idx, "firstName", e.target.value)} className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs" placeholder="John" />
                            </td>
                            <td className="px-1 py-1">
                              <input value={ticket.lastName} onChange={e => handleTicketChange(idx, "lastName", e.target.value)} className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs" placeholder="Smith" />
                            </td>
                            <td className="px-1 py-1">
                              <input value={ticket.email} onChange={e => handleTicketChange(idx, "email", e.target.value)} className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs" placeholder="email" />
                            </td>
                            <td className="px-1 py-1">
                              <input value={ticket.password} onChange={e => handleTicketChange(idx, "password", e.target.value)} className="w-full bg-transparent border-0 outline-none px-1 py-0.5 rounded focus:ring-1 focus:ring-ring text-xs" placeholder="pass" />
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
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-2 flex items-center justify-center gap-1 border-t hover:bg-muted/30 transition-colors min-h-[44px]"
                  >
                    <Plus className="h-3 w-3" /> Add Row
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 sm:px-6 py-3 flex items-center justify-between bg-muted/30 sticky bottom-0">
          {isWorldCup ? (
            <>
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-xs font-mono">
                  {wcTotalTickets} ticket{wcTotalTickets !== 1 ? "s" : ""} across {wcRows.filter(r => r.eventId).length} event{wcRows.filter(r => r.eventId).length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <Button onClick={handleWcSubmit} disabled={loading || wcTotalTickets === 0} size="sm" className="min-w-[140px] min-h-[44px] sm:min-h-0">
                {loading ? "Adding..." : `Add All to Inventory`}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-1">Esc to close</p>
            </>
          ) : (
            <>
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
              <Button onClick={handleSubmit} disabled={loading || hasErrors} size="sm" className="min-w-[120px] sm:min-w-[140px] min-h-[44px] sm:min-h-0">
                {loading ? "Adding..." : `Add ${validTickets.length > 1 ? "All " : ""}${validTickets.length} Ticket${validTickets.length !== 1 ? "s" : ""}`}
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-1">Esc to close</p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
