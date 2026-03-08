import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Search, Download, Zap, CheckCircle2, Trash2, Pencil, Smartphone, Copy, Check,
  Package, ShoppingCart, TrendingUp, Percent, Ticket, Plus, ChevronDown, ChevronRight,
  Users, User, Apple, CheckSquare, Square, Filter, Link2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, subHours } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getEventKey, deduplicateEvents } from "@/lib/eventDedup";
import { formatEventTitle, getMatchBadge } from "@/lib/eventDisplay";
import FilterSelect from "@/components/FilterSelect";
import AddOrderDialog from "@/components/AddOrderDialog";
import AddPurchaseDialog from "@/components/AddPurchaseDialog";
import OrderDetailSheet from "@/components/OrderDetailSheet";
import AssignPurchaseDialog from "@/components/AssignPurchaseDialog";
import EditOrderDialog from "@/components/EditOrderDialog";
import AddInventoryDialog from "@/components/AddInventoryDialog";
import InventoryDetailSheet from "@/components/InventoryDetailSheet";

// ── Shared types ──
interface EventInfo {
  id: string; match_code: string; home_team: string; away_team: string;
  event_date: string; competition: string; venue?: string | null;
}

interface Order {
  id: string; order_ref: string | null; buyer_ref: string | null;
  buyer_name: string | null; buyer_phone: string | null; buyer_email: string | null;
  category: string; quantity: number; sale_price: number; fees: number;
  net_received: number; status: string; delivery_type: string;
  delivery_status: string | null; device_type: string | null;
  contacted: boolean; notes: string | null; order_date: string;
  currency: string; event_id: string; platform_id: string | null;
  contact_id: string | null;
  events: { match_code: string; home_team: string; away_team: string; event_date: string; venue: string | null } | null;
  platforms: { name: string } | null;
  payment_received?: boolean;
}

interface Purchase {
  id: string; supplier_order_id: string | null; quantity: number;
  unit_cost: number; total_cost: number | null; total_cost_gbp: number | null;
  currency: string; purchase_date: string; supplier_paid: boolean;
  notes: string | null; category: string; section: string | null;
  event_id: string; supplier_id: string; status: string;
}

interface InventoryItem {
  id: string; category: string; section: string | null; block: string | null;
  row_name: string | null; seat: string | null; face_value: number | null;
  ticket_name: string | null; supporter_id: string | null;
  first_name: string | null; last_name: string | null;
  email: string | null; password: string | null;
  iphone_pass_link: string | null; android_pass_link: string | null;
  pk_pass_url: string | null; source: string | null; status: string;
  created_at: string; event_id: string; purchase_id: string | null;
  events: { match_code: string; home_team: string; away_team: string; event_date: string; venue: string | null } | null;
}

interface SupplierInfo { id: string; name: string; }
interface PlatformInfo { id: string; name: string; }
interface AssignmentInfo { linked_count: number; supplier_contact_name: string | null; }
interface OrderLine { inventory_id: string; order_id: string; }

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
const currSym = (c: string) => (c === "USD" ? "$" : c === "EUR" ? "€" : "£");

const statusColor: Record<string, string> = {
  available: "bg-success/10 text-success border-success/20",
  reserved: "bg-warning/10 text-warning border-warning/20",
  sold: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

// ── Country flags ──
const countryFlags: Record<string, string> = {
  "usa": "🇺🇸", "united states": "🇺🇸", "mexico": "🇲🇽", "canada": "🇨🇦",
  "brazil": "🇧🇷", "argentina": "🇦🇷", "colombia": "🇨🇴", "ecuador": "🇪🇨",
  "paraguay": "🇵🇾", "uruguay": "🇺🇾", "chile": "🇨🇱", "peru": "🇵🇪", "bolivia": "🇧🇴", "venezuela": "🇻🇪",
  "england": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "france": "🇫🇷", "germany": "🇩🇪", "spain": "🇪🇸", "italy": "🇮🇹",
  "portugal": "🇵🇹", "netherlands": "🇳🇱", "belgium": "🇧🇪", "switzerland": "🇨🇭",
  "croatia": "🇭🇷", "denmark": "🇩🇰", "sweden": "🇸🇪", "norway": "🇳🇴",
  "poland": "🇵🇱", "austria": "🇦🇹", "scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿", "wales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "ireland": "🇮🇪", "republic of ireland": "🇮🇪", "northern ireland": "🇬🇧",
  "turkey": "🇹🇷", "türkiye": "🇹🇷", "greece": "🇬🇷", "romania": "🇷🇴",
  "ukraine": "🇺🇦", "czech republic": "🇨🇿", "czechia": "🇨🇿", "slovakia": "🇸🇰",
  "serbia": "🇷🇸", "albania": "🇦🇱", "slovenia": "🇸🇮", "hungary": "🇭🇺",
  "bosnia": "🇧🇦", "bosnia and herzegovina": "🇧🇦", "bosnia and herzegvonia": "🇧🇦",
  "north macedonia": "🇲🇰", "kosovo": "🇽🇰", "montenegro": "🇲🇪",
  "japan": "🇯🇵", "south korea": "🇰🇷", "iran": "🇮🇷", "qatar": "🇶🇦",
  "saudi arabia": "🇸🇦", "australia": "🇦🇺", "new zealand": "🇳🇿",
  "morocco": "🇲🇦", "senegal": "🇸🇳", "nigeria": "🇳🇬", "cameroon": "🇨🇲",
  "ghana": "🇬🇭", "egypt": "🇪🇬", "ivory coast": "🇨🇮", "algeria": "🇩🇿",
  "tunisia": "🇹🇳", "south africa": "🇿🇦", "cape verde": "🇨🇻",
  "curacao": "🇨🇼", "curaçao": "🇨🇼", "jamaica": "🇯🇲", "haiti": "🇭🇹",
  "dr congo": "🇨🇩", "new caledonia": "🇳🇨", "china": "🇨🇳",
  "uzbekistan": "🇺🇿", "indonesia": "🇮🇩", "iraq": "🇮🇶", "suriname": "🇸🇷",
};

function getFlag(name: string): string {
  return countryFlags[name.toLowerCase().trim()] || "";
}

function parseEventTeams(homeTeam: string, awayTeam: string, matchCode?: string): { team1: string; team2: string; matchNum: string | null; round: string } {
  let team1 = homeTeam;
  let team2 = awayTeam;
  let matchNum: string | null = null;
  let round = "Group Stage";

  // Format: "#M74 - (1E vs 3A/B/C/D/F) Football World Cup 2026 - Round of 32"
  // or "#M2 - (Group A - South Korea vs Denmark...) Football World Cup 2026 - Group Stage"
  const importMatch = homeTeam.match(/^#M(\d+)\s*-\s*\((.+)$/);
  if (importMatch) {
    matchNum = importMatch[1];
    const remainder = importMatch[2];

    // Group stage format: "(Group A - South Korea"
    const groupMatch = remainder.match(/^Group\s+\w+\s*-\s*(.+)$/);
    if (groupMatch) {
      team1 = groupMatch[1].trim();
    } else {
      // Knockout format: "(1E" or "(Winner Group A"
      team1 = remainder.trim();
    }

    // Away team: "Argentina) Football World Cup 2026 - Group Stage" or just "Argentina"
    const awayMatch = awayTeam.match(/^(.+?)\)\s*Football World Cup 2026\s*-\s*(.+)$/);
    if (awayMatch) {
      team2 = awayMatch[1].trim();
      round = awayMatch[2].trim();
    }
  }

  // Extract match number from match_code if not found in team names
  if (!matchNum && matchCode) {
    const m = matchCode.match(/^#M(\d+)/);
    if (m) matchNum = m[1];
  }

  // Always derive round from match number for consistency
  if (matchNum) {
    round = getRoundFromMatchNum(parseInt(matchNum));
  }

  return { team1, team2, matchNum, round };
}

function getRoundFromMatchNum(num: number): string {
  if (num <= 72) return "Group Stage";
  if (num <= 88) return "Round of 32";
  if (num <= 96) return "Round of 16";
  if (num <= 100) return "Quarter-Finals";
  if (num <= 102) return "Semi-Finals";
  if (num === 103) return "3rd Place Play-off";
  if (num === 104) return "Final";
  return "Knockout Stage";
}

function getWCRound(matchCode: string | null | undefined): string {
  if (!matchCode) return "Other";
  // Handle both "#M74---(..." and "WC2026-M74"
  const m = matchCode.match(/^(?:#M|WC2026-M)(\d+)/);
  if (!m) return "Other";
  const n = parseInt(m[1], 10);
  if (n <= 72) {
    const groupIdx = Math.floor((n - 1) / 6);
    return `Group ${String.fromCharCode(65 + groupIdx)}`;
  }
  if (n <= 88) return "Round of 32";
  if (n <= 96) return "Round of 16";
  if (n <= 100) return "Quarter-Finals";
  if (n <= 102) return "Semi-Finals";
  if (n === 103) return "Third Place Play-off";
  if (n === 104) return "Final";
  return "Other";
}

const WC_ROUND_ORDER = [
  "Group A", "Group B", "Group C", "Group D", "Group E", "Group F",
  "Group G", "Group H", "Group I", "Group J", "Group K", "Group L",
  "Round of 32", "Round of 16", "Quarter-Finals", "Semi-Finals", "Third Place Play-off", "Final",
];

const WC_ROUND_GRADIENTS: Record<string, string> = {
  "Round of 32": "from-blue-500/80 to-blue-700/80",
  "Round of 16": "from-indigo-500/80 to-indigo-700/80",
  "Quarter-Finals": "from-purple-500/80 to-purple-700/80",
  "Semi-Finals": "from-amber-500/80 to-amber-700/80",
  "Third Place Play-off": "from-orange-500/80 to-orange-700/80",
  "Final": "from-yellow-500/80 to-red-600/80",
};

const roundOrder: Record<string, number> = {
  "Group Stage": 0, "3rd Place Deciders": 1, "Round of 32": 2, "Round of 16": 3,
  "Quarter-Finals": 4, "Semi-Finals": 5, "3rd Place Play-off": 6, "Final": 7, "Knockout Stage": 3,
};

const roundColors: Record<string, string> = {
  "Group Stage": "from-emerald-600/80 to-emerald-800/80",
  "3rd Place Deciders": "from-amber-600/80 to-amber-800/80",
  "Round of 32": "from-blue-600/80 to-blue-800/80",
  "Round of 16": "from-indigo-600/80 to-indigo-800/80",
  "Quarter-Finals": "from-purple-600/80 to-purple-800/80",
  "Semi-Finals": "from-rose-600/80 to-rose-800/80",
  "3rd Place Play-off": "from-orange-600/80 to-orange-800/80",
  "Final": "from-yellow-500/80 to-amber-600/80",
  "Knockout Stage": "from-violet-600/80 to-violet-800/80",
};

const phoneToFlag = (phone: string | null): string | null => {
  if (!phone) return null;
  const clean = phone.replace(/\s/g, "");
  const prefixMap: Record<string, string> = {
    "+44": "🇬🇧", "+1": "🇺🇸", "+353": "🇮🇪", "+33": "🇫🇷", "+49": "🇩🇪",
    "+34": "🇪🇸", "+39": "🇮🇹", "+31": "🇳🇱", "+32": "🇧🇪", "+351": "🇵🇹",
    "+41": "🇨🇭", "+46": "🇸🇪", "+47": "🇳🇴", "+45": "🇩🇰", "+48": "🇵🇱",
    "+43": "🇦🇹", "+30": "🇬🇷", "+90": "🇹🇷", "+55": "🇧🇷", "+52": "🇲🇽",
    "+54": "🇦🇷", "+57": "🇨🇴", "+61": "🇦🇺", "+64": "🇳🇿", "+91": "🇮🇳",
    "+86": "🇨🇳", "+81": "🇯🇵", "+82": "🇰🇷", "+966": "🇸🇦", "+971": "🇦🇪",
    "+234": "🇳🇬", "+27": "🇿🇦", "+20": "🇪🇬", "+212": "🇲🇦", "+7": "🇷🇺",
  };
  for (const prefix of Object.keys(prefixMap).sort((a, b) => b.length - a.length)) {
    if (clean.startsWith(prefix)) return prefixMap[prefix];
  }
  return null;
};

const CopyText = ({ text, className = "" }: { text: string; className?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); toast.success("Copied!"); setTimeout(() => setCopied(false), 1500); }}
      className={`group inline-flex items-center gap-1 hover:text-foreground transition-colors ${className}`} title="Click to copy">
      <span className="truncate">{text}</span>
      {copied ? <Check className="h-3 w-3 text-success shrink-0" /> : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-60 shrink-0" />}
    </button>
  );
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-0.5 rounded hover:bg-muted/60 transition-colors" title="Copy">
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

function groupByQuantity(items: InventoryItem[]) {
  const groups: Map<string, InventoryItem[]> = new Map();
  items.forEach(item => {
    const key = item.purchase_id ? `purchase_${item.purchase_id}` : `seat_${item.event_id}_${[item.section || item.category || "", item.block || "", item.row_name || ""].join("|")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  return Array.from(groups.entries()).map(([key, items]) => ({
    key, items: items.sort((a, b) => (a.seat || "").localeCompare(b.seat || "", undefined, { numeric: true })), qty: items.length,
  }));
}

function getParsedEvent(ev: { home_team: string; away_team: string; match_code: string; venue?: string | null }) {
  const parsed = parseEventTeams(ev.home_team, ev.away_team, ev.match_code);
  // If matchNum still not found, try match_code with WC2026 format
  if (!parsed.matchNum) {
    const m = ev.match_code.match(/(?:WC2026-M|#M)(\d+)/);
    if (m) {
      parsed.matchNum = m[1];
      parsed.round = getRoundFromMatchNum(parseInt(m[1]));
    }
  }
  return parsed;
}

const orderRowColors = [
  "border-l-4 border-l-emerald-500/60",
  "border-l-4 border-l-blue-500/60",
  "border-l-4 border-l-purple-500/60",
  "border-l-4 border-l-amber-500/60",
  "border-l-4 border-l-rose-500/60",
  "border-l-4 border-l-cyan-500/60",
  "border-l-4 border-l-indigo-500/60",
  "border-l-4 border-l-orange-500/60",
];

const categoryColors: Record<string, string> = {
  "Cat 1": "from-amber-500/70 to-amber-700/70",
  "Cat 2": "from-blue-500/70 to-blue-700/70",
  "Cat 3": "from-emerald-500/70 to-emerald-700/70",
  "Cat 4": "from-purple-500/70 to-purple-700/70",
};

const GRADIENT_PALETTE = [
  "from-violet-600/90 to-indigo-700/90",
  "from-emerald-600/90 to-teal-700/90",
  "from-rose-600/90 to-pink-700/90",
  "from-amber-600/90 to-orange-700/90",
  "from-sky-600/90 to-cyan-700/90",
  "from-fuchsia-600/90 to-purple-700/90",
];

// ── Main Component ──
export default function WorldCup() {
  const [tab, setTab] = useState("orders");

  const [filterRound, setFilterRound] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterVenue, setFilterVenue] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");

  const [wcEvents, setWcEvents] = useState<EventInfo[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [assignments, setAssignments] = useState<Record<string, AssignmentInfo>>({});
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);

  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [assignOrder, setAssignOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);
  const [showAddInv, setShowAddInv] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [collapsedRounds, setCollapsedRounds] = useState<Set<string>>(new Set());
  const [collapsedEvents, setCollapsedEvents] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [collapsedInvRounds, setCollapsedInvRounds] = useState<Set<string>>(new Set());
  const [manualAssigned, setManualAssigned] = useState<Set<string>>(new Set());
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [paidConfirm, setPaidConfirm] = useState<string | null>(null);
  const [paidTimestamps, setPaidTimestamps] = useState<Record<string, string>>({});
  const [financeRoundFilter, setFinanceRoundFilter] = useState("all");
  const [quickAssignOrderId, setQuickAssignOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: evData } = await supabase
      .from("events")
      .select("id,match_code,home_team,away_team,event_date,competition,venue")
      .ilike("competition", "%world cup%");
    const wcEvs = (evData || []) as EventInfo[];
    setWcEvents(wcEvs);
    const wcIds = wcEvs.map(e => e.id);
    if (wcIds.length === 0) {
      setOrders([]); setPurchases([]); setInventory([]); setOrderLines([]); setAssignments({});
      return;
    }

    const [ordRes, purchRes, invRes, olRes, supRes, platRes] = await Promise.all([
      supabase.from("orders").select("*, events(match_code,home_team,away_team,event_date,venue), platforms(name)").in("event_id", wcIds).order("order_date", { ascending: false }),
      supabase.from("purchases").select("id,supplier_order_id,quantity,unit_cost,total_cost,total_cost_gbp,currency,purchase_date,supplier_paid,notes,category,section,event_id,supplier_id,status").in("event_id", wcIds),
      supabase.from("inventory").select("*, events(match_code,home_team,away_team,event_date,venue)").in("event_id", wcIds).order("created_at", { ascending: false }),
      supabase.from("order_lines").select("inventory_id,order_id"),
      supabase.from("suppliers").select("id,name"),
      supabase.from("platforms").select("id,name"),
    ]);
    const loadedOrders = (ordRes.data as any) || [];
    setOrders(loadedOrders);
    setPurchases(purchRes.data || []);
    setInventory((invRes.data as any) || []);
    setSuppliers(supRes.data || []);
    setPlatforms(platRes.data || []);

    const cIds: string[] = [];
    loadedOrders.forEach((o: Order) => { if (o.contact_id) cIds.push(o.contact_id); });
    const uniqueContactIds = [...new Set(cIds)];
    if (uniqueContactIds.length > 0) {
      const { data: contactData } = await supabase.from("suppliers").select("id,name").in("id", uniqueContactIds as string[]);
      setContacts((contactData || []).map(c => ({ id: c.id, name: c.name })));
    }

    const wcOrderIds = new Set(loadedOrders.map((o: Order) => o.id));
    const filteredOL = (olRes.data || []).filter((ol: OrderLine) => wcOrderIds.has(ol.order_id));
    setOrderLines(filteredOL);

    if (filteredOL.length > 0) {
      const invIds = filteredOL.map((ol: OrderLine) => ol.inventory_id);
      const { data: invInfo } = await supabase.from("inventory").select("id,purchase_id").in("id", invIds);
      const purchaseIds = [...new Set((invInfo || []).map(i => i.purchase_id).filter((id): id is string => !!id))];
      const { data: purchInfo } = purchaseIds.length > 0
        ? await supabase.from("purchases").select("id, suppliers(name,contact_name)").in("id", purchaseIds)
        : { data: [] };
      const purchaseMap = new Map((purchInfo || []).map((p: any) => [p.id, p]));
      const invMap = new Map((invInfo || []).map(i => [i.id, i]));
      const assignMap: Record<string, AssignmentInfo> = {};
      for (const ol of filteredOL) {
        if (!assignMap[ol.order_id]) assignMap[ol.order_id] = { linked_count: 0, supplier_contact_name: null };
        assignMap[ol.order_id].linked_count++;
        if (!assignMap[ol.order_id].supplier_contact_name) {
          const inv = invMap.get(ol.inventory_id);
          if (inv) {
            const purchase = purchaseMap.get(inv.purchase_id) as any;
            if (purchase?.suppliers?.contact_name) assignMap[ol.order_id].supplier_contact_name = purchase.suppliers.contact_name;
            else if (purchase?.suppliers?.name) assignMap[ol.order_id].supplier_contact_name = purchase.suppliers.name;
          }
        }
      }
      setAssignments(assignMap);
    } else {
      setAssignments({});
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Parsed event data ──
  const parsedEventsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getParsedEvent>>();
    wcEvents.forEach(e => map.set(e.id, getParsedEvent(e)));
    return map;
  }, [wcEvents]);

  // Filter options
  const roundOptions = useMemo(() => {
    const rounds = new Set<string>();
    parsedEventsMap.forEach(p => rounds.add(p.round));
    return [...rounds].sort((a, b) => (roundOrder[a] ?? 99) - (roundOrder[b] ?? 99)).map(r => ({ value: r, label: r }));
  }, [parsedEventsMap]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    parsedEventsMap.forEach(p => {
      if (p.team1 && !p.team1.match(/^W\d|^Winner|^Runner/i)) set.add(p.team1);
      if (p.team2 && !p.team2.match(/^W\d|^Winner|^Runner/i)) set.add(p.team2);
    });
    return [...set].sort().map(c => ({ value: c.toLowerCase(), label: `${getFlag(c)} ${c}` }));
  }, [parsedEventsMap]);

  const venueOptions = useMemo(() => {
    const set = new Set<string>();
    wcEvents.forEach(e => { if (e.venue) set.add(e.venue.trim()); });
    return [...set].sort().map(v => ({ value: v, label: v }));
  }, [wcEvents]);

  const eventOptions = useMemo(() => {
    const evIdsWithOrders = new Set(orders.map(o => o.event_id));
    return wcEvents
      .filter(e => evIdsWithOrders.has(e.id))
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .map(e => {
        const p = parsedEventsMap.get(e.id);
        const label = p?.matchNum ? `M${p.matchNum} — ${p.team1} vs ${p.team2}` : `${e.home_team} vs ${e.away_team}`;
        return { value: e.id, label };
      });
  }, [wcEvents, orders, parsedEventsMap]);

  const platformOptions = useMemo(() => {
    const set = new Map<string, string>();
    orders.forEach(o => {
      if (o.platforms?.name) set.set(o.platform_id || "", o.platforms.name);
      if (o.contact_id) {
        const c = contacts.find(c => c.id === o.contact_id);
        if (c) set.set(`contact-${c.id}`, `Contact: ${c.name}`);
      }
    });
    return [...set.entries()].map(([value, label]) => ({ value, label }));
  }, [orders, contacts]);

  // Filter events
  const filteredEventIds = useMemo(() => {
    return new Set(wcEvents.filter(e => {
      const p = parsedEventsMap.get(e.id);
      if (!p) return false;
      if (filterRound !== "all" && p.round !== filterRound) return false;
      if (filterCountry !== "all") {
        const lower = filterCountry.toLowerCase();
        if (p.team1.toLowerCase() !== lower && p.team2.toLowerCase() !== lower) return false;
      }
      if (filterVenue !== "all" && (e.venue || "").trim() !== filterVenue) return false;
      if (filterEvent !== "all" && e.id !== filterEvent) return false;
      return true;
    }).map(e => e.id));
  }, [wcEvents, parsedEventsMap, filterRound, filterCountry, filterVenue, filterEvent]);

  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const platformMap = useMemo(() => Object.fromEntries(platforms.map(p => [p.id, p])), [platforms]);
  const assignedInvSet = useMemo(() => new Set(orderLines.map(ol => ol.inventory_id)), [orderLines]);

  // ── ORDERS TAB ──
  const filteredOrders = useMemo(() => orders.filter(o => {
    if (!filteredEventIds.has(o.event_id)) return false;
    if (filterPlatform !== "all") {
      if (filterPlatform.startsWith("contact-")) {
        const cId = filterPlatform.replace("contact-", "");
        if (o.contact_id !== cId) return false;
      } else if (o.platform_id !== filterPlatform) return false;
    }
    if (search && tab === "orders") {
      const q = search.toLowerCase();
      return (o.order_ref || "").toLowerCase().includes(q) || (o.buyer_name || "").toLowerCase().includes(q) ||
        (o.buyer_email || "").toLowerCase().includes(q) || (o.buyer_phone || "").toLowerCase().includes(q) ||
        (o.events?.home_team || "").toLowerCase().includes(q) || (o.events?.away_team || "").toLowerCase().includes(q) ||
        (o.platforms?.name || "").toLowerCase().includes(q);
    }
    return true;
  }), [orders, filteredEventIds, filterPlatform, search, tab]);

  // Group by Round → Event → Category
  const groupedByRound = useMemo(() => {
    const eventMap = new Map<string, { event: Order["events"]; eventIds: string[]; orders: Order[]; parsed: ReturnType<typeof getParsedEvent> | null }>();
    filteredOrders.forEach(o => {
      const ev = o.events;
      if (!ev) return;
      const key = getEventKey(ev.home_team, ev.away_team, ev.event_date);
      if (!eventMap.has(key)) {
        const p = parsedEventsMap.get(o.event_id) || null;
        eventMap.set(key, { event: ev, eventIds: [o.event_id], orders: [], parsed: p });
      } else {
        const g = eventMap.get(key)!;
        if (!g.eventIds.includes(o.event_id)) g.eventIds.push(o.event_id);
      }
      eventMap.get(key)!.orders.push(o);
    });

    const roundMap = new Map<string, typeof eventMap extends Map<string, infer V> ? V[] : never>();
    eventMap.forEach((group) => {
      const round = group.parsed?.round || "Group Stage";
      if (!roundMap.has(round)) roundMap.set(round, []);
      roundMap.get(round)!.push(group);
    });

    return [...roundMap.entries()]
      .sort(([a], [b]) => (roundOrder[a] ?? 99) - (roundOrder[b] ?? 99))
      .map(([round, events]) => ({
        round,
        events: events.sort((a, b) => (a.event?.event_date || "").localeCompare(b.event?.event_date || "")),
        totalOrders: events.reduce((s, e) => s + e.orders.length, 0),
        totalTickets: events.reduce((s, e) => s + e.orders.reduce((t, o) => t + o.quantity, 0), 0),
      }));
  }, [filteredOrders, parsedEventsMap]);

  const isFullyAssigned = (order: Order) => { const info = assignments[order.id]; return info && info.linked_count >= order.quantity; };

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filterRound !== "all") c++;
    if (filterCountry !== "all") c++;
    if (filterVenue !== "all") c++;
    if (filterEvent !== "all") c++;
    if (filterPlatform !== "all") c++;
    return c;
  }, [filterRound, filterCountry, filterVenue, filterEvent, filterPlatform]);

  const clearAllFilters = () => { setFilterRound("all"); setFilterCountry("all"); setFilterVenue("all"); setFilterEvent("all"); setFilterPlatform("all"); };

  const toggleOrderSelect = (id: string) => setSelectedOrderIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelectedOrderIds(new Set());

  const handleBulkFulfill = async () => {
    const ids = [...selectedOrderIds];
    await supabase.from("orders").update({ status: "fulfilled" }).in("id", ids);
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, status: "fulfilled" } : o));
    toast.success(`${ids.length} order${ids.length !== 1 ? "s" : ""} marked fulfilled`);
    clearSelection();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedOrderIds.size} selected order(s)?`)) return;
    const ids = [...selectedOrderIds];
    await supabase.from("orders").delete().in("id", ids);
    setOrders(prev => prev.filter(o => !ids.includes(o.id)));
    toast.success(`${ids.length} order${ids.length !== 1 ? "s" : ""} deleted`);
    clearSelection();
  };

  const handleBulkExport = () => {
    const selected = orders.filter(o => selectedOrderIds.has(o.id));
    const csv = ["Order Ref,Buyer,Qty,Sale Price,Status,Delivery", ...selected.map(o =>
      `${o.order_ref || ""},${o.buyer_name || ""},${o.quantity},${o.sale_price},${o.status},${o.delivery_status || ""}`
    )].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "wc-orders-export.csv"; a.click();
    toast.success("Exported selected orders");
  };

  const updateField = useCallback(async (orderId: string, field: string, value: any) => {
    await supabase.from("orders").update({ [field]: value }).eq("id", orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, [field]: value } : o));
  }, []);

  const getDeadline = (eventDate: string | undefined) => eventDate ? subHours(new Date(eventDate), 48) : null;
  const getDeadlineStatus = (eventDate: string | undefined) => {
    const deadline = getDeadline(eventDate);
    if (!deadline) return { label: "—", color: "" };
    const diff = deadline.getTime() - Date.now();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (diff < 0) return { label: "OVERDUE", color: "text-destructive font-bold" };
    if (days === 0) return { label: `${hours}h left`, color: "text-destructive font-bold" };
    if (days <= 3) return { label: `${days}d ${hours}h`, color: "text-warning font-semibold" };
    return { label: `${days}d`, color: "text-muted-foreground" };
  };

  const toggleRound = (round: string) => setCollapsedRounds(prev => { const n = new Set(prev); n.has(round) ? n.delete(round) : n.add(round); return n; });
  const toggleEvent = (key: string) => setCollapsedEvents(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleCategory = (key: string) => setCollapsedCategories(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleSupplierPaid = async (id: string, val: boolean) => {
    // Already handled via confirmation popover
    await supabase.from("purchases").update({ supplier_paid: !val }).eq("id", id);
    setPurchases(prev => prev.map(p => p.id === id ? { ...p, supplier_paid: !val } : p));
    if (!val) setPaidTimestamps(prev => ({ ...prev, [id]: format(new Date(), "dd MMM HH:mm") }));
    toast.success(!val ? "Marked as paid" : "Marked as unpaid");
    setPaidConfirm(null);
  };

  // ── FINANCE TAB ──
  const countryFilter = filterCountry;
  const { unique: dedupedEvents, groupedIds } = useMemo(() => deduplicateEvents(wcEvents), [wcEvents]);

  const financeData = useMemo(() => {
    const evs = countryFilter === "all" ? dedupedEvents : dedupedEvents.filter(e =>
      e.home_team.toLowerCase() === countryFilter || e.away_team.toLowerCase() === countryFilter
    );
    const eventIdSet = new Set<string>();
    evs.forEach(e => (groupedIds[e.id] || [e.id]).forEach(id => eventIdSet.add(id)));
    const fp = purchases.filter(p => eventIdSet.has(p.event_id));
    const fo = orders.filter(o => eventIdSet.has(o.event_id) && o.status !== "cancelled" && o.status !== "refunded");
    return { events: evs, purchases: fp, orders: fo };
  }, [countryFilter, dedupedEvents, groupedIds, purchases, orders]);

  const totalRevenue = financeData.orders.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
  const totalCost = financeData.purchases.reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
  const totalProfit = totalRevenue - totalCost;

  const eventBreakdown = useMemo(() => {
    return financeData.events.map(ev => {
      const allIds = groupedIds[ev.id] || [ev.id];
      const evP = financeData.purchases.filter(p => allIds.includes(p.event_id));
      const evO = financeData.orders.filter(o => allIds.includes(o.event_id));
      const cost = evP.reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0);
      const revenue = evO.reduce((s, o) => s + (o.net_received || o.sale_price - o.fees), 0);
      return { ev, evPurchases: evP, evOrders: evO, cost, revenue, profit: revenue - cost,
        ticketsBought: evP.reduce((s, p) => s + p.quantity, 0), ticketsSold: evO.reduce((s, o) => s + o.quantity, 0) };
    }).filter(e => e.cost > 0 || e.revenue > 0).sort((a, b) => new Date(a.ev.event_date).getTime() - new Date(b.ev.event_date).getTime());
  }, [financeData, groupedIds]);

  const togglePaymentReceived = async (id: string, val: boolean) => {
    await supabase.from("orders").update({ payment_received: !val }).eq("id", id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, payment_received: !val } : o));
    toast.success(!val ? "Marked as received" : "Marked as pending");
  };

  // ── PURCHASES TAB ──
  const filteredPurchases = useMemo(() => purchases.filter(p => {
    if (!filteredEventIds.has(p.event_id)) return false;
    if (search && tab === "purchases") {
      const q = search.toLowerCase();
      const sup = supplierMap[p.supplier_id];
      return (p.category || "").toLowerCase().includes(q) || (sup?.name || "").toLowerCase().includes(q) || (p.notes || "").toLowerCase().includes(q);
    }
    return true;
  }), [purchases, filteredEventIds, search, tab, supplierMap]);

  const purchasesByEvent = useMemo(() => {
    const map = new Map<string, { event: EventInfo | null; purchases: Purchase[] }>();
    filteredPurchases.forEach(p => {
      if (!map.has(p.event_id)) {
        const ev = wcEvents.find(e => e.id === p.event_id) || null;
        map.set(p.event_id, { event: ev, purchases: [] });
      }
      map.get(p.event_id)!.purchases.push(p);
    });
    return [...map.values()].sort((a, b) => (a.event?.event_date || "").localeCompare(b.event?.event_date || ""));
  }, [filteredPurchases, wcEvents]);

  // ── INVENTORY TAB ──
  const filteredInv = useMemo(() => inventory.filter(i => {
    if (!filteredEventIds.has(i.event_id)) return false;
    if (search && tab === "inventory") {
      const q = search.toLowerCase();
      return (i.category || "").toLowerCase().includes(q) || (i.section || "").toLowerCase().includes(q) ||
        (i.first_name || "").toLowerCase().includes(q) || (i.last_name || "").toLowerCase().includes(q) ||
        (i.email || "").toLowerCase().includes(q) || (i.events?.home_team || "").toLowerCase().includes(q) ||
        (i.events?.away_team || "").toLowerCase().includes(q);
    }
    return true;
  }), [inventory, filteredEventIds, search, tab]);

  const groupedInv = useMemo(() => {
    const map: Record<string, { event: InventoryItem["events"]; eventId: string; items: InventoryItem[] }> = {};
    filteredInv.forEach(i => {
      if (!map[i.event_id]) map[i.event_id] = { event: i.events, eventId: i.event_id, items: [] };
      map[i.event_id].items.push(i);
    });
    return Object.values(map).sort((a, b) => (a.event?.event_date || "").localeCompare(b.event?.event_date || ""));
  }, [filteredInv]);

  // Group inventory events by WC round
  const invRoundGroups = useMemo(() => {
    const roundMap: Record<string, typeof groupedInv> = {};
    groupedInv.forEach(g => {
      const round = getWCRound(g.event?.match_code);
      if (!roundMap[round]) roundMap[round] = [];
      roundMap[round].push(g);
    });
    return Object.entries(roundMap).sort(([a], [b]) => {
      const ia = WC_ROUND_ORDER.indexOf(a);
      const ib = WC_ROUND_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [groupedInv]);

  const toggleItemExpanded = (id: string) => setExpandedItems(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleGroupCollapsed = (key: string) => setCollapsedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleInvRound = (key: string) => setCollapsedInvRounds(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleManualAssigned = (key: string) => setManualAssigned(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const isGroupAssigned = (groupKey: string, groupItems: InventoryItem[]) => manualAssigned.has(groupKey) || (groupItems.length > 0 && groupItems.every(i => assignedInvSet.has(i.id)));

  const renderOrderRow = (o: Order, oIdx: number) => {
    const flag = phoneToFlag(o.buyer_phone);
    const assigned = isFullyAssigned(o);
    const assignInfo = assignments[o.id];
    const colorClass = orderRowColors[oIdx % orderRowColors.length];
    const isDelivered = o.delivery_status === "delivered" || o.delivery_status === "completed";
    return (
      <TableRow key={o.id}
        className={cn("cursor-pointer text-xs h-10 transition-colors", colorClass, isDelivered ? "bg-success/8 hover:bg-success/15" : "hover:bg-muted/40", selectedOrderIds.has(o.id) && "bg-primary/10")}
        onClick={() => setSelectedOrderId(o.id)}>
        <TableCell className="py-2 w-[30px]" onClick={e => e.stopPropagation()}>
          <Checkbox checked={selectedOrderIds.has(o.id)} onCheckedChange={() => toggleOrderSelect(o.id)} className="h-4 w-4" />
        </TableCell>
        <TableCell className="font-mono font-bold text-xs py-2">{o.order_ref ? <CopyText text={o.order_ref} className="font-mono font-bold text-foreground text-xs" /> : "—"}</TableCell>
        <TableCell className="py-2">
          {(() => {
            const ai = assignments[o.id];
            const contactName = ai?.supplier_contact_name;
            const platformName = o.platforms?.name || "Direct";
            if (contactName) return <div><span className="font-medium text-foreground text-xs">{contactName}</span><span className="block text-[10px] text-muted-foreground">{platformName}</span></div>;
            return <span className="text-muted-foreground">{platformName}</span>;
          })()}
        </TableCell>
        <TableCell className="py-2"><span className="font-medium">{o.buyer_name || "—"}</span>{flag && <span className="ml-1">{flag}</span>}</TableCell>
        <TableCell className="py-2">{o.buyer_phone ? <CopyText text={o.buyer_phone} className="text-muted-foreground text-xs" /> : <span className="text-muted-foreground/40 text-xs">—</span>}</TableCell>
        <TableCell className="py-2">{o.buyer_email ? <CopyText text={o.buyer_email} className="text-muted-foreground text-xs max-w-[140px]" /> : <span className="text-muted-foreground/40 text-xs">—</span>}</TableCell>
        <TableCell className="text-center font-mono font-bold py-2">{o.quantity}</TableCell>
        <TableCell className="text-right font-mono py-2">{currSym(o.currency)}{Number(o.sale_price).toFixed(0)}</TableCell>
        <TableCell className="text-center py-2">
          <Checkbox checked={isDelivered}
            onCheckedChange={checked => updateField(o.id, "delivery_status", checked ? "delivered" : "pending")}
            onClick={e => e.stopPropagation()} className="h-5 w-5 data-[state=checked]:bg-success data-[state=checked]:border-success" />
        </TableCell>
        <TableCell className="py-2">
          {isDelivered
            ? <Badge variant="outline" className="text-[10px] py-0 bg-success/10 text-success border-success/20 font-bold">DELIVERED</Badge>
            : <Badge variant="outline" className="text-[10px] py-0 bg-warning/10 text-warning border-warning/20 font-bold">OUTSTANDING</Badge>}
        </TableCell>
        <TableCell className="py-2">
          {assigned ? <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="h-3 w-3" />{assignInfo?.supplier_contact_name || "Assigned"}</span>
            : assignInfo?.linked_count ? <span className="text-xs text-warning font-medium">{assignInfo.linked_count}/{o.quantity}</span>
            : <span className="text-muted-foreground/40 text-xs">—</span>}
        </TableCell>
        <TableCell className="py-2">
          <Button size="sm" variant={assigned ? "ghost" : "outline"} className={`h-7 w-7 p-0 ${assigned ? "text-success" : ""}`}
            onClick={e => { e.stopPropagation(); setAssignOrder(o); }}>
            {assigned ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
          </Button>
        </TableCell>
        <TableCell className="py-2">
          <div className="flex items-center gap-0.5">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={e => { e.stopPropagation(); setEditOrder(o); }}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              onClick={async e => {
                e.stopPropagation();
                if (!confirm("Delete this order?")) return;
                const { data: lines } = await supabase.from("order_lines").select("inventory_id").eq("order_id", o.id);
                if (lines?.length) await supabase.from("inventory").update({ status: "available" as any }).in("id", lines.map(l => l.inventory_id));
                await supabase.from("order_lines").delete().eq("order_id", o.id);
                await supabase.from("refunds").delete().eq("order_id", o.id);
                if (o.contact_id) await supabase.from("balance_payments").delete().ilike("notes", `Auto: Order ${o.id}`);
                await supabase.from("orders").delete().eq("id", o.id);
                toast.success("Order deleted"); load();
              }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // ── Inventory rendering helper ──
  const renderInvGroup = (qg: ReturnType<typeof groupByQuantity>[number], groupIdx: number) => {
    const email = qg.items[0]?.email;
    const area = qg.items[0]?.block;
    const row = qg.items[0]?.row_name;
    const seats = qg.items.map(i => i.seat).filter(Boolean).join(", ");
    const isCollapsed = collapsedGroups.has(qg.key);
    const isAssigned = isGroupAssigned(qg.key, qg.items);
    const gradient = GRADIENT_PALETTE[groupIdx % GRADIENT_PALETTE.length];
    const leadName = [qg.items[0]?.first_name, qg.items[0]?.last_name].filter(Boolean).join(" ");

    return (
      <div key={qg.key} className={cn("rounded-xl overflow-hidden shadow-lg transition-all", isAssigned ? "opacity-50 saturate-50" : "")}>
        <div className={cn("bg-gradient-to-br text-white px-5 py-4", isAssigned ? "from-muted-foreground/40 to-muted-foreground/60" : gradient)}>
          <div className="flex items-start justify-between gap-3">
            <button className="flex-1 min-w-0 text-left" onClick={() => toggleGroupCollapsed(qg.key)}>
              <p className="text-[10px] uppercase tracking-widest font-medium text-white/60">Lead Booker</p>
              <p className="text-base font-bold truncate mt-0.5">{leadName || "Unassigned"}</p>
              {email && <p className="text-xs text-white/70 truncate mt-0.5 font-mono">{email}</p>}
            </button>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button variant="ghost" size="icon" className={cn("h-7 w-7 hover:bg-white/20", isAssigned ? "text-white" : "text-white/70")}
                onClick={e => { e.stopPropagation(); toggleManualAssigned(qg.key); }}>
                {isAssigned ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/70 hover:bg-white/20"
                onClick={e => { e.stopPropagation(); setSelectedInvId(qg.items[0]?.id || null); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white/70 hover:bg-white/20"
                onClick={async e => {
                  e.stopPropagation();
                  if (!confirm(`Delete ${qg.items.length} ticket${qg.items.length !== 1 ? "s" : ""}?`)) return;
                  const ids = qg.items.map(i => i.id);
                  await supabase.from("order_lines").delete().in("inventory_id", ids);
                  await supabase.from("inventory").delete().in("id", ids);
                  toast.success(`${qg.items.length} ticket${qg.items.length !== 1 ? "s" : ""} deleted`); load();
                }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {(() => {
            const groupTotalCost = qg.items.reduce((sum, i) => sum + (i.face_value || 0), 0);
            return (
              <div className="flex items-end justify-between mt-3">
                <div>
                  <p className="text-xs font-mono text-white/80">
                    {area && <>Area <span className="text-white font-semibold">{area}</span></>}
                    {row && <>{area ? " · " : ""}Row <span className="text-white font-semibold">{row}</span></>}
                    {seats && <>{(area || row) ? " · " : ""}Seats <span className="text-white font-semibold">{seats}</span></>}
                  </p>
                  {groupTotalCost > 0 && <p className="text-xs font-mono text-white/70 mt-1">Cost: <span className="text-white font-semibold">${groupTotalCost.toFixed(0)}</span><span className="text-white/50 ml-1">(${(groupTotalCost / qg.qty).toFixed(0)}/ea)</span></p>}
                </div>
                <div className="text-right"><p className="text-2xl font-black font-mono leading-none">{qg.qty}</p><p className="text-[9px] uppercase tracking-widest text-white/60 mt-0.5">Ticket{qg.qty !== 1 ? "s" : ""}</p></div>
              </div>
            );
          })()}
          <div className="flex justify-center mt-2">
            <button onClick={() => toggleGroupCollapsed(qg.key)} className="text-white/40 hover:text-white/80 transition-colors">
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div className="bg-card border border-t-0 rounded-b-xl">
            <div className="px-4 sm:px-5 py-4 flex flex-wrap gap-2">
              {qg.items.map((item, idx) => (
                <button key={item.id} onClick={() => toggleItemExpanded(item.id)}
                  className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-muted/60 transition-colors text-left", expandedItems.has(item.id) ? "bg-muted/60 border-primary/30" : "bg-muted/30")}>
                  <span className="flex items-center justify-center h-7 w-7 rounded bg-primary/10 text-primary text-xs font-bold font-mono">{item.seat || (idx + 1)}</span>
                  <div className="text-xs">
                    <p className="font-medium">{[item.first_name, item.last_name].filter(Boolean).join(" ") || "—"}</p>
                    <p className="text-muted-foreground">Ticket {idx + 1}/{qg.qty}{item.face_value != null && item.face_value > 0 && <span className="ml-1 text-foreground font-mono font-semibold">${item.face_value.toFixed(0)}</span>}</p>
                  </div>
                  {item.row_name && <Badge variant="outline" className="text-[9px] ml-1 font-mono">R{item.row_name}</Badge>}
                  <Badge variant="outline" className={cn("text-[9px]", statusColor[item.status] || "")}>{item.status}</Badge>
                  {expandedItems.has(item.id) ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                </button>
              ))}
            </div>
            {qg.items.filter(item => expandedItems.has(item.id)).map(item => (
              <div key={`detail-${item.id}`} className="border-t px-5 py-3 space-y-3 bg-muted/10">
                <p className="text-xs font-semibold text-muted-foreground">Seat {item.seat || "—"} · {[item.first_name, item.last_name].filter(Boolean).join(" ") || "Unknown"}</p>
                {(item.email || item.password || item.supporter_id) && (
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Login Details</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                      {item.email && <div><span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-0.5">FIFA Login</span><div className="flex items-center gap-1"><span className="font-medium truncate">{item.email}</span><CopyButton text={item.email} /></div></div>}
                      {item.password && <div><span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-0.5">FIFA Password</span><div className="flex items-center gap-1"><span className="font-mono font-medium">{item.password}</span><CopyButton text={item.password} /></div></div>}
                      {item.supporter_id && <div><span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block mb-0.5">Supporter ID</span><div className="flex items-center gap-1"><span className="font-mono font-medium">{item.supporter_id}</span><CopyButton text={item.supporter_id} /></div></div>}
                    </div>
                  </div>
                )}
                {(item.iphone_pass_link || item.android_pass_link || item.pk_pass_url) && (
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Digital Passes</p>
                    <div className="space-y-2">
                      {item.iphone_pass_link && <div className="flex items-center gap-2 text-xs"><Apple className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><a href={item.iphone_pass_link} target="_blank" rel="noopener" className="text-primary hover:underline truncate flex-1" onClick={e => e.stopPropagation()}>{item.iphone_pass_link}</a><CopyButton text={item.iphone_pass_link} /></div>}
                      {item.android_pass_link && <div className="flex items-center gap-2 text-xs"><Smartphone className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><a href={item.android_pass_link} target="_blank" rel="noopener" className="text-primary hover:underline truncate flex-1" onClick={e => e.stopPropagation()}>{item.android_pass_link}</a><CopyButton text={item.android_pass_link} /></div>}
                      {item.pk_pass_url && <div className="flex items-center gap-2 text-xs"><Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><a href={item.pk_pass_url} target="_blank" rel="noopener" className="text-primary hover:underline truncate flex-1" onClick={e => e.stopPropagation()}>Download</a><CopyButton text={item.pk_pass_url} /></div>}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelectedInvId(item.id)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={async e => {
                      e.stopPropagation();
                      if (!confirm("Delete this ticket?")) return;
                      await supabase.from("order_lines").delete().eq("inventory_id", item.id);
                      await supabase.from("inventory").delete().eq("id", item.id);
                      toast.success("Ticket deleted"); load();
                    }}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderInvEventCard = (group: typeof groupedInv[number]) => {
    const total = group.items.length;
    const available = group.items.filter(i => i.status === "available").length;
    const sold = group.items.filter(i => i.status === "sold").length;
    const assigned = group.items.filter(i => assignedInvSet.has(i.id)).length;
    const isExpanded = expandedEvent === group.eventId;
    const eventDate = group.event?.event_date ? new Date(group.event.event_date) : null;
    const parsed = group.event ? getParsedEvent(group.event) : null;
    const flag1 = parsed ? getFlag(parsed.team1) : "";
    const flag2 = parsed ? getFlag(parsed.team2) : "";
    const team1 = parsed?.team1 || group.event?.home_team || "Unknown";
    const team2 = parsed?.team2 || group.event?.away_team || "Unknown";
    const matchLabel = parsed?.matchNum ? `M${parsed.matchNum}` : null;

    const availableItems = group.items.filter(i => i.status === "available");
    const qtyGroups = groupByQuantity(availableItems);
    const singles = qtyGroups.filter(g => g.qty === 1).length;
    const pairs = qtyGroups.filter(g => g.qty === 2).length;
    const quadsPlus = qtyGroups.filter(g => g.qty >= 4).length;

    return (
      <div key={group.eventId} className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <button onClick={() => setExpandedEvent(isExpanded ? null : group.eventId)}
          className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/40">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-primary/10 text-primary"><Ticket className="h-5 w-5" /></div>
            <div>
              <div className="flex items-center gap-2">
                {matchLabel && <Badge className="bg-primary/20 text-primary text-[10px] font-bold border-primary/30">{matchLabel}</Badge>}
                <p className="font-bold text-base">
                  {flag1 && <span className="mr-1">{flag1}</span>}{team1}
                  <span className="text-muted-foreground font-normal mx-2">vs</span>
                  {flag2 && <span className="mr-1">{flag2}</span>}{team2}
                </p>
              </div>
              {eventDate && <span className="text-xs font-semibold text-foreground">{format(eventDate, "EEE dd MMM yyyy, HH:mm")}</span>}
              {group.event?.venue && <span className="text-xs text-muted-foreground ml-2">• {group.event.venue}</span>}
              <div className="flex items-center gap-1.5 mt-1.5">
                {singles > 0 && <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground"><User className="h-2.5 w-2.5 mr-0.5" />{singles} single{singles !== 1 ? "s" : ""}</Badge>}
                {pairs > 0 && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20"><Users className="h-2.5 w-2.5 mr-0.5" />{pairs} pair{pairs !== 1 ? "s" : ""}</Badge>}
                {quadsPlus > 0 && <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20">{quadsPlus} quad+</Badge>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <div className="text-center px-3 py-1 rounded-md bg-muted/60"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p><p className="text-sm font-bold font-mono">{total}</p></div>
              {available > 0 && <Badge variant="outline" className="text-[10px] font-bold uppercase bg-success/10 text-success border-success/20">{available} avail</Badge>}
              {sold > 0 && <Badge variant="outline" className="text-[10px] font-bold uppercase bg-primary/10 text-primary border-primary/20">{sold} sold</Badge>}
              <div className="text-center px-3 py-1 rounded-md bg-muted/60"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Assigned</p><p className="text-sm font-bold font-mono">{assigned}/{total}</p></div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={async e => {
                e.stopPropagation();
                if (!confirm(`Delete all inventory for this event?`)) return;
                const ids = group.items.map(i => i.id);
                await supabase.from("order_lines").delete().in("inventory_id", ids);
                await supabase.from("inventory").delete().in("id", ids);
                toast.success("Inventory deleted"); load();
              }}>
              <Trash2 className="h-4 w-4" />
            </Button>
            {isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
          </div>
        </button>

        {isExpanded && (() => {
          const sectionMap: Record<string, InventoryItem[]> = {};
          group.items.forEach(item => { const sec = item.section || item.category || "Unknown"; if (!sectionMap[sec]) sectionMap[sec] = []; sectionMap[sec].push(item); });
          return (
            <div className="border-t">
              <div className="px-6 py-6 bg-muted/20 text-center space-y-3">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
                  {flag1 && <span className="mr-2">{flag1}</span>}{team1} <span className="text-destructive">v</span> {flag2 && <span className="mr-2">{flag2}</span>}{team2}
                </h2>
                {eventDate && <p className="text-xs tracking-widest text-muted-foreground uppercase font-mono">{format(eventDate, "dd MMMM yyyy")} · {format(eventDate, "HH:mm")}{group.event?.venue && <> · {group.event.venue}</>}</p>}
                <div className="inline-flex items-center gap-6 border rounded-lg px-6 py-3 bg-card mt-2">
                  <div className="text-center"><p className="text-lg font-bold text-primary font-mono">{total}</p><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total</p></div>
                  <div className="text-center"><p className="text-lg font-bold text-primary font-mono">{assigned}</p><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Assigned</p></div>
                </div>
              </div>
              {Object.entries(sectionMap).map(([sectionName, sectionItems]) => {
                const allGroups = groupByQuantity(sectionItems);
                const unassignedGroups = allGroups.filter(qg => !isGroupAssigned(qg.key, qg.items));
                const assignedGroups = allGroups.filter(qg => isGroupAssigned(qg.key, qg.items));
                const sectionTotalCost = sectionItems.reduce((sum, i) => sum + (i.face_value || 0), 0);
                const sectionPerTicket = sectionItems.length > 0 && sectionTotalCost > 0 ? sectionTotalCost / sectionItems.length : 0;

                return (
                  <div key={sectionName} className="px-5 py-4 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-sm font-black uppercase tracking-wide">{sectionName}</h3>
                      <Badge className="bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wider">{sectionItems.length} Ticket{sectionItems.length !== 1 ? "s" : ""}</Badge>
                      {sectionTotalCost > 0 && <Badge variant="outline" className="text-[10px] font-bold bg-muted/60">Total: ${sectionTotalCost.toFixed(0)} {sectionPerTicket > 0 && `($${sectionPerTicket.toFixed(0)}/ea)`}</Badge>}
                    </div>
                    {unassignedGroups.length > 0 && <div className="space-y-4">{unassignedGroups.map((qg, i) => renderInvGroup(qg, i))}</div>}
                    {assignedGroups.length > 0 && (
                      <div className="space-y-3 mt-4">
                        <div className="flex items-center gap-2"><div className="h-px flex-1 bg-border" /><span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-2">Assigned</span><div className="h-px flex-1 bg-border" /></div>
                        {assignedGroups.map((qg, i) => renderInvGroup(qg, i + unassignedGroups.length))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="sticky top-0 z-10 bg-background border-b border-border shrink-0">
        <div className="px-6 pt-4 pb-2">
          <h1 className="text-2xl font-bold tracking-tight">World Cup 2026</h1>
          <p className="text-muted-foreground text-sm mb-3">Dedicated view for all World Cup fixtures</p>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="orders"><ShoppingCart className="h-3.5 w-3.5 mr-1.5" />Orders</TabsTrigger>
              <TabsTrigger value="purchases"><Package className="h-3.5 w-3.5 mr-1.5" />Purchases</TabsTrigger>
              <TabsTrigger value="finance"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Finance</TabsTrigger>
              <TabsTrigger value="inventory"><Ticket className="h-3.5 w-3.5 mr-1.5" />Inventory</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── ORDERS TAB ── */}
        {tab === "orders" && (
          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">{activeFilterCount}</Badge>}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[320px] sm:w-[360px]">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-5 mt-6">
                    <FilterSelect label="Round" value={filterRound} onValueChange={setFilterRound} options={roundOptions} />
                    <FilterSelect label="Country" value={filterCountry} onValueChange={setFilterCountry} options={countryOptions} />
                    <FilterSelect label="Stadium" value={filterVenue} onValueChange={setFilterVenue} options={venueOptions} />
                    <FilterSelect label="Event" value={filterEvent} onValueChange={setFilterEvent} options={eventOptions} />
                    <FilterSelect label="Platform" value={filterPlatform} onValueChange={setFilterPlatform} options={platformOptions} />
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs text-muted-foreground">Clear all filters</Button>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
              {activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs text-muted-foreground h-9">Clear filters</Button>}
            </div>

            {/* Bulk Actions Toolbar */}
            {selectedOrderIds.size > 0 && (
              <div className="flex items-center gap-3 rounded-lg border bg-primary/5 border-primary/20 px-4 py-2.5 animate-fade-in">
                <span className="text-sm font-medium">{selectedOrderIds.size} selected</span>
                <div className="flex items-center gap-2 ml-auto">
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleBulkFulfill}><CheckCircle2 className="h-3.5 w-3.5" />Mark Fulfilled</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={handleBulkExport}><Download className="h-3.5 w-3.5" />Export Selected</Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive" onClick={handleBulkDelete}><Trash2 className="h-3.5 w-3.5" />Delete Selected</Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearSelection}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">{filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""} across {groupedByRound.reduce((s, r) => s + r.events.length, 0)} game{groupedByRound.reduce((s, r) => s + r.events.length, 0) !== 1 ? "s" : ""}</p>
              <AddOrderDialog onCreated={load} defaultClub="world-cup" />
            </div>

            <div className="space-y-4">
              {groupedByRound.length === 0 && <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No World Cup orders found</div>}
              {groupedByRound.map(roundGroup => {
                const isRoundCollapsed = collapsedRounds.has(roundGroup.round);
                const gradientClass = roundColors[roundGroup.round] || "from-muted to-muted";
                return (
                  <div key={roundGroup.round} className="space-y-3">
                    <button onClick={() => toggleRound(roundGroup.round)}
                      className={cn("w-full flex items-center justify-between px-5 py-3 rounded-xl bg-gradient-to-r text-white transition-all hover:opacity-90", gradientClass)}>
                      <div className="flex items-center gap-3">
                        {isRoundCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        <span className="font-black text-lg uppercase tracking-wide">{roundGroup.round}</span>
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="text-center"><p className="text-[10px] uppercase tracking-wider text-white/70">Events</p><p className="text-sm font-bold font-mono">{roundGroup.events.length}</p></div>
                        <div className="text-center"><p className="text-[10px] uppercase tracking-wider text-white/70">Orders</p><p className="text-sm font-bold font-mono">{roundGroup.totalOrders}</p></div>
                        <div className="text-center"><p className="text-[10px] uppercase tracking-wider text-white/70">Tickets</p><p className="text-sm font-bold font-mono">{roundGroup.totalTickets}</p></div>
                      </div>
                    </button>

                    {!isRoundCollapsed && (
                      <div className="space-y-3 pl-2">
                        {roundGroup.events.map((group) => {
                          const eventKey = group.eventIds[0];
                          const isEventCollapsed = collapsedEvents.has(eventKey);
                          const deadline = getDeadline(group.event?.event_date);
                          const deadlineStatus = getDeadlineStatus(group.event?.event_date);
                          const totalQty = group.orders.reduce((s, o) => s + o.quantity, 0);
                          const delivered = group.orders.filter(o => o.delivery_status === "delivered" || o.delivery_status === "completed").length;
                          const totalSales = group.orders.reduce((s, o) => s + Number(o.sale_price) * o.quantity, 0);
                          const parsed = group.parsed;
                          const flag1 = parsed ? getFlag(parsed.team1) : "";
                          const flag2 = parsed ? getFlag(parsed.team2) : "";
                          const matchLabel = parsed?.matchNum ? `M${parsed.matchNum}` : null;
                          const team1 = parsed?.team1 || group.event?.home_team || "Unknown";
                          const team2 = parsed?.team2 || group.event?.away_team || "Unknown";

                          // Group orders by category
                          const ordersByCategory = new Map<string, Order[]>();
                          group.orders.forEach(o => {
                            const cat = o.category || "Uncategorised";
                            if (!ordersByCategory.has(cat)) ordersByCategory.set(cat, []);
                            ordersByCategory.get(cat)!.push(o);
                          });
                          const categoryEntries = [...ordersByCategory.entries()].sort(([a], [b]) => a.localeCompare(b));

                          return (
                            <div key={eventKey} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                              <button onClick={() => toggleEvent(eventKey)}
                                className="w-full flex items-center justify-between px-5 py-3 text-left transition-colors hover:bg-muted/40">
                                <div className="flex items-center gap-3 min-w-0">
                                  {isEventCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {matchLabel && <Badge className="bg-primary/20 text-primary text-[10px] font-bold border-primary/30">{matchLabel}</Badge>}
                                      <span className="font-bold text-base">
                                        {flag1 && <span className="mr-1">{flag1}</span>}{team1}
                                        <span className="text-muted-foreground font-normal mx-2">vs</span>
                                        {flag2 && <span className="mr-1">{flag2}</span>}{team2}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                      <span className="font-semibold text-foreground">{group.event?.event_date ? format(new Date(group.event.event_date), "EEE dd MMM yyyy, HH:mm") : ""}</span>
                                      {group.event?.venue && <span>· {group.event.venue}</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                  <div className="text-center hidden sm:block"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Deadline</p><p className={`text-xs font-mono ${deadlineStatus.color}`}>{deadline ? format(deadline, "dd MMM HH:mm") : "—"}</p></div>
                                  <div className="text-center"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Orders</p><p className="text-sm font-mono font-bold">{group.orders.length}</p></div>
                                  <div className="text-center"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tickets</p><p className="text-sm font-mono font-bold">{totalQty}</p></div>
                                  <div className="text-center hidden sm:block"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p><p className="text-sm font-mono font-bold">{fmt(totalSales)}</p></div>
                                  {delivered > 0 && <Badge variant="outline" className="text-[10px] font-bold uppercase bg-success/10 text-success border-success/20">{delivered}/{group.orders.length} delivered</Badge>}
                                </div>
                              </button>

                              {!isEventCollapsed && (
                                <div className="border-t">
                                  {categoryEntries.map(([catName, catOrders]) => {
                                    const catKey = `${eventKey}__${catName}`;
                                    const isCatCollapsed = collapsedCategories.has(catKey);
                                    const catQty = catOrders.reduce((s, o) => s + o.quantity, 0);
                                    const catTotal = catOrders.reduce((s, o) => s + Number(o.sale_price) * o.quantity, 0);
                                    const catGradient = categoryColors[catName] || "from-slate-500/60 to-slate-700/60";

                                    return (
                                      <div key={catKey}>
                                        {/* Category sub-header - only show if multiple categories */}
                                        {categoryEntries.length > 1 && (
                                          <button onClick={() => toggleCategory(catKey)}
                                            className={cn("w-full flex items-center justify-between px-5 py-2 bg-gradient-to-r text-white text-sm transition-all hover:brightness-110", catGradient)}>
                                            <div className="flex items-center gap-2">
                                              {isCatCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                              <span className="font-bold uppercase tracking-wide">{catName}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                              <span className="text-xs font-mono">{catOrders.length} order{catOrders.length !== 1 ? "s" : ""}</span>
                                              <span className="text-xs font-mono">{catQty} ticket{catQty !== 1 ? "s" : ""}</span>
                                              <span className="text-xs font-mono font-bold">{fmt(catTotal)}</span>
                                            </div>
                                          </button>
                                        )}
                                        {!isCatCollapsed && (
                                          <div className="overflow-hidden">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead className="w-[30px]"></TableHead>
                                                  <TableHead className="text-[10px] uppercase tracking-wider w-[90px]">Order #</TableHead>
                                                  <TableHead className="text-[10px] uppercase tracking-wider">Platform</TableHead>
                                                  <TableHead className="text-[10px] uppercase tracking-wider">Customer</TableHead>
                                                  <TableHead className="text-[10px] uppercase tracking-wider">Phone</TableHead>
                                                  <TableHead className="text-[10px] uppercase tracking-wider">Email</TableHead>
                                                  <TableHead className="text-[10px] uppercase tracking-wider text-center w-[40px]">Qty</TableHead>
                                                  <TableHead className="text-[10px] uppercase tracking-wider text-right w-[70px]">Sale</TableHead>
                                                  <TableHead className="text-[10px] uppercase tracking-wider text-center w-[70px]">Delivered</TableHead>
                                                  <TableHead className="text-[10px] uppercase tracking-wider w-[80px]">Status</TableHead>
                                                  <TableHead className="text-[10px] uppercase tracking-wider w-[100px]">Assigned</TableHead>
                                                  <TableHead className="text-[10px] uppercase tracking-wider w-[60px]">Assign</TableHead>
                                                  <TableHead className="text-[10px] uppercase tracking-wider w-[40px]"></TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {catOrders.map((o, oIdx) => renderOrderRow(o, oIdx))}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PURCHASES TAB ── */}
        {tab === "purchases" && (
          <div className="p-6 space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative flex-1 min-w-[180px] max-w-xs space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search purchases..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
              </div>
              <FilterSelect label="Round" value={filterRound} onValueChange={setFilterRound} options={roundOptions} />
              <FilterSelect label="Country" value={filterCountry} onValueChange={setFilterCountry} options={countryOptions} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">{filteredPurchases.length} purchase{filteredPurchases.length !== 1 ? "s" : ""} across {purchasesByEvent.length} event{purchasesByEvent.length !== 1 ? "s" : ""}</p>
              <AddPurchaseDialog onCreated={load} defaultClub="world-cup" />
            </div>

            <div className="space-y-3">
              {purchasesByEvent.length === 0 && <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">No World Cup purchases found</div>}
              {purchasesByEvent.map(({ event, purchases: evPurchases }) => {
                const parsed = event ? getParsedEvent(event) : null;
                const flag1 = parsed ? getFlag(parsed.team1) : "";
                const flag2 = parsed ? getFlag(parsed.team2) : "";
                const team1 = parsed?.team1 || event?.home_team || "Unknown";
                const team2 = parsed?.team2 || event?.away_team || "Unknown";
                const matchLabel = parsed?.matchNum ? `M${parsed.matchNum}` : null;
                const totalCostEv = evPurchases.reduce((s, p) => s + (p.total_cost_gbp || p.quantity * p.unit_cost), 0);
                const totalQty = evPurchases.reduce((s, p) => s + p.quantity, 0);
                const eventKey = event?.id || "unknown";
                const isCollapsed = collapsedEvents.has(`p-${eventKey}`);

                return (
                  <div key={eventKey} className="rounded-xl border bg-card overflow-hidden shadow-sm">
                    <button onClick={() => toggleEvent(`p-${eventKey}`)}
                      className="w-full flex items-center justify-between px-5 py-3 text-left transition-colors hover:bg-muted/40">
                      <div className="flex items-center gap-3 min-w-0">
                        {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {matchLabel && <Badge className="bg-primary/20 text-primary text-[10px] font-bold border-primary/30">{matchLabel}</Badge>}
                            <span className="font-bold text-base">
                              {flag1 && <span className="mr-1">{flag1}</span>}{team1}
                              <span className="text-muted-foreground font-normal mx-2">vs</span>
                              {flag2 && <span className="mr-1">{flag2}</span>}{team2}
                            </span>
                          </div>
                          {event && <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(event.event_date), "EEE dd MMM yyyy, HH:mm")}{event.venue && ` · ${event.venue}`}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-center"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tickets</p><p className="text-sm font-mono font-bold">{totalQty}</p></div>
                        <div className="text-center"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Cost</p><p className="text-sm font-mono font-bold">{fmt(totalCostEv)}</p></div>
                      </div>
                    </button>
                    {!isCollapsed && (
                      <div className="border-t overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px] uppercase tracking-wider">Supplier</TableHead>
                              <TableHead className="text-[10px] uppercase tracking-wider">Category</TableHead>
                              <TableHead className="text-[10px] uppercase tracking-wider text-center">Qty</TableHead>
                              <TableHead className="text-[10px] uppercase tracking-wider text-right">Unit Cost</TableHead>
                              <TableHead className="text-[10px] uppercase tracking-wider text-right">Total</TableHead>
                              <TableHead className="text-[10px] uppercase tracking-wider text-center">Paid</TableHead>
                              <TableHead className="text-[10px] uppercase tracking-wider">Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {evPurchases.map((p, idx) => {
                              const sym = currSym(p.currency);
                              return (
                                <TableRow key={p.id} className={cn("text-xs h-10", orderRowColors[idx % orderRowColors.length])}>
                                  <TableCell className="py-2">
                                    <Badge variant="outline" className="text-[10px] bg-muted font-medium">{supplierMap[p.supplier_id]?.name || "—"}</Badge>
                                  </TableCell>
                                  <TableCell className="py-2">{p.category}</TableCell>
                                  <TableCell className="py-2 text-center font-mono font-bold">{p.quantity}</TableCell>
                                  <TableCell className="py-2 text-right font-mono">
                                    {p.currency !== "GBP" && <Badge variant="outline" className="text-[9px] mr-1 px-1 py-0 font-mono">{p.currency}</Badge>}
                                    {sym}{p.unit_cost.toFixed(2)}
                                  </TableCell>
                                  <TableCell className="py-2 text-right font-mono font-bold">
                                    {p.currency !== "GBP" && <Badge variant="outline" className="text-[9px] mr-1 px-1 py-0 font-mono">{p.currency}</Badge>}
                                    {sym}{(p.quantity * p.unit_cost).toFixed(2)}
                                  </TableCell>
                                  <TableCell className="py-2 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                      {p.supplier_paid ? (
                                        <Switch checked={true} onCheckedChange={() => toggleSupplierPaid(p.id, true)} className="scale-75" />
                                      ) : (
                                        <Popover open={paidConfirm === p.id} onOpenChange={open => setPaidConfirm(open ? p.id : null)}>
                                          <PopoverTrigger asChild>
                                            <div><Switch checked={false} onCheckedChange={() => setPaidConfirm(p.id)} className="scale-75" /></div>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-56 p-3" align="center">
                                            <p className="text-sm font-medium mb-1">Mark as paid?</p>
                                            <p className="text-xs text-muted-foreground mb-3">This cannot be undone.</p>
                                            <div className="flex gap-2">
                                              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => setPaidConfirm(null)}>Cancel</Button>
                                              <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => toggleSupplierPaid(p.id, false)}>Confirm</Button>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      )}
                                      {paidTimestamps[p.id] && <span className="text-[9px] text-muted-foreground">Paid {paidTimestamps[p.id]}</span>}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2 text-muted-foreground truncate max-w-[150px]">{p.notes || "—"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── FINANCE TAB ── */}
        {tab === "finance" && (
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-end gap-3 mb-2">
              <FilterSelect label="Round" value={financeRoundFilter} onValueChange={setFinanceRoundFilter} options={[
                { value: "Group Stage", label: "Group Stage" },
                { value: "Round of 32", label: "Round of 32" },
                { value: "Round of 16", label: "Round of 16" },
                { value: "Quarter-Finals", label: "Quarter-Finals" },
                { value: "Semi-Finals", label: "Semi-Finals" },
                { value: "Final", label: "Final" },
              ]} />
              <FilterSelect label="Country" value={filterCountry} onValueChange={setFilterCountry} options={countryOptions} />
            </div>
            <p className="text-muted-foreground text-sm">Financial overview{countryFilter !== "all" ? ` — ${countryFilter.replace(/\b\w/g, c => c.toUpperCase())}` : " across all World Cup fixtures"}</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border bg-card p-5 text-center"><TrendingUp className="h-5 w-5 mx-auto mb-2 text-success" /><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Revenue</p><p className="text-xl font-bold text-success">{fmt(totalRevenue)}</p></div>
              <div className="rounded-xl border bg-card p-5 text-center"><Package className="h-5 w-5 mx-auto mb-2 text-destructive" /><p className="text-xs text-muted-foreground uppercase tracking-wider">Total Costs</p><p className="text-xl font-bold text-destructive">{fmt(totalCost)}</p></div>
              <div className="rounded-xl border bg-card p-5 text-center"><Percent className="h-5 w-5 mx-auto mb-2 text-primary" /><p className="text-xs text-muted-foreground uppercase tracking-wider">Net Profit</p><p className={cn("text-xl font-bold", totalProfit >= 0 ? "text-success" : "text-destructive")}>{totalProfit >= 0 ? "" : "-"}{fmt(Math.abs(totalProfit))}</p></div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Per-Event Breakdown</h2>
              {eventBreakdown.length === 0 ? (
                <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground text-sm">No financial data yet</div>
              ) : eventBreakdown.map(({ ev, evPurchases, evOrders, cost, revenue, profit, ticketsBought, ticketsSold }) => (
                <div key={ev.id} className="rounded-xl border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b border-border">
                    <div>
                      <p className="font-bold">{formatEventTitle(ev.home_team, ev.away_team, ev.match_code)}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(ev.event_date), "EEE dd MMM yyyy, HH:mm")}{ev.venue && ` · ${ev.venue}`}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        {(() => {
                          const pendingCount = evOrders.filter(o => !(o as any).payment_received).length;
                          const receivedCount = evOrders.filter(o => (o as any).payment_received).length;
                          const paidCount = evPurchases.filter(p => p.supplier_paid).length;
                          const unpaidCount = evPurchases.filter(p => !p.supplier_paid).length;
                          return <>
                            {pendingCount > 0 && <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20">{pendingCount} Pending</Badge>}
                            {receivedCount > 0 && <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/20">{receivedCount} Received</Badge>}
                            {unpaidCount > 0 && <Badge variant="outline" className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">{unpaidCount} Unpaid</Badge>}
                            {paidCount > 0 && <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/20">{paidCount} Paid</Badge>}
                          </>;
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Revenue</p><p className="text-sm font-bold text-success">{fmt(revenue)}</p></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Costs</p><p className="text-sm font-bold text-destructive">{fmt(cost)}</p></div>
                      <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Profit</p><p className={cn("text-sm font-bold", profit >= 0 ? "text-success" : "text-destructive")}>{profit >= 0 ? "" : "-"}{fmt(Math.abs(profit))}</p></div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                    <div className="p-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Purchases ({ticketsBought} tickets)</h4>
                      {evPurchases.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : (
                        <div className="space-y-1.5">
                          {evPurchases.map(p => (
                            <div key={p.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 text-xs">
                              <div className="flex items-center gap-2"><span>{p.quantity}x {p.category}</span><span className="text-muted-foreground">({supplierMap[p.supplier_id]?.name || "Unknown"})</span></div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium">{fmt(p.total_cost_gbp || (p.quantity * p.unit_cost))}</span>
                                <span className={cn("text-[10px]", p.supplier_paid ? "text-success" : "text-destructive")}>{p.supplier_paid ? "Paid" : "Unpaid"}</span>
                                <Switch checked={p.supplier_paid} onCheckedChange={() => toggleSupplierPaid(p.id, p.supplier_paid)} className="scale-75" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-l-2 border-l-success/20">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5 text-success" /> Sales ({ticketsSold} tickets)</h4>
                      {evOrders.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : (
                        <div className="space-y-1.5">
                          {evOrders.map(o => (
                            <div key={o.id} className="flex items-center justify-between rounded-md bg-success/5 px-3 py-2 text-xs">
                              <div className="flex items-center gap-2"><span>{o.quantity}x {o.category}</span><span className="text-muted-foreground">({o.platform_id ? (platformMap[o.platform_id]?.name || "Unknown") : "Direct"})</span></div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-sm">{fmt(o.net_received || o.sale_price - o.fees)}</span>
                                <Switch checked={(o as any).payment_received || false} onCheckedChange={() => togglePaymentReceived(o.id, (o as any).payment_received || false)} className="scale-75" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── INVENTORY TAB ── */}
        {tab === "inventory" && (
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative flex-1 min-w-[180px] max-w-xs space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search inventory..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
              </div>
              <FilterSelect label="Round" value={filterRound} onValueChange={setFilterRound} options={roundOptions} />
              <FilterSelect label="Country" value={filterCountry} onValueChange={setFilterCountry} options={countryOptions} />
              <FilterSelect label="Stadium" value={filterVenue} onValueChange={setFilterVenue} options={venueOptions} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">{filteredInv.length} ticket{filteredInv.length !== 1 ? "s" : ""} across {groupedInv.length} event{groupedInv.length !== 1 ? "s" : ""}</p>
              <Button onClick={() => setShowAddInv(true)}><Plus className="h-4 w-4 mr-1" /> Add Inventory</Button>
            </div>

            {/* Round sub-groups like main inventory */}
            <div className="rounded-xl border-2 border-border/60 overflow-hidden">
              <div className="bg-gradient-to-br from-emerald-600/90 to-teal-800/90 text-white px-5 py-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-medium text-white/60">Inventory</p>
                    <p className="text-lg font-bold mt-0.5">World Cup 2026</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-center px-3 py-1 rounded-md bg-white/10"><p className="text-sm font-bold font-mono">{filteredInv.length}</p><p className="text-[9px] uppercase tracking-widest text-white/60">Tickets</p></div>
                    <div className="text-center px-3 py-1 rounded-md bg-white/10"><p className="text-sm font-bold font-mono">{groupedInv.length}</p><p className="text-[9px] uppercase tracking-widest text-white/60">Events</p></div>
                    {(() => { const avail = filteredInv.filter(i => i.status === "available").length; return avail > 0 ? <Badge variant="outline" className="text-[10px] font-bold uppercase bg-white/10 text-white border-white/20">{avail} avail</Badge> : null; })()}
                  </div>
                </div>
              </div>
              <div className="bg-card p-3 space-y-4">
                {invRoundGroups.length === 0 && <div className="p-12 text-center text-muted-foreground">No World Cup inventory found</div>}
                {invRoundGroups.map(([roundName, roundEvents]) => {
                  const roundKey = `wc-inv__${roundName}`;
                  const isRoundCollapsed = collapsedInvRounds.has(roundKey);
                  const roundTickets = roundEvents.reduce((s, g) => s + g.items.length, 0);
                  const isGroupStage = roundName.startsWith("Group ");
                  const roundGradient = isGroupStage ? "from-emerald-500/60 to-emerald-700/60" : (WC_ROUND_GRADIENTS[roundName] || "from-slate-500/60 to-slate-700/60");

                  return (
                    <div key={roundKey} className="rounded-lg border border-border/50 overflow-hidden">
                      <button onClick={() => toggleInvRound(roundKey)}
                        className={cn("w-full bg-gradient-to-r text-white px-4 py-2.5 text-left transition-all hover:brightness-110", roundGradient)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <p className="text-sm font-bold">{roundName}</p>
                            <Badge variant="outline" className="text-[10px] font-bold bg-white/10 text-white border-white/20">{roundTickets} ticket{roundTickets !== 1 ? "s" : ""}</Badge>
                            <Badge variant="outline" className="text-[10px] bg-white/10 text-white border-white/20">{roundEvents.length} match{roundEvents.length !== 1 ? "es" : ""}</Badge>
                          </div>
                          {isRoundCollapsed ? <ChevronRight className="h-4 w-4 text-white/60" /> : <ChevronDown className="h-4 w-4 text-white/60" />}
                        </div>
                      </button>
                      {!isRoundCollapsed && (
                        <div className="space-y-3 p-3">
                          {roundEvents.map(g => renderInvEventCard(g))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <OrderDetailSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} onUpdated={load} />
      {assignOrder && <AssignPurchaseDialog orderId={assignOrder.id} eventId={assignOrder.event_id} orderCategory={assignOrder.category} orderQuantity={assignOrder.quantity} onClose={() => setAssignOrder(null)} onAssigned={() => { setAssignOrder(null); load(); }} />}
      {editOrder && <EditOrderDialog order={editOrder} onClose={() => setEditOrder(null)} onUpdated={() => { setEditOrder(null); load(); }} />}
      {showAddInv && <AddInventoryDialog onClose={() => setShowAddInv(false)} onCreated={() => { setShowAddInv(false); load(); }} defaultVenue="world-cup" />}
      <InventoryDetailSheet inventoryId={selectedInvId} onClose={() => setSelectedInvId(null)} onUpdated={load} />
    </div>
  );
}
