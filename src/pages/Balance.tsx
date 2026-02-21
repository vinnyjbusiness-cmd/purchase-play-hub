import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Plus, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Purchase {
  id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number | null;
  total_cost_gbp: number | null;
  currency: string;
  purchase_date: string;
  supplier_paid: boolean;
  notes: string | null;
  category: string;
  event_id: string;
  supplier_id: string;
}

interface Order {
  id: string;
  sale_price: number;
  fees: number;
  net_received: number | null;
  quantity: number;
  order_date: string;
  payment_received: boolean;
  status: string;
  event_id: string;
  platform_id: string | null;
  category: string;
}

interface EventInfo { id: string; home_team: string; away_team: string; event_date: string; }
interface SupplierInfo { id: string; name: string; }
interface PlatformInfo { id: string; name: string; }
interface BalancePayment {
  id: string;
  party_type: string;
  party_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  notes: string | null;
  created_at: string;
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
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

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

  // Helper: parse display name from notes
  const getSupplierDisplayName = (p: Purchase): string => {
    const supplier = supplierMap[p.supplier_id];
    const st = supplier?.name?.toLowerCase() || "";
    if (st === "trade" && p.notes) {
      const m = p.notes.match(/Name:\s*([^|]+)/);
      if (m) return m[1].trim();
    }
    if (st === "websites" && p.notes) {
      const m = p.notes.match(/Website:\s*([^|]+)/);
      if (m) return m[1].trim();
    }
    return supplier?.name || "Unknown";
  };

  // Compute supplier balances: group by supplier_id, total owed = sum of all purchase costs
  const supplierBalances = useMemo(() => {
    const map: Record<string, { supplierId: string; displayName: string; totalOwed: number; totalPaid: number; purchases: Purchase[] }> = {};
    purchases.forEach(p => {
      const key = p.supplier_id;
      const cost = p.total_cost_gbp || (p.quantity * p.unit_cost);
      if (!map[key]) {
        map[key] = { supplierId: key, displayName: getSupplierDisplayName(p), totalOwed: 0, totalPaid: 0, purchases: [] };
      }
      map[key].totalOwed += cost;
      map[key].purchases.push(p);
    });
    // Add balance_payments
    payments.filter(p => p.party_type === "supplier").forEach(pay => {
      if (map[pay.party_id]) map[pay.party_id].totalPaid += pay.amount;
    });
    return Object.values(map).sort((a, b) => (b.totalOwed - b.totalPaid) - (a.totalOwed - a.totalPaid));
  }, [purchases, payments, supplierMap]);

  // Compute platform balances: group by platform_id, total owed = sum of net from non-cancelled orders
  const platformBalances = useMemo(() => {
    const map: Record<string, { platformId: string; displayName: string; totalOwed: number; totalPaid: number; orders: Order[] }> = {};
    orders.filter(o => o.status !== "cancelled" && o.status !== "refunded").forEach(o => {
      const key = o.platform_id || "direct";
      const net = o.net_received || (o.sale_price - o.fees);
      if (!map[key]) {
        const name = key === "direct" ? "Direct Sale" : (platformMap[key]?.name || "Unknown");
        map[key] = { platformId: key, displayName: name, totalOwed: 0, totalPaid: 0, orders: [] };
      }
      map[key].totalOwed += net;
      map[key].orders.push(o);
    });
    // Add balance_payments
    payments.filter(p => p.party_type === "platform").forEach(pay => {
      if (map[pay.party_id]) map[pay.party_id].totalPaid += pay.amount;
    });
    return Object.values(map).sort((a, b) => (b.totalOwed - b.totalPaid) - (a.totalOwed - a.totalPaid));
  }, [orders, payments, platformMap]);

  const totalIOwOut = supplierBalances.reduce((s, b) => s + Math.max(0, b.totalOwed - b.totalPaid), 0);
  const totalOwedIn = platformBalances.reduce((s, b) => s + Math.max(0, b.totalOwed - b.totalPaid), 0);

  // Detail view data
  const selectedData = useMemo(() => {
    if (!selectedParty) return null;
    if (selectedParty.type === "supplier") {
      const bal = supplierBalances.find(b => b.supplierId === selectedParty.id);
      if (!bal) return null;
      // Group purchases by event
      const byEvent: Record<string, Purchase[]> = {};
      bal.purchases.forEach(p => {
        if (!byEvent[p.event_id]) byEvent[p.event_id] = [];
        byEvent[p.event_id].push(p);
      });
      const partyPayments = payments.filter(p => p.party_type === "supplier" && p.party_id === selectedParty.id);
      return { ...bal, byEvent, payments: partyPayments, type: "supplier" as const };
    } else {
      const bal = platformBalances.find(b => b.platformId === selectedParty.id);
      if (!bal) return null;
      const byEvent: Record<string, Order[]> = {};
      bal.orders.forEach(o => {
        if (!byEvent[o.event_id]) byEvent[o.event_id] = [];
        byEvent[o.event_id].push(o);
      });
      const partyPayments = payments.filter(p => p.party_type === "platform" && p.party_id === selectedParty.id);
      return { ...bal, byEvent, payments: partyPayments, type: "platform" as const };
    }
  }, [selectedParty, supplierBalances, platformBalances, payments]);

  const handleAddPayment = async () => {
    if (!selectedParty || !paymentAmount) return;
    setPaymentLoading(true);
    try {
      const { error } = await supabase.from("balance_payments").insert({
        party_type: selectedParty.type,
        party_id: selectedParty.id,
        amount: parseFloat(paymentAmount),
        notes: paymentNotes || null,
      });
      if (error) throw error;
      toast.success("Payment recorded");
      setShowAddPayment(false);
      setPaymentAmount("");
      setPaymentNotes("");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const deletePayment = async (paymentId: string) => {
    const { error } = await supabase.from("balance_payments").delete().eq("id", paymentId);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Payment removed");
    loadData();
  };

  // Detail view
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
          <div className="flex gap-6 mt-2">
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
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Breakdown by event */}
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
                        <p className="text-xs text-muted-foreground">{eventDate} · {(items as any[]).length} {selectedData.type === "supplier" ? "purchase" : "order"}{(items as any[]).length !== 1 ? "s" : ""}</p>
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

          {/* Payment history */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Payment History</h3>
              <Button size="sm" variant="outline" onClick={() => setShowAddPayment(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Record Payment
              </Button>
            </div>
            {selectedData.payments.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">No payments recorded yet</div>
            ) : (
              <div className="divide-y divide-border">
                {selectedData.payments.map(pay => (
                  <div key={pay.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-success">+{fmt(pay.amount)} paid</p>
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

        {/* Add payment dialog */}
        <Dialog open={showAddPayment} onOpenChange={setShowAddPayment}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {selectedData.type === "supplier" ? "Payment made to" : "Payment received from"} <span className="font-medium text-foreground">{selectedData.displayName}</span>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (£)</Label>
                <Input type="number" step="0.01" min="0" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="e.g. Bank transfer ref..." rows={2} maxLength={200} />
              </div>
              <Button onClick={handleAddPayment} disabled={paymentLoading || !paymentAmount} className="w-full">
                {paymentLoading ? "Saving..." : "Record Payment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main balance overview
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">Balances</h1>
        <p className="text-sm text-muted-foreground mt-1">Running balances across all events. Click a name to see details &amp; record payments.</p>
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

        {/* Suppliers — I Owe */}
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
                <button
                  key={b.supplierId}
                  onClick={() => setSelectedParty({ type: "supplier", id: b.supplierId })}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium">{b.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.purchases.length} purchase{b.purchases.length !== 1 ? "s" : ""} · Total: {fmt(b.totalOwed)}
                      {b.totalPaid > 0 && ` · Paid: ${fmt(b.totalPaid)}`}
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
              <div className="p-4 text-sm text-muted-foreground text-center">No supplier purchases yet</div>
            )}
          </div>
        </div>

        {/* Platforms — Owed to Me */}
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
                <button
                  key={b.platformId}
                  onClick={() => setSelectedParty({ type: "platform", id: b.platformId })}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium">{b.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.orders.length} order{b.orders.length !== 1 ? "s" : ""} · Total: {fmt(b.totalOwed)}
                      {b.totalPaid > 0 && ` · Received: ${fmt(b.totalPaid)}`}
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
              <div className="p-4 text-sm text-muted-foreground text-center">No platform sales yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
