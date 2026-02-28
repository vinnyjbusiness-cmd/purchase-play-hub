import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Search, ChevronDown, ChevronUp, Plus, RefreshCw, Trash2, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CLUBS } from "@/lib/seatingSections";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── Event card colour palette (reused from Orders) ───
const EVENT_PALETTE = [
  "bg-emerald-800", "bg-violet-800", "bg-blue-800", "bg-amber-900", "bg-rose-800",
  "bg-cyan-800", "bg-indigo-800", "bg-orange-900", "bg-fuchsia-800", "bg-teal-800",
];

// ─── Platform badge colours ───
const PLATFORM_CONFIG: Record<string, { label: string; badge: string }> = {
  tixstock: { label: "Tixstock", badge: "bg-purple-600 text-white" },
  footballticketnet: { label: "FootballTicketNet", badge: "bg-amber-600 text-white" },
  livefootball: { label: "LiveFootball", badge: "bg-emerald-600 text-white" },
  fanpass: { label: "Fanpass", badge: "bg-blue-600 text-white" },
};
const PLATFORMS_LIST = ["tixstock", "footballticketnet", "livefootball", "fanpass"] as const;

function TeamLogo({ name, size = 28 }: { name: string; size?: number }) {
  const club = CLUBS.find(c => name.toLowerCase().includes(c.label.toLowerCase().split(" (")[0]));
  const initials = name.split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const gradients = [
    "from-violet-500 to-purple-600", "from-blue-500 to-cyan-600",
    "from-emerald-500 to-teal-600", "from-orange-500 to-amber-600",
    "from-rose-500 to-pink-600", "from-indigo-500 to-blue-600",
  ];
  const gradient = gradients[Math.abs(hash) % gradients.length];
  return (
    <div
      className={cn("rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white shrink-0", gradient)}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

interface EventRow {
  id: string;
  home_team: string;
  away_team: string;
  event_date: string;
  venue: string | null;
  competition: string;
}

interface Listing {
  id: string;
  org_id: string;
  event_id: string;
  platform: string;
  section: string | null;
  row: string | null;
  seat_from: string | null;
  seat_to: string | null;
  quantity: number;
  price: number;
  face_value: number | null;
  status: string;
  external_listing_id: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

type GroupedEvent = {
  event: EventRow;
  listings: Listing[];
};

const EMPTY_FORM = {
  platform: "tixstock" as string,
  section: "",
  row: "",
  seat_from: "",
  seat_to: "",
  quantity: 1,
  price: 0,
  face_value: 0,
};

export default function ListingsManager() {
  const { orgId } = useOrg();
  const isMobile = useIsMobile();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addEventId, setAddEventId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [lastSynced, setLastSynced] = useState<Record<string, Date | null>>({});

  const load = useCallback(async () => {
    if (!orgId) return;
    const [{ data: evData }, { data: lsData }] = await Promise.all([
      supabase.from("events").select("id, home_team, away_team, event_date, venue, competition").eq("org_id", orgId).order("event_date", { ascending: true }),
      supabase.from("listings").select("*").eq("org_id", orgId),
    ]);
    setEvents((evData as EventRow[]) || []);
    setListings((lsData as Listing[]) || []);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const grouped: GroupedEvent[] = useMemo(() => {
    const listingsByEvent = new Map<string, Listing[]>();
    listings.forEach(l => {
      const arr = listingsByEvent.get(l.event_id) || [];
      arr.push(l);
      listingsByEvent.set(l.event_id, arr);
    });

    return events
      .filter(e => {
        const eventListings = listingsByEvent.get(e.id) || [];
        const hasListings = eventListings.length > 0;
        // Show events that have listings or all events if no platform filter
        if (platformFilter !== "all") {
          const filtered = eventListings.filter(l => l.platform === platformFilter);
          if (filtered.length === 0 && !hasListings) return false;
        }

        if (search) {
          const q = search.toLowerCase();
          const match = `${e.home_team} ${e.away_team} ${e.venue || ""}`.toLowerCase();
          if (!match.includes(q)) return false;
        }
        return true;
      })
      .map(e => ({
        event: e,
        listings: (listingsByEvent.get(e.id) || []).filter(l =>
          platformFilter === "all" || l.platform === platformFilter
        ),
      }));
  }, [events, listings, platformFilter, search]);

  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getStatusPill = (eventListings: Listing[]) => {
    if (eventListings.length === 0) return { label: "No Listings", cls: "bg-muted text-muted-foreground" };
    const published = eventListings.filter(l => l.status === "published").length;
    if (published === eventListings.length) return { label: "Active", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    if (published === 0) return { label: "Unlisted", cls: "bg-red-500/20 text-red-400 border-red-500/30" };
    return { label: "Partial", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" };
  };

  // ─── CRUD ───
  const toggleListingStatus = async (listing: Listing) => {
    const newStatus = listing.status === "published" ? "unpublished" : "published";
    await supabase.from("listings").update({ status: newStatus }).eq("id", listing.id);
    setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: newStatus } : l));
  };

  const updatePrice = async (id: string, newPrice: number) => {
    await supabase.from("listings").update({ price: newPrice }).eq("id", id);
    setListings(prev => prev.map(l => l.id === id ? { ...l, price: newPrice } : l));
  };

  const deleteListing = async (id: string) => {
    await supabase.from("listings").delete().eq("id", id);
    setListings(prev => prev.filter(l => l.id !== id));
    toast.success("Listing deleted");
  };

  const bulkStatus = async (eventId: string, status: string) => {
    const ids = listings.filter(l => l.event_id === eventId).map(l => l.id);
    if (ids.length === 0) return;
    await supabase.from("listings").update({ status }).in("id", ids);
    setListings(prev => prev.map(l => ids.includes(l.id) ? { ...l, status } : l));
    toast.success(`All listings ${status === "published" ? "published" : "unpublished"}`);
  };

  const addListing = async () => {
    if (!orgId || !addEventId) return;
    setSaving(true);
    const { error } = await supabase.from("listings").insert({
      org_id: orgId,
      event_id: addEventId,
      platform: form.platform,
      section: form.section || null,
      row: form.row || null,
      seat_from: form.seat_from || null,
      seat_to: form.seat_to || null,
      quantity: form.quantity,
      price: form.price,
      face_value: form.face_value || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing added");
    setAddModalOpen(false);
    setForm(EMPTY_FORM);
    load();
  };

  const handleSync = (platform: string) => {
    toast.info(`Sync not yet connected — ${PLATFORM_CONFIG[platform]?.label || platform} API key required`);
    setLastSynced(prev => ({ ...prev, [platform]: new Date() }));
  };

  const filterTabs = [
    { value: "all", label: "All" },
    ...PLATFORMS_LIST.map(p => ({ value: p, label: PLATFORM_CONFIG[p].label })),
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listings Manager</h1>
          <p className="text-sm text-muted-foreground">Manage ticket listings across all platforms</p>
        </div>
        <div className="relative sm:ml-auto sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search events…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Platform filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filterTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setPlatformFilter(tab.value)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              platformFilter === tab.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </button>
        ))}

        {/* Sync button for active platform */}
        {platformFilter !== "all" && (
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={() => handleSync(platformFilter)} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Sync
            </Button>
            {lastSynced[platformFilter] && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Last: {format(lastSynced[platformFilter]!, "HH:mm")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Event cards */}
      <div className="space-y-3">
        {grouped.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Globe className="mx-auto h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No events found. Add listings to your events to see them here.</p>
          </div>
        )}

        {grouped.map(({ event, listings: eventListings }, idx) => {
          const isOpen = expandedEvents.has(event.id);
          const pill = getStatusPill(eventListings);
          const paletteClass = EVENT_PALETTE[idx % EVENT_PALETTE.length];

          return (
            <div key={event.id} className="rounded-xl overflow-hidden border border-border/40">
              {/* Collapsed header */}
              <button
                onClick={() => toggleExpand(event.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 text-left text-white transition-colors",
                  paletteClass
                )}
              >
                <TeamLogo name={event.home_team} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {event.home_team} vs {event.away_team}
                  </p>
                  <p className="text-xs text-white/70 truncate">
                    {format(new Date(event.event_date), "dd MMM yyyy, HH:mm")}
                    {event.venue ? ` · ${event.venue}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="border-white/30 text-white text-xs shrink-0">
                  {eventListings.length} listing{eventListings.length !== 1 ? "s" : ""}
                </Badge>
                <Badge className={cn("text-xs border shrink-0", pill.cls)}>{pill.label}</Badge>
                {isOpen ? <ChevronUp className="h-4 w-4 text-white/60 shrink-0" /> : <ChevronDown className="h-4 w-4 text-white/60 shrink-0" />}
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="bg-card border-t border-border/40 p-4 space-y-3">
                  {/* Action bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => bulkStatus(event.id, "published")} className="text-xs">
                      Publish All
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => bulkStatus(event.id, "unpublished")} className="text-xs">
                      Unpublish All
                    </Button>
                    <Button
                      size="sm"
                      className="ml-auto gap-1 text-xs"
                      onClick={() => { setAddEventId(event.id); setForm(EMPTY_FORM); setAddModalOpen(true); }}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Listing
                    </Button>
                  </div>

                  {/* Listing rows */}
                  {eventListings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No listings yet for this event.</p>
                  ) : (
                    <div className={cn("grid gap-2", isMobile ? "grid-cols-1" : "grid-cols-1")}>
                      {eventListings.map(listing => (
                        <ListingRow
                          key={listing.id}
                          listing={listing}
                          onToggle={() => toggleListingStatus(listing)}
                          onDelete={() => deleteListing(listing.id)}
                          onPriceChange={(p) => updatePrice(listing.id, p)}
                          isMobile={isMobile}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Listing Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className={cn("sm:max-w-md", isMobile && "h-[100dvh] max-h-[100dvh] rounded-none")}>
          <DialogHeader>
            <DialogTitle>Add Listing</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS_LIST.map(p => (
                    <SelectItem key={p} value={p}>{PLATFORM_CONFIG[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Section</Label>
                <Input value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Row</Label>
                <Input value={form.row} onChange={e => setForm(f => ({ ...f, row: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Seat From</Label>
                <Input value={form.seat_from} onChange={e => setForm(f => ({ ...f, seat_from: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Seat To</Label>
                <Input value={form.seat_to} onChange={e => setForm(f => ({ ...f, seat_to: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Qty</Label>
                <Input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Price (£)</Label>
                <Input type="number" min={0} step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Face Value</Label>
                <Input type="number" min={0} step="0.01" value={form.face_value} onChange={e => setForm(f => ({ ...f, face_value: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>Cancel</Button>
            <Button onClick={addListing} disabled={saving || !form.price}>
              {saving ? "Saving…" : "Add Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-listing row component ───
function ListingRow({
  listing, onToggle, onDelete, onPriceChange, isMobile,
}: {
  listing: Listing;
  onToggle: () => void;
  onDelete: () => void;
  onPriceChange: (p: number) => void;
  isMobile: boolean;
}) {
  const [editPrice, setEditPrice] = useState(String(listing.price));
  const cfg = PLATFORM_CONFIG[listing.platform] || { label: listing.platform, badge: "bg-muted text-foreground" };
  const isPublished = listing.status === "published";

  const commitPrice = () => {
    const val = parseFloat(editPrice);
    if (!isNaN(val) && val !== listing.price) {
      onPriceChange(val);
    } else {
      setEditPrice(String(listing.price));
    }
  };

  const seatInfo = [listing.section, listing.row ? `Row ${listing.row}` : null, listing.seat_from ? `${listing.seat_from}${listing.seat_to ? `–${listing.seat_to}` : ""}` : null]
    .filter(Boolean)
    .join(" · ");

  if (isMobile) {
    return (
      <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Badge className={cn("text-[10px]", cfg.badge)}>{cfg.label}</Badge>
          <div className="flex items-center gap-2">
            <Switch checked={isPublished} onCheckedChange={onToggle} className="scale-75" />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {seatInfo && <p className="text-xs text-muted-foreground">{seatInfo}</p>}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Qty: {listing.quantity}</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">£</span>
            <Input
              value={editPrice}
              onChange={e => setEditPrice(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={e => e.key === "Enter" && commitPrice()}
              className="h-7 w-20 text-sm text-right"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-2.5">
      <Badge className={cn("text-[10px] shrink-0", cfg.badge)}>{cfg.label}</Badge>
      <span className="text-sm text-muted-foreground truncate min-w-0 flex-1">
        {seatInfo || "—"}
      </span>
      <span className="text-sm text-muted-foreground shrink-0 w-14 text-center">
        Qty: {listing.quantity}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground">£</span>
        <Input
          value={editPrice}
          onChange={e => setEditPrice(e.target.value)}
          onBlur={commitPrice}
          onKeyDown={e => e.key === "Enter" && commitPrice()}
          className="h-7 w-20 text-sm text-right"
        />
      </div>
      <Switch checked={isPublished} onCheckedChange={onToggle} className="shrink-0" />
      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
