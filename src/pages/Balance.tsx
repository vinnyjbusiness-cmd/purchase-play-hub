import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, ChevronRight, CheckCircle2, AlertCircle, History, BookOpen, Inbox, Link, TrendingUp, TrendingDown, BarChart3, Pencil, AlertTriangle } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, isSameMonth, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import LogoAvatar from "@/components/LogoAvatar";

interface Purchase {
  id: string; quantity: number; unit_cost: number; total_cost: number | null;
  total_cost_gbp: number | null; currency: string; purchase_date: string;
  supplier_paid: boolean; notes: string | null; category: string; event_id: string; supplier_id: string;
}
interface Order {
  id: string; sale_price: number; fees: number; net_received: number | null;
  quantity: number; order_date: string; payment_received: boolean; status: string;
  event_id: string; platform_id: string | null; category: string;
}
interface EventInfo { id: string; home_team: string; away_team: string; event_date: string; }
interface SupplierInfo { id: string; name: string; logo_url: string | null; }
interface PlatformInfo { id: string; name: string; logo_url: string | null; }
interface BalancePayment {
  id: string; party_type: string | null; party_id: string | null; amount: number;
  currency: string; payment_date: string; notes: string | null; created_at: string;
  type: "payment" | "opening_balance" | "adjustment";
  contact_name: string | null;
}

const fmt = (n: number) => `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

export default function Balance() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierInfo[]>([]);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [payments, setPayments] = useState<BalancePayment[]>([]);
  const [selectedParty, setSelectedParty] = useState<{ type: "supplier" | "platform"; id: string } | null>(null);

  // Dialog state
  const [dialogMode, setDialogMode] = useState<"payment" | "opening_balance" | "adjustment" | null>(null);
  const [dialogAmount, setDialogAmount] = useState("");
  const [dialogNotes, setDialogNotes] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);

  // Edit balance dialog
  const [editingPayment, setEditingPayment] = useState<BalancePayment | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Add opening balance from overview
  const [showAddOpening, setShowAddOpening] = useState(false);
  const [openingPartyType, setOpeningPartyType] = useState<"supplier" | "platform">("supplier");
  const [openingPartyId, setOpeningPartyId] = useState("");
  const [openingContactName, setOpeningContactName] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [openingLoading, setOpeningLoading] = useState(false);

  // Add Balance dialog
  const [showAddBalance, setShowAddBalance] = useState(false);
  const [addBalPartyType, setAddBalPartyType] = useState<"supplier" | "platform">("supplier");
  const [addBalPartyId, setAddBalPartyId] = useState("");
  const [addBalDirection, setAddBalDirection] = useState<"i_owe" | "they_owe">("i_owe");
  const [addBalAmount, setAddBalAmount] = useState("");
  const [addBalNotes, setAddBalNotes] = useState("");
  const [addBalLoading, setAddBalLoading] = useState(false);

  // Assign unassigned balance dialog
  const [assigningPayment, setAssigningPayment] = useState<BalancePayment | null>(null);
  const [assignSupplierId, setAssignSupplierId] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  const loadData = () => {
    Promise.all([
      supabase.from("purchases").select("id,quantity,unit_cost,total_cost,total_cost_gbp,currency,purchase_date,supplier_paid,notes,category,event_id,supplier_id"),
      supabase.from("orders").select("id,sale_price,fees,net_received,quantity,order_date,payment_received,status,event_id,platform_id,category"),
      supabase.from("events").select("id,home_team,away_team,event_date"),
      supabase.from("suppliers").select("id,name,logo_url"),
      supabase.from("platforms").select("id,name,logo_url"),
      supabase.from("balance_payments").select("*").order("payment_date", { ascending: false }),
    ]).then(([purch, ord, ev, sup, plat, pay]) => {
      setPurchases(purch.data || []);
      setOrders(ord.data || []);
      setEvents(ev.data || []);
      setSuppliers(sup.data || []);
      setPlatforms(plat.data || []);
      setPayments((pay.data as BalancePayment[]) || []);
    });
  };

  useEffect(() => { loadData(); }, []);

  const eventMap = useMemo(() => Object.fromEntries(events.map(e => [e.id, e])), [events]);
  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const platformMap = useMemo(() => Object.fromEntries(platforms.map(p => [p.id, p])), [platforms]);

  const getSupplierDisplayName = (p: Purchase): string => {
    const supplier = supplierMap[p.supplier_id];
    const st = supplier?.name?.toLowerCase() || "";
    if (st === "trade" && p.notes) { const m = p.notes.match(/Name:\s*([^|]+)/); if (m) return m[1].trim(); }
    if (st === "websites" && p.notes) { const m = p.notes.match(/Website:\s*([^|]+)/); if (m) return m[1].trim(); }
    return supplier?.name || "Unknown";
  };

  const supplierOptions = useMemo(() => {
    const seen = new Map<string, string>();
    purchases.forEach(p => {
      if (!seen.has(p.supplier_id)) seen.set(p.supplier_id, getSupplierDisplayName(p));
    });
    suppliers.forEach(s => {
      if (!seen.has(s.id)) seen.set(s.id, s.name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, purchases, supplierMap]);

  // Compute supplier balances — auto-include ALL suppliers
  const supplierBalances = useMemo(() => {
    const map: Record<string, { supplierId: string; displayName: string; totalOwed: number; totalPaid: number; openingBalance: number; adjustments: number; purchases: Purchase[]; lastActivity: string | null }> = {};
    // Seed all suppliers
    suppliers.forEach(s => {
      map[s.id] = { supplierId: s.id, displayName: s.name, totalOwed: 0, totalPaid: 0, openingBalance: 0, adjustments: 0, purchases: [], lastActivity: null };
    });
    // From purchases
    purchases.forEach(p => {
      const key = p.supplier_id;
      const cost = p.total_cost_gbp || (p.quantity * p.unit_cost);
      if (!map[key]) map[key] = { supplierId: key, displayName: getSupplierDisplayName(p), totalOwed: 0, totalPaid: 0, openingBalance: 0, adjustments: 0, purchases: [], lastActivity: null };
      map[key].totalOwed += cost;
      map[key].purchases.push(p);
      if (!map[key].lastActivity || p.purchase_date > map[key].lastActivity!) map[key].lastActivity = p.purchase_date;
    });
    // From balance_payments
    payments.filter(p => p.party_type === "supplier" && p.party_id).forEach(pay => {
      const isTradeSupplier = supplierMap[pay.party_id!]?.name?.toLowerCase() === "trade";
      const key = isTradeSupplier && pay.contact_name ? `trade_${pay.contact_name.toLowerCase()}` : pay.party_id!;
      if (!map[key]) {
        const name = pay.contact_name || supplierMap[pay.party_id!]?.name || "Unknown";
        map[key] = { supplierId: key, displayName: name, totalOwed: 0, totalPaid: 0, openingBalance: 0, adjustments: 0, purchases: [], lastActivity: null };
      }
      if (pay.contact_name && (map[key].displayName === "Trade" || map[key].displayName === "Unknown")) {
        map[key].displayName = pay.contact_name;
      }
      if (pay.type === "payment") map[key].totalPaid += pay.amount;
      else if (pay.type === "opening_balance") { map[key].openingBalance += pay.amount; map[key].totalOwed += pay.amount; }
      else if (pay.type === "adjustment") { map[key].adjustments += pay.amount; map[key].totalOwed += pay.amount; }
      if (!map[key].lastActivity || pay.payment_date > map[key].lastActivity!) map[key].lastActivity = pay.payment_date;
    });
    return Object.values(map).sort((a, b) => (b.totalOwed - b.totalPaid) - (a.totalOwed - a.totalPaid));
  }, [purchases, payments, supplierMap, suppliers]);

  // Compute platform balances
  const platformBalances = useMemo(() => {
    const map: Record<string, { platformId: string; displayName: string; totalOwed: number; totalPaid: number; openingBalance: number; adjustments: number; orders: Order[]; lastActivity: string | null }> = {};
    orders.filter(o => o.status !== "cancelled" && o.status !== "refunded").forEach(o => {
      const key = o.platform_id || "direct";
      const net = o.net_received || (o.sale_price - o.fees);
      if (!map[key]) {
        const name = key === "direct" ? "Direct Sale" : (platformMap[key]?.name || "Unknown");
        map[key] = { platformId: key, displayName: name, totalOwed: 0, totalPaid: 0, openingBalance: 0, adjustments: 0, orders: [], lastActivity: null };
      }
      map[key].totalOwed += net;
      map[key].orders.push(o);
      if (!map[key].lastActivity || o.order_date > map[key].lastActivity!) map[key].lastActivity = o.order_date;
    });
    payments.filter(p => p.party_type === "platform" && p.party_id).forEach(pay => {
      if (!map[pay.party_id!]) {
        const name = platformMap[pay.party_id!]?.name || "Unknown";
        map[pay.party_id!] = { platformId: pay.party_id!, displayName: name, totalOwed: 0, totalPaid: 0, openingBalance: 0, adjustments: 0, orders: [], lastActivity: null };
      }
      if (pay.type === "payment") map[pay.party_id!].totalPaid += pay.amount;
      else if (pay.type === "opening_balance") { map[pay.party_id!].openingBalance += pay.amount; map[pay.party_id!].totalOwed += pay.amount; }
      else if (pay.type === "adjustment") { map[pay.party_id!].adjustments += pay.amount; map[pay.party_id!].totalOwed += pay.amount; }
      if (!map[pay.party_id!].lastActivity || pay.payment_date > map[pay.party_id!].lastActivity!) map[pay.party_id!].lastActivity = pay.payment_date;
    });
    return Object.values(map).sort((a, b) => (b.totalOwed - b.totalPaid) - (a.totalOwed - a.totalPaid));
  }, [orders, payments, platformMap]);

  const unassignedBalances = useMemo(() => payments.filter(p => !p.party_id), [payments]);

  const totalIOwOut = supplierBalances.reduce((s, b) => s + Math.max(0, b.totalOwed - b.totalPaid), 0);
  const totalOwedIn = platformBalances.reduce((s, b) => s + Math.max(0, b.totalOwed - b.totalPaid), 0);

  // Detail data
  const selectedData = useMemo(() => {
    if (!selectedParty) return null;
    if (selectedParty.type === "supplier") {
      const bal = supplierBalances.find(b => b.supplierId === selectedParty.id);
      if (!bal) return null;
      const byEvent: Record<string, Purchase[]> = {};
      bal.purchases.forEach(p => { if (!byEvent[p.event_id]) byEvent[p.event_id] = []; byEvent[p.event_id].push(p); });
      const isTradeKey = selectedParty.id.startsWith("trade_");
      const tradeName = isTradeKey ? selectedParty.id.replace("trade_", "") : null;
      const partyPayments = isTradeKey
        ? payments.filter(p => p.party_type === "supplier" && p.contact_name?.toLowerCase() === tradeName)
        : payments.filter(p => p.party_type === "supplier" && p.party_id === selectedParty.id);
      return { ...bal, byEvent, payments: partyPayments, type: "supplier" as const };
    } else {
      const bal = platformBalances.find(b => b.platformId === selectedParty.id);
      if (!bal) return null;
      const byEvent: Record<string, Order[]> = {};
      bal.orders.forEach(o => { if (!byEvent[o.event_id]) byEvent[o.event_id] = []; byEvent[o.event_id].push(o); });
      const partyPayments = payments.filter(p => p.party_type === "platform" && p.party_id === selectedParty.id);
      return { ...bal, byEvent, payments: partyPayments, type: "platform" as const };
    }
  }, [selectedParty, supplierBalances, platformBalances, payments]);

  // Add entry
  const handleAddEntry = async () => {
    if (!selectedParty || !dialogAmount || !dialogMode) return;
    setDialogLoading(true);
    try {
      const isTradeKey = selectedParty.id.startsWith("trade_");
      const tradeName = isTradeKey ? selectedParty.id.replace("trade_", "") : null;
      const realPartyId = isTradeKey
        ? payments.find(p => p.party_type === "supplier" && p.contact_name?.toLowerCase() === tradeName)?.party_id
        : selectedParty.id;
      const contactName = isTradeKey ? selectedData?.displayName || null : null;

      const { error } = await supabase.from("balance_payments").insert({
        party_type: selectedParty.type,
        party_id: realPartyId,
        amount: parseFloat(dialogAmount),
        notes: dialogNotes || null,
        type: dialogMode,
        contact_name: contactName,
      } as any);
      if (error) throw error;
      const labels = { payment: "Payment recorded", opening_balance: "Opening balance added", adjustment: "Adjustment added" };
      toast.success(labels[dialogMode]);
      setDialogMode(null);
      setDialogAmount("");
      setDialogNotes("");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDialogLoading(false);
    }
  };

  // Edit entry
  const handleEditEntry = async () => {
    if (!editingPayment || !editAmount) return;
    setEditLoading(true);
    try {
      const { error } = await supabase.from("balance_payments").update({
        amount: parseFloat(editAmount),
        notes: editNotes || null,
      }).eq("id", editingPayment.id);
      if (error) throw error;
      toast.success("Balance updated");
      setEditingPayment(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleAddOpening = async () => {
    if (openingPartyType === "supplier" && !openingPartyId) return;
    if (openingPartyType === "platform" && !openingContactName.trim()) return;
    if (!openingAmount) return;
    setOpeningLoading(true);
    try {
      const partyId = openingPartyType === "platform"
        ? suppliers.find(s => s.name.toLowerCase() === "trade")?.id || null
        : openingPartyId;
      const contactName = openingContactName.trim() || null;
      const { error } = await supabase.from("balance_payments").insert({
        party_type: "supplier",
        party_id: partyId,
        amount: parseFloat(openingAmount),
        notes: openingNotes || null,
        type: "opening_balance",
        contact_name: contactName,
      } as any);
      if (error) throw error;
      toast.success("Opening balance added");
      setShowAddOpening(false);
      setOpeningPartyId("");
      setOpeningContactName("");
      setOpeningAmount("");
      setOpeningNotes("");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setOpeningLoading(false);
    }
  };

  const handleAddBalance = async () => {
    if (!addBalPartyId || !addBalAmount) return;
    setAddBalLoading(true);
    try {
      // direction: "i_owe" means I owe them (record as opening_balance to increase what I owe)
      // "they_owe" means they owe me (record as payment — they paid me, or I received from them)
      const type = addBalDirection === "i_owe" ? "opening_balance" : "payment";
      const { error } = await supabase.from("balance_payments").insert({
        party_type: addBalPartyType,
        party_id: addBalPartyId,
        amount: parseFloat(addBalAmount),
        notes: addBalNotes || `${addBalDirection === "i_owe" ? "I owe them" : "They owe me"}`,
        type,
      } as any);
      if (error) throw error;
      toast.success(addBalDirection === "i_owe" ? "Recorded: I owe them" : "Recorded: They owe me");
      setShowAddBalance(false);
      setAddBalPartyId("");
      setAddBalAmount("");
      setAddBalNotes("");
      setAddBalDirection("i_owe");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAddBalLoading(false);
    }
  };

  const deletePayment = async (paymentId: string) => {
    const { error } = await supabase.from("balance_payments").delete().eq("id", paymentId);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Entry removed");
    loadData();
  };

  const typeLabel = (t: string) => t === "opening_balance" ? "Opening Balance" : t === "adjustment" ? "Adjustment" : "Payment";
  const typeColor = (t: string) => t === "payment" ? "text-success" : t === "opening_balance" ? "text-primary" : "text-warning";
  const typeIcon = (t: string) => t === "payment" ? "+" : t === "opening_balance" ? "📋" : "⚡";

  // Payment age helper
  const getPaymentAge = (lastActivity: string | null): { days: number; isOverdue: boolean } => {
    if (!lastActivity) return { days: -1, isOverdue: false };
    const days = differenceInDays(new Date(), new Date(lastActivity));
    return { days, isOverdue: days > 7 };
  };

  // Activity heatmap
  const heatmapData = useMemo(() => {
    if (!selectedData) return [];
    const now = new Date();
    const start = startOfMonth(subMonths(now, 11));
    const end = endOfMonth(now);
    const months = eachMonthOfInterval({ start, end });
    return months.map(month => {
      let count = 0;
      let amount = 0;
      if (selectedData.type === "supplier") {
        (selectedData as any).purchases?.forEach((p: Purchase) => {
          if (isSameMonth(new Date(p.purchase_date), month)) { count++; amount += p.total_cost_gbp || (p.quantity * p.unit_cost); }
        });
      } else {
        (selectedData as any).orders?.forEach((o: Order) => {
          if (isSameMonth(new Date(o.order_date), month)) { count++; amount += o.net_received || (o.sale_price - o.fees); }
        });
      }
      selectedData.payments?.forEach((pay: BalancePayment) => {
        if (isSameMonth(new Date(pay.payment_date), month)) count++;
      });
      return { month, count, amount };
    });
  }, [selectedData]);

  const maxHeatCount = Math.max(1, ...heatmapData.map(d => d.count));

  const summaryStats = useMemo(() => {
    if (!selectedData) return null;
    const balance = selectedData.totalOwed - selectedData.totalPaid;
    const items = selectedData.type === "supplier" ? (selectedData as any).purchases?.length || 0 : (selectedData as any).orders?.length || 0;
    const paymentCount = selectedData.payments?.length || 0;
    const avgTransaction = items > 0 ? selectedData.totalOwed / items : 0;
    return { balance, items, paymentCount, avgTransaction };
  }, [selectedData]);

  // ─── DETAIL VIEW ───
  if (selectedParty && selectedData) {
    const balance = selectedData.totalOwed - selectedData.totalPaid;
    const isSettled = balance <= 0;
    const supplier = selectedData.type === "supplier" ? suppliers.find(s => s.id === selectedData.supplierId || s.id === selectedParty.id) : null;
    const platform = selectedData.type === "platform" ? platforms.find(p => p.id === (selectedData as any).platformId || p.id === selectedParty.id) : null;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <button onClick={() => setSelectedParty(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-4 w-4" /> Back to Balances
          </button>
          <div className="flex items-center gap-4">
            <LogoAvatar name={selectedData.displayName} logoUrl={supplier?.logo_url || platform?.logo_url || null} entityType={selectedData.type} entityId={supplier?.id || platform?.id || selectedParty.id} editable size="lg" onLogoUpdated={() => loadData()} />
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight">{selectedData.displayName}</h1>
              <p className="text-sm text-muted-foreground capitalize">{selectedData.type}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground">Total {selectedData.type === "supplier" ? "Owed" : "Owed to Me"}</span>
              <p className="text-lg font-bold">{fmt(selectedData.totalOwed)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground">Paid</span>
              <p className="text-lg font-bold text-success">{fmt(selectedData.totalPaid)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground">Balance</span>
              <p className={cn("text-lg font-bold", isSettled ? "text-success" : "text-destructive")}>{isSettled ? "Settled" : fmt(balance)}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <span className="text-xs text-muted-foreground">Avg / Transaction</span>
              <p className="text-lg font-bold">{fmt(summaryStats?.avgTransaction || 0)}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Activity Heatmap */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Activity (Last 12 Months)</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-12 gap-1.5">
                {heatmapData.map((d, i) => {
                  const intensity = d.count / maxHeatCount;
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <div className={cn("w-full aspect-square rounded-md transition-colors", d.count === 0 ? "bg-muted" : intensity < 0.25 ? "bg-primary/20" : intensity < 0.5 ? "bg-primary/40" : intensity < 0.75 ? "bg-primary/60" : "bg-primary")} title={`${format(d.month, "MMM yyyy")}: ${d.count} activities, ${fmt(d.amount)}`} />
                      <span className="text-[10px] text-muted-foreground">{format(d.month, "MMM")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Breakdown by event */}
          {Object.keys(selectedData.byEvent).length > 0 && (
            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <h3 className="text-sm font-semibold">Breakdown by Game</h3>
              </div>
              <div className="divide-y divide-border">
                {Object.entries(selectedData.byEvent).map(([eventId, items]) => {
                  const ev = eventMap[eventId];
                  const eventLabel = ev ? `${ev.home_team} vs ${ev.away_team}` : "Unknown Event";
                  const eventDate = ev ? format(new Date(ev.event_date), "dd MMM yy") : "";
                  const total = selectedData.type === "supplier"
                    ? (items as Purchase[]).reduce((s, p) => s + (p.total_cost_gbp || (p.quantity * p.unit_cost)), 0)
                    : (items as Order[]).reduce((s, o) => s + (o.net_received || (o.sale_price - o.fees)), 0);
                  return (
                    <div key={eventId} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div>
                          <p className="text-sm font-medium">{eventLabel}</p>
                          <p className="text-xs text-muted-foreground">{eventDate}</p>
                        </div>
                        <span className="text-sm font-bold">{fmt(total)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity Log */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Activity Log</h3>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => { setDialogMode("payment"); setDialogAmount(""); setDialogNotes(""); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Payment
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setDialogMode("adjustment"); setDialogAmount(""); setDialogNotes(""); }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Charge
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setDialogMode("opening_balance"); setDialogAmount(""); setDialogNotes(""); }}>
                  <BookOpen className="h-3.5 w-3.5 mr-1" /> Opening Bal.
                </Button>
              </div>
            </div>
            {selectedData.payments.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">No entries yet</div>
            ) : (
              <div className="divide-y divide-border">
                {selectedData.payments.map((pay) => {
                  const age = getPaymentAge(pay.payment_date);
                  return (
                    <div key={pay.id} className="px-4 py-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-semibold", typeColor(pay.type))}>
                              {typeIcon(pay.type)} {fmt(pay.amount)}
                            </span>
                            <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium",
                              pay.type === "payment" ? "bg-success/10 text-success" :
                              pay.type === "opening_balance" ? "bg-primary/10 text-primary" :
                              "bg-warning/10 text-warning"
                            )}>
                              {typeLabel(pay.type)}
                            </span>
                            {age.isOverdue && pay.type !== "payment" && (
                              <span className="flex items-center gap-0.5 text-[10px] text-warning">
                                <AlertTriangle className="h-3 w-3" /> {age.days}d ago
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <p>📅 {format(new Date(pay.payment_date), "dd MMM yyyy 'at' HH:mm")}</p>
                            {pay.notes && <p>📝 {pay.notes}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => { setEditingPayment(pay); setEditAmount(String(pay.amount)); setEditNotes(pay.notes || ""); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive shrink-0" onClick={() => deletePayment(pay.id)}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Add entry dialog */}
        <Dialog open={!!dialogMode} onOpenChange={(v) => { if (!v) setDialogMode(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {dialogMode === "payment" ? "Record Payment" : dialogMode === "opening_balance" ? "Add Opening Balance" : "Add Charge / Adjustment"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {dialogMode === "payment"
                  ? (selectedData.type === "supplier" ? "Payment made to" : "Payment received from")
                  : dialogMode === "opening_balance"
                    ? "Previous balance carried forward for"
                    : "Extra charge added to"
                }
                {" "}<span className="font-medium text-foreground">{selectedData.displayName}</span>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (£)</Label>
                <Input type="number" step="0.01" min="0" value={dialogAmount} onChange={e => setDialogAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Textarea value={dialogNotes} onChange={e => setDialogNotes(e.target.value)} placeholder={dialogMode === "adjustment" ? "e.g. Favour — sourced 2 tickets" : "e.g. Bank transfer ref..."} rows={2} maxLength={200} />
              </div>
              <Button onClick={handleAddEntry} disabled={dialogLoading || !dialogAmount} className="w-full">
                {dialogLoading ? "Saving..." : dialogMode === "payment" ? "Record Payment" : dialogMode === "opening_balance" ? "Add Opening Balance" : "Add Charge"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit entry dialog */}
        <Dialog open={!!editingPayment} onOpenChange={(v) => { if (!v) setEditingPayment(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Edit Balance Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Amount (£)</Label>
                <Input type="number" step="0.01" min="0" value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} maxLength={200} />
              </div>
              <Button onClick={handleEditEntry} disabled={editLoading || !editAmount} className="w-full">
                {editLoading ? "Saving..." : "Update Entry"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── OVERVIEW ───
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Balances</h1>
            <p className="text-sm text-muted-foreground mt-1">Running balances across all events. Click a card to see details & record payments.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowAddBalance(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Balance
            </Button>
            <Button variant="outline" onClick={() => setShowAddOpening(true)}>
              <BookOpen className="h-4 w-4 mr-1.5" /> Add Opening Balance
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Total I Owe (Suppliers)</p>
            <p className="text-2xl font-bold text-destructive mt-1">{fmt(totalIOwOut)}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Total Owed to Me (Platforms)</p>
            <p className="text-2xl font-bold text-success mt-1">{fmt(totalOwedIn)}</p>
          </div>
        </div>

        {/* Unassigned Balances */}
        {unassignedBalances.length > 0 && (
          <div className="rounded-lg border border-warning/40 bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-warning/10">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Inbox className="h-4 w-4 text-warning" /> Unassigned Balances
              </h3>
            </div>
            <div className="divide-y divide-border">
              {unassignedBalances.map(ub => (
                <div key={ub.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {fmt(ub.amount)}
                      {ub.contact_name && <span className="text-muted-foreground"> — {ub.contact_name}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ub.payment_date), "dd MMM yyyy")}
                      {ub.notes && ` · ${ub.notes}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => { setAssigningPayment(ub); setAssignSupplierId(""); }}>
                      <Link className="h-3.5 w-3.5 mr-1" /> Assign
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive" onClick={() => deletePayment(ub.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suppliers — Card Grid (auto-populated from suppliers DB) */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold">I Owe — Suppliers</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {supplierBalances.map(b => {
              const balance = b.totalOwed - b.totalPaid;
              const isSettled = balance <= 0;
              const supplier = suppliers.find(s => s.id === b.supplierId);
              const age = getPaymentAge(b.lastActivity);
              const hasBalance = balance > 0;
              return (
                <button
                  key={b.supplierId}
                  onClick={() => setSelectedParty({ type: "supplier", id: b.supplierId })}
                  className={cn(
                    "rounded-xl border bg-card p-4 flex flex-col items-center gap-3 hover:bg-muted/40 hover:border-primary/30 transition-all text-center group",
                    hasBalance && age.isOverdue && "border-warning/40"
                  )}
                >
                  <LogoAvatar name={b.displayName} logoUrl={supplier?.logo_url || null} entityType="supplier" entityId={supplier?.id || b.supplierId} size="lg" />
                  <div className="w-full">
                    <p className="text-sm font-semibold truncate">{b.displayName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {b.purchases.length} purchase{b.purchases.length !== 1 ? "s" : ""}
                    </p>
                    {isSettled ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success font-medium mt-2">
                        <CheckCircle2 className="h-3 w-3" /> Settled
                      </span>
                    ) : (
                      <>
                        <p className="text-lg font-bold text-destructive mt-1">{fmt(balance)}</p>
                        {age.isOverdue && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-warning mt-0.5">
                            <AlertTriangle className="h-3 w-3" /> {age.days}d since activity
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Platforms — Card Grid */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <h3 className="text-sm font-semibold">Owed to Me — Platforms</h3>
          </div>
          {platformBalances.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">No platform balances yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {platformBalances.map(b => {
                const balance = b.totalOwed - b.totalPaid;
                const isSettled = balance <= 0;
                const platform = platforms.find(p => p.id === b.platformId);
                const age = getPaymentAge(b.lastActivity);
                return (
                  <button
                    key={b.platformId}
                    onClick={() => setSelectedParty({ type: "platform", id: b.platformId })}
                    className={cn(
                      "rounded-xl border bg-card p-4 flex flex-col items-center gap-3 hover:bg-muted/40 hover:border-primary/30 transition-all text-center group",
                      balance > 0 && age.isOverdue && "border-warning/40"
                    )}
                  >
                    <LogoAvatar name={b.displayName} logoUrl={platform?.logo_url || null} entityType="platform" entityId={platform?.id || b.platformId} size="lg" />
                    <div className="w-full">
                      <p className="text-sm font-semibold truncate">{b.displayName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {b.orders.length} order{b.orders.length !== 1 ? "s" : ""}
                      </p>
                      {isSettled ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success font-medium mt-2">
                          <CheckCircle2 className="h-3 w-3" /> Settled
                        </span>
                      ) : (
                        <>
                          <p className="text-lg font-bold text-success mt-1">{fmt(balance)}</p>
                          {age.isOverdue && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-warning mt-0.5">
                              <AlertTriangle className="h-3 w-3" /> {age.days}d since activity
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Assign unassigned balance dialog */}
      <Dialog open={!!assigningPayment} onOpenChange={(v) => { if (!v) setAssigningPayment(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link className="h-4 w-4" /> Assign to Supplier</DialogTitle>
          </DialogHeader>
          {assigningPayment && (
            <div className="space-y-3">
              <div className="text-sm">
                Assigning <span className="font-bold">{fmt(assigningPayment.amount)}</span>
                {assigningPayment.contact_name && <span className="text-muted-foreground"> ({assigningPayment.contact_name})</span>}
              </div>
              <div className="space-y-1.5">
                <Label>Assign to supplier</Label>
                <Select value={assignSupplierId} onValueChange={setAssignSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={async () => {
                  if (!assignSupplierId || !assigningPayment) return;
                  setAssignLoading(true);
                  try {
                    const { error } = await supabase.from("balance_payments")
                      .update({ party_type: "supplier", party_id: assignSupplierId } as any)
                      .eq("id", assigningPayment.id);
                    if (error) throw error;
                    toast.success("Balance assigned");
                    setAssigningPayment(null);
                    setAssignSupplierId("");
                    loadData();
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setAssignLoading(false);
                  }
                }}
                disabled={assignLoading || !assignSupplierId}
                className="w-full"
              >
                {assignLoading ? "Assigning..." : "Assign"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Opening Balance dialog */}
      <Dialog open={showAddOpening} onOpenChange={(v) => { if (!v) { setShowAddOpening(false); setOpeningPartyId(""); setOpeningContactName(""); setOpeningAmount(""); setOpeningNotes(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Add Opening Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
              Bring in existing balances from before you started using the system.
            </p>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={openingPartyType} onValueChange={(v) => { setOpeningPartyType(v as any); setOpeningPartyId(""); setOpeningContactName(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="supplier">Supplier (I Owe)</SelectItem>
                  <SelectItem value="platform">Trade (Owed to Me)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {openingPartyType === "supplier" ? (
              <div className="space-y-1.5">
                <Label>Supplier</Label>
                <Select value={openingPartyId} onValueChange={setOpeningPartyId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Contact Name</Label>
                <Input value={openingContactName} onChange={e => setOpeningContactName(e.target.value)} placeholder="e.g. Lewis" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Amount (£)</Label>
              <Input type="number" step="0.01" min="0" value={openingAmount} onChange={e => setOpeningAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={openingNotes} onChange={e => setOpeningNotes(e.target.value)} placeholder="e.g. Balance from previous system" rows={2} maxLength={200} />
            </div>
            <Button onClick={handleAddOpening} disabled={openingLoading || !openingAmount || (openingPartyType === "supplier" && !openingPartyId) || (openingPartyType === "platform" && !openingContactName.trim())} className="w-full">
              {openingLoading ? "Saving..." : "Add Opening Balance"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Balance dialog */}
      <Dialog open={showAddBalance} onOpenChange={(v) => { if (!v) { setShowAddBalance(false); setAddBalPartyId(""); setAddBalAmount(""); setAddBalNotes(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Who</Label>
              <Select value={addBalPartyType} onValueChange={(v) => { setAddBalPartyType(v as any); setAddBalPartyId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="supplier">Supplier</SelectItem>
                  <SelectItem value="platform">Platform</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{addBalPartyType === "supplier" ? "Supplier" : "Platform"}</Label>
              <Select value={addBalPartyId} onValueChange={setAddBalPartyId}>
                <SelectTrigger><SelectValue placeholder={`Select ${addBalPartyType}`} /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {(addBalPartyType === "supplier" ? suppliers : platforms).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select value={addBalDirection} onValueChange={(v) => setAddBalDirection(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="i_owe">I Owe Them</SelectItem>
                  <SelectItem value="they_owe">They Owe Me</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {addBalDirection === "i_owe"
                  ? "You owe this person/company money"
                  : "This person/company owes you money"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (£)</Label>
              <Input type="number" step="0.01" min="0" value={addBalAmount} onChange={e => setAddBalAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={addBalNotes} onChange={e => setAddBalNotes(e.target.value)} placeholder="Payment reference, notes..." rows={2} maxLength={200} />
            </div>
            <Button onClick={handleAddBalance} disabled={addBalLoading || !addBalPartyId || !addBalAmount} className={cn("w-full", addBalDirection === "i_owe" ? "bg-destructive hover:bg-destructive/90" : "bg-success hover:bg-success/90")}>
              {addBalLoading ? "Saving..." : addBalDirection === "i_owe" ? "Record: I Owe Them" : "Record: They Owe Me"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
