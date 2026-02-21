import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, ChevronRight, CheckCircle2, AlertCircle, History, BookOpen, Inbox, Link } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
interface SupplierInfo { id: string; name: string; }
interface PlatformInfo { id: string; name: string; }
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

  // Add opening balance from overview (no party selected yet)
  const [showAddOpening, setShowAddOpening] = useState(false);
  const [openingPartyType, setOpeningPartyType] = useState<"supplier" | "platform">("supplier");
  const [openingPartyId, setOpeningPartyId] = useState("");
  const [openingContactName, setOpeningContactName] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [openingNotes, setOpeningNotes] = useState("");
  const [openingLoading, setOpeningLoading] = useState(false);

  // Add Balance dialog (quick add — initially unassigned)
  const [showAddBalance, setShowAddBalance] = useState(false);
  const [addBalSupplierId, setAddBalSupplierId] = useState("");
  const [addBalContactName, setAddBalContactName] = useState("");
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
      supabase.from("suppliers").select("id,name"),
      supabase.from("platforms").select("id,name"),
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

  // Build deduplicated supplier options with display names from purchases
  const supplierOptions = useMemo(() => {
    const seen = new Map<string, string>(); // id -> displayName
    // From purchases — use the smart display name
    purchases.forEach(p => {
      if (!seen.has(p.supplier_id)) seen.set(p.supplier_id, getSupplierDisplayName(p));
    });
    // Any suppliers without purchases
    suppliers.forEach(s => {
      if (!seen.has(s.id)) seen.set(s.id, s.name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, purchases, supplierMap]);

  // Compute supplier balances
  const supplierBalances = useMemo(() => {
    const map: Record<string, { supplierId: string; displayName: string; totalOwed: number; totalPaid: number; openingBalance: number; adjustments: number; purchases: Purchase[] }> = {};
    // From purchases
    purchases.forEach(p => {
      const key = p.supplier_id;
      const cost = p.total_cost_gbp || (p.quantity * p.unit_cost);
      if (!map[key]) map[key] = { supplierId: key, displayName: getSupplierDisplayName(p), totalOwed: 0, totalPaid: 0, openingBalance: 0, adjustments: 0, purchases: [] };
      map[key].totalOwed += cost;
      map[key].purchases.push(p);
    });
    // From balance_payments (assigned ones only)
    payments.filter(p => p.party_type === "supplier" && p.party_id).forEach(pay => {
      // Use contact_name as a unique key when supplier is "Trade" to keep separate tabs
      const isTradeSupplier = supplierMap[pay.party_id!]?.name?.toLowerCase() === "trade";
      const key = isTradeSupplier && pay.contact_name ? `trade_${pay.contact_name.toLowerCase()}` : pay.party_id!;
      if (!map[key]) {
        const name = pay.contact_name || supplierMap[pay.party_id!]?.name || "Unknown";
        map[key] = { supplierId: key, displayName: name, totalOwed: 0, totalPaid: 0, openingBalance: 0, adjustments: 0, purchases: [] };
      }
      // Update display name if contact_name is available and current is generic
      if (pay.contact_name && (map[key].displayName === "Trade" || map[key].displayName === "Unknown")) {
        map[key].displayName = pay.contact_name;
      }
      if (pay.type === "payment") map[key].totalPaid += pay.amount;
      else if (pay.type === "opening_balance") { map[key].openingBalance += pay.amount; map[key].totalOwed += pay.amount; }
      else if (pay.type === "adjustment") { map[key].adjustments += pay.amount; map[key].totalOwed += pay.amount; }
    });
    return Object.values(map).sort((a, b) => (b.totalOwed - b.totalPaid) - (a.totalOwed - a.totalPaid));
  }, [purchases, payments, supplierMap]);

  // Compute platform balances
  const platformBalances = useMemo(() => {
    const map: Record<string, { platformId: string; displayName: string; totalOwed: number; totalPaid: number; openingBalance: number; adjustments: number; orders: Order[] }> = {};
    orders.filter(o => o.status !== "cancelled" && o.status !== "refunded").forEach(o => {
      const key = o.platform_id || "direct";
      const net = o.net_received || (o.sale_price - o.fees);
      if (!map[key]) {
        const name = key === "direct" ? "Direct Sale" : (platformMap[key]?.name || "Unknown");
        map[key] = { platformId: key, displayName: name, totalOwed: 0, totalPaid: 0, openingBalance: 0, adjustments: 0, orders: [] };
      }
      map[key].totalOwed += net;
      map[key].orders.push(o);
    });
    payments.filter(p => p.party_type === "platform" && p.party_id).forEach(pay => {
      if (!map[pay.party_id!]) {
        const name = platformMap[pay.party_id!]?.name || "Unknown";
        map[pay.party_id!] = { platformId: pay.party_id!, displayName: name, totalOwed: 0, totalPaid: 0, openingBalance: 0, adjustments: 0, orders: [] };
      }
      if (pay.type === "payment") map[pay.party_id!].totalPaid += pay.amount;
      else if (pay.type === "opening_balance") { map[pay.party_id!].openingBalance += pay.amount; map[pay.party_id!].totalOwed += pay.amount; }
      else if (pay.type === "adjustment") { map[pay.party_id!].adjustments += pay.amount; map[pay.party_id!].totalOwed += pay.amount; }
    });
    return Object.values(map).sort((a, b) => (b.totalOwed - b.totalPaid) - (a.totalOwed - a.totalPaid));
  }, [orders, payments, platformMap]);

  // Unassigned balances
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
      const partyPayments = payments.filter(p => p.party_type === "supplier" && p.party_id === selectedParty.id);
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

  // Add entry (payment, opening_balance, or adjustment)
  const handleAddEntry = async () => {
    if (!selectedParty || !dialogAmount || !dialogMode) return;
    setDialogLoading(true);
    try {
      const { error } = await supabase.from("balance_payments").insert({
        party_type: selectedParty.type,
        party_id: selectedParty.id,
        amount: parseFloat(dialogAmount),
        notes: dialogNotes || null,
        type: dialogMode,
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

  // Add opening balance from overview
  const handleAddOpening = async () => {
    if (openingPartyType === "supplier" && !openingPartyId) return;
    if (openingPartyType === "platform" && !openingContactName.trim()) return;
    if (!openingAmount) return;
    setOpeningLoading(true);
    try {
      // For trade type, pick the first Trade supplier ID automatically
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

  const deletePayment = async (paymentId: string) => {
    const { error } = await supabase.from("balance_payments").delete().eq("id", paymentId);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Entry removed");
    loadData();
  };

  const typeLabel = (t: string) => t === "opening_balance" ? "Opening Balance" : t === "adjustment" ? "Adjustment" : "Payment";
  const typeColor = (t: string) => t === "payment" ? "text-success" : t === "opening_balance" ? "text-primary" : "text-warning";
  const typeIcon = (t: string) => t === "payment" ? "+" : t === "opening_balance" ? "📋" : "⚡";

  // ─── DETAIL VIEW ───
  if (selectedParty && selectedData) {
    const balance = selectedData.totalOwed - selectedData.totalPaid;
    const isSettled = balance <= 0;
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <button onClick={() => setSelectedParty(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to Balances
          </button>
          <h1 className="text-2xl font-bold tracking-tight">{selectedData.displayName}</h1>
          <div className="flex flex-wrap gap-4 mt-2">
            <div>
              <span className="text-xs text-muted-foreground">Total {selectedData.type === "supplier" ? "Owed" : "Owed to Me"}</span>
              <p className="text-lg font-bold">{fmt(selectedData.totalOwed)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Paid</span>
              <p className="text-lg font-bold text-success">{fmt(selectedData.totalPaid)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Balance</span>
              <p className={cn("text-lg font-bold", isSettled ? "text-success" : "text-destructive")}>{isSettled ? "Settled" : fmt(balance)}</p>
            </div>
            {selectedData.openingBalance > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">Opening Bal.</span>
                <p className="text-lg font-bold text-primary">{fmt(selectedData.openingBalance)}</p>
              </div>
            )}
            {selectedData.adjustments > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">Adjustments</span>
                <p className="text-lg font-bold text-warning">{fmt(selectedData.adjustments)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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
                      <div className="space-y-1">
                        {selectedData.type === "supplier"
                          ? (items as Purchase[]).map(p => (
                            <div key={p.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-xs">
                              <span>{p.quantity}x {p.category} @ £{p.unit_cost.toFixed(2)}</span>
                              <span className="font-medium">{fmt(p.total_cost_gbp || (p.quantity * p.unit_cost))}</span>
                            </div>
                          ))
                          : (items as Order[]).map(o => (
                            <div key={o.id} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-1.5 text-xs">
                              <span>{o.quantity}x {o.category} · {fmt(o.sale_price)}</span>
                              <span className="font-medium">{fmt(o.net_received || (o.sale_price - o.fees))}</span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ledger / history */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2"><History className="h-4 w-4" /> Ledger</h3>
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
                {selectedData.payments.map(pay => (
                  <div key={pay.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className={cn("text-sm font-medium", typeColor(pay.type))}>
                        {typeIcon(pay.type)} {fmt(pay.amount)} — {typeLabel(pay.type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(pay.payment_date), "dd MMM yyyy")}
                        {pay.notes && ` · ${pay.notes}`}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-xs text-destructive hover:text-destructive" onClick={() => deletePayment(pay.id)}>
                      Remove
                    </Button>
                  </div>
                ))}
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
              {dialogMode === "opening_balance" && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                  Use this to bring in existing balances from before you started using this system. This amount will be added to the total owed.
                </p>
              )}
              {dialogMode === "adjustment" && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                  Use this for anything outside normal purchases/orders — e.g. a favour, extra charge, or ad-hoc fee. This will increase the balance owed.
                </p>
              )}
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
            <p className="text-sm text-muted-foreground mt-1">Running balances across all events. Click a name to see details &amp; record payments.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddBalance(true)}>
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
              <p className="text-xs text-muted-foreground mt-0.5">These need to be assigned to a supplier's running tab.</p>
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

        {/* Suppliers */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" /> I Owe — Suppliers
            </h3>
          </div>
          <div className="divide-y divide-border">
            {supplierBalances.map(b => {
              const balance = b.totalOwed - b.totalPaid;
              const isSettled = balance <= 0;
              return (
                <button key={b.supplierId} onClick={() => setSelectedParty({ type: "supplier", id: b.supplierId })}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors text-left">
                  <div>
                    <p className="text-sm font-medium">{b.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.purchases.length} purchase{b.purchases.length !== 1 ? "s" : ""} · Total: {fmt(b.totalOwed)}
                      {b.totalPaid > 0 && ` · Paid: ${fmt(b.totalPaid)}`}
                      {b.openingBalance > 0 && ` · Opening: ${fmt(b.openingBalance)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSettled ? (
                      <span className="flex items-center gap-1 text-xs text-success font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Settled</span>
                    ) : (
                      <span className="text-sm font-bold text-destructive">{fmt(balance)}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
            {supplierBalances.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">No supplier balances yet</div>
            )}
          </div>
        </div>

        {/* Platforms */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" /> Owed to Me — Platforms
            </h3>
          </div>
          <div className="divide-y divide-border">
            {platformBalances.map(b => {
              const balance = b.totalOwed - b.totalPaid;
              const isSettled = balance <= 0;
              return (
                <button key={b.platformId} onClick={() => setSelectedParty({ type: "platform", id: b.platformId })}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors text-left">
                  <div>
                    <p className="text-sm font-medium">{b.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.orders.length} order{b.orders.length !== 1 ? "s" : ""} · Total: {fmt(b.totalOwed)}
                      {b.totalPaid > 0 && ` · Received: ${fmt(b.totalPaid)}`}
                      {b.openingBalance > 0 && ` · Opening: ${fmt(b.openingBalance)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSettled ? (
                      <span className="flex items-center gap-1 text-xs text-success font-medium"><CheckCircle2 className="h-3.5 w-3.5" /> Settled</span>
                    ) : (
                      <span className="text-sm font-bold text-success">{fmt(balance)}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
            {platformBalances.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">No platform balances yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Add Balance dialog — goes to unassigned */}
      <Dialog open={showAddBalance} onOpenChange={(v) => { if (!v) { setShowAddBalance(false); setAddBalSupplierId(""); setAddBalContactName(""); setAddBalAmount(""); setAddBalNotes(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
              Add a balance entry. It will appear in "Unassigned Balances" so you can assign it to a supplier's running tab.
            </p>
            <div className="space-y-1.5">
              <Label>Supplier (optional)</Label>
              <Select value={addBalSupplierId} onValueChange={(v) => { setAddBalSupplierId(v); setAddBalContactName(""); }}>
                <SelectTrigger><SelectValue placeholder="Select supplier (or leave blank)" /></SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {supplierOptions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {addBalSupplierId && supplierMap[addBalSupplierId]?.name?.toLowerCase() === "trade" && (
              <div className="space-y-1.5">
                <Label>Contact Name</Label>
                <Input value={addBalContactName} onChange={e => setAddBalContactName(e.target.value)} placeholder="e.g. John Smith" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Amount (£)</Label>
              <Input type="number" step="0.01" min="0" value={addBalAmount} onChange={e => setAddBalAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={addBalNotes} onChange={e => setAddBalNotes(e.target.value)} placeholder="e.g. Favour — sourced 2 tickets" rows={2} maxLength={200} />
            </div>
            <Button
              onClick={async () => {
                if (!addBalAmount) return;
                setAddBalLoading(true);
                try {
                  const contactName = addBalContactName || (addBalSupplierId ? supplierMap[addBalSupplierId]?.name : null) || null;
                  const { error } = await supabase.from("balance_payments").insert({
                    party_type: null,
                    party_id: null,
                    amount: parseFloat(addBalAmount),
                    notes: addBalNotes || null,
                    type: "adjustment",
                    contact_name: contactName,
                  } as any);
                  if (error) throw error;
                  toast.success("Balance added to unassigned");
                  setShowAddBalance(false);
                  setAddBalSupplierId("");
                  setAddBalContactName("");
                  setAddBalAmount("");
                  setAddBalNotes("");
                  loadData();
                } catch (err: any) {
                  toast.error(err.message);
                } finally {
                  setAddBalLoading(false);
                }
              }}
              disabled={addBalLoading || !addBalAmount}
              className="w-full"
            >
              {addBalLoading ? "Saving..." : "Add Balance"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                {assigningPayment.notes && <span className="text-muted-foreground"> · {assigningPayment.notes}</span>}
              </div>
              <div className="space-y-1.5">
                <Label>Assign to existing balance</Label>
                <Select value={assignSupplierId} onValueChange={setAssignSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier with balance" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {supplierBalances.filter(b => (b.totalOwed - b.totalPaid) > 0).map(b => (
                      <SelectItem key={b.supplierId} value={b.supplierId}>
                        {b.displayName} — {fmt(b.totalOwed - b.totalPaid)} outstanding
                      </SelectItem>
                    ))}
                    {supplierBalances.filter(b => (b.totalOwed - b.totalPaid) > 0).length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No ongoing balances to assign to</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={async () => {
                  if (!assignSupplierId || !assigningPayment) return;
                  setAssignLoading(true);
                  try {
                    const targetBal = supplierBalances.find(b => b.supplierId === assignSupplierId);
                    const isTradeKey = assignSupplierId.startsWith("trade_");
                    const realSupplierId = isTradeKey 
                      ? payments.find(p => p.party_type === "supplier" && p.contact_name?.toLowerCase() === assignSupplierId.replace("trade_", ""))?.party_id
                      : assignSupplierId;
                    const contactName = targetBal?.displayName || null;
                    
                    const { error } = await supabase.from("balance_payments")
                      .update({ 
                        party_type: "supplier", 
                        party_id: realSupplierId,
                        contact_name: contactName,
                      } as any)
                      .eq("id", assigningPayment.id);
                    if (error) throw error;
                    toast.success("Balance assigned to supplier");
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

      {/* Add Opening Balance dialog (from overview) */}
      <Dialog open={showAddOpening} onOpenChange={(v) => { if (!v) { setShowAddOpening(false); setOpeningPartyId(""); setOpeningContactName(""); setOpeningAmount(""); setOpeningNotes(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4" /> Add Opening Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
              Bring in existing balances from before you started using the system. Pick a supplier or platform and enter the amount still outstanding.
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
                <Select value={openingPartyId} onValueChange={(v) => { setOpeningPartyId(v); setOpeningContactName(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {supplierOptions.filter(s => supplierMap[s.id]?.name?.toLowerCase() !== "trade").map(item => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
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
    </div>
  );
}
