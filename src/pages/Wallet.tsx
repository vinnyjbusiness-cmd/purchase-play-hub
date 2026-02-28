import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet as WalletIcon, CreditCard, Users, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import LogoAvatar from "@/components/LogoAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const fmt = (n: number) => `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

const cardGradients = [
  "from-primary/80 to-primary/40",
  "from-emerald-600/80 to-emerald-400/40",
  "from-violet-600/80 to-violet-400/40",
  "from-amber-600/80 to-amber-400/40",
  "from-rose-600/80 to-rose-400/40",
  "from-cyan-600/80 to-cyan-400/40",
];

const cardBgColors = [
  "from-primary to-primary/70",
  "from-emerald-600 to-emerald-500",
  "from-violet-600 to-violet-500",
  "from-amber-600 to-amber-500",
  "from-rose-600 to-rose-500",
  "from-cyan-600 to-cyan-500",
];

function maskCardNumber(num: string) {
  const clean = num.replace(/\s/g, "");
  if (clean.length < 4) return "**** **** **** " + clean;
  const last4 = clean.slice(-4);
  return `**** **** **** ${last4}`;
}

export default function Wallet() {
  const [orders, setOrders] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [virtualCards, setVirtualCards] = useState<any[]>([]);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [cardForm, setCardForm] = useState({ platform_id: "", card_name: "", card_number: "", expiry: "", notes: "" });

  const loadData = () => {
    Promise.all([
      supabase.from("orders").select("id,sale_price,fees,net_received,quantity,platform_id,payment_received,status,event_id"),
      supabase.from("purchases").select("id,quantity,unit_cost,total_cost,total_cost_gbp,currency,supplier_id,supplier_paid"),
      supabase.from("suppliers").select("id,name,logo_url"),
      supabase.from("platforms").select("id,name,logo_url"),
      supabase.from("balance_payments").select("*"),
      supabase.from("events").select("id,event_date,home_team,away_team,match_code"),
      supabase.from("platform_virtual_cards").select("*"),
    ]).then(([o, p, s, pl, pay, ev, vc]) => {
      setOrders(o.data || []);
      setPurchases(p.data || []);
      setSuppliers(s.data || []);
      setPlatforms(pl.data || []);
      setPayments(pay.data || []);
      setEvents(ev.data || []);
      setVirtualCards(vc.data || []);
    });
  };

  useEffect(() => { loadData(); }, []);

  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const platformMap = useMemo(() => Object.fromEntries(platforms.map(p => [p.id, p])), [platforms]);
  const eventMap = useMemo(() => Object.fromEntries(events.map(e => [e.id, e])), [events]);

  const now = new Date();

  // Platform balances split by past/future event date
  const platformBalances = useMemo(() => {
    const map: Record<string, { name: string; logoUrl: string | null; totalOwed: number; totalPaid: number; orderCount: number; owedPast: number; owedUpcoming: number; upcomingEvents: { eventId: string; amount: number }[] }> = {};
    platforms.forEach(p => {
      map[p.id] = { name: p.name, logoUrl: p.logo_url, totalOwed: 0, totalPaid: 0, orderCount: 0, owedPast: 0, owedUpcoming: 0, upcomingEvents: [] };
    });
    orders.filter(o => o.status !== "cancelled" && o.status !== "refunded").forEach(o => {
      const key = o.platform_id || "direct";
      const net = Number(o.net_received || (o.sale_price - o.fees));
      if (!map[key]) map[key] = { name: key === "direct" ? "Direct Sale" : "Unknown", logoUrl: null, totalOwed: 0, totalPaid: 0, orderCount: 0, owedPast: 0, owedUpcoming: 0, upcomingEvents: [] };
      map[key].totalOwed += net;
      map[key].orderCount++;

      const ev = eventMap[o.event_id];
      const eventDate = ev ? new Date(ev.event_date) : null;
      if (eventDate && eventDate > now) {
        map[key].owedUpcoming += net;
        const existing = map[key].upcomingEvents.find(ue => ue.eventId === o.event_id);
        if (existing) existing.amount += net;
        else map[key].upcomingEvents.push({ eventId: o.event_id, amount: net });
      } else {
        map[key].owedPast += net;
      }
    });
    payments.filter(p => p.party_type === "platform" && p.party_id).forEach(pay => {
      if (!map[pay.party_id]) map[pay.party_id] = { name: platformMap[pay.party_id]?.name || "Unknown", logoUrl: null, totalOwed: 0, totalPaid: 0, orderCount: 0, owedPast: 0, owedUpcoming: 0, upcomingEvents: [] };
      if (pay.type === "payment") map[pay.party_id].totalPaid += pay.amount;
      else if (pay.type === "opening_balance") { map[pay.party_id].totalOwed += pay.amount; map[pay.party_id].owedPast += pay.amount; }
    });
    return Object.entries(map).map(([id, d]) => ({ id, ...d, balance: d.totalOwed - d.totalPaid })).sort((a, b) => b.balance - a.balance);
  }, [orders, payments, platformMap, platforms, eventMap]);

  // Supplier balances (unchanged)
  const supplierBalances = useMemo(() => {
    const map: Record<string, { name: string; logoUrl: string | null; totalOwed: number; totalPaid: number; purchaseCount: number }> = {};
    suppliers.forEach(s => {
      map[s.id] = { name: s.name, logoUrl: s.logo_url, totalOwed: 0, totalPaid: 0, purchaseCount: 0 };
    });
    purchases.forEach(p => {
      const key = p.supplier_id;
      const cost = p.total_cost_gbp || (p.quantity * p.unit_cost);
      if (!map[key]) map[key] = { name: supplierMap[key]?.name || "Unknown", logoUrl: null, totalOwed: 0, totalPaid: 0, purchaseCount: 0 };
      map[key].totalOwed += cost;
      map[key].purchaseCount++;
    });
    payments.filter(p => p.party_type === "supplier" && p.party_id).forEach(pay => {
      if (!map[pay.party_id]) map[pay.party_id] = { name: supplierMap[pay.party_id]?.name || "Unknown", logoUrl: null, totalOwed: 0, totalPaid: 0, purchaseCount: 0 };
      if (pay.type === "payment") map[pay.party_id].totalPaid += pay.amount;
      else if (pay.type === "opening_balance") map[pay.party_id].totalOwed += pay.amount;
    });
    return Object.entries(map).map(([id, d]) => ({ id, ...d, balance: d.totalOwed - d.totalPaid })).sort((a, b) => b.balance - a.balance);
  }, [purchases, payments, supplierMap, suppliers]);

  // Split totals
  const totalPlatformAccessible = platformBalances.reduce((s, p) => {
    // Payments reduce past-owed first, remainder reduces upcoming
    const pastAfterPayments = Math.max(0, p.owedPast - p.totalPaid);
    return s + pastAfterPayments;
  }, 0);

  const totalPlatformUpcoming = platformBalances.reduce((s, p) => {
    const excessPayments = Math.max(0, p.totalPaid - p.owedPast);
    return s + Math.max(0, p.owedUpcoming - excessPayments);
  }, 0);

  const totalSupplierOwed = supplierBalances.reduce((s, d) => s + Math.max(0, d.balance), 0);
  const accessibleBalance = totalPlatformAccessible - totalSupplierOwed;

  // Virtual card balances derived from platform balances
  const getCardBalance = (platformId: string) => {
    const pb = platformBalances.find(p => p.id === platformId);
    return pb ? pb.balance : 0;
  };

  const platformIndex = useMemo(() => {
    const m: Record<string, number> = {};
    platforms.forEach((p, i) => { m[p.id] = i; });
    return m;
  }, [platforms]);

  const handleAddCard = async () => {
    if (!cardForm.platform_id || !cardForm.card_number) {
      toast.error("Platform and card number are required");
      return;
    }
    const { error } = await supabase.from("platform_virtual_cards").insert({
      platform_id: cardForm.platform_id,
      card_name: cardForm.card_name,
      card_number: cardForm.card_number,
      expiry: cardForm.expiry || null,
      notes: cardForm.notes || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Virtual card added");
    setCardForm({ platform_id: "", card_name: "", card_number: "", expiry: "", notes: "" });
    setAddCardOpen(false);
    loadData();
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <WalletIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
      </div>

      {/* Hero: Accessible Balance */}
      <div className="rounded-2xl border bg-gradient-to-br from-card to-muted/30 p-8 text-center">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Accessible Balance</p>
        <p className={cn("text-5xl font-bold tracking-tight", accessibleBalance >= 0 ? "text-success" : "text-destructive")}>
          {accessibleBalance >= 0 ? "" : "-"}{fmt(accessibleBalance)}
        </p>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div>
            <span className="text-muted-foreground">Platform Income (past): </span>
            <span className="font-semibold text-success">{fmt(totalPlatformAccessible)}</span>
          </div>
          <span className="text-muted-foreground">—</span>
          <div>
            <span className="text-muted-foreground">Owed to Suppliers: </span>
            <span className="font-semibold text-destructive">{fmt(totalSupplierOwed)}</span>
          </div>
        </div>
        {totalPlatformUpcoming > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            + {fmt(totalPlatformUpcoming)} tied to upcoming events (not yet accessible)
          </p>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Income */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-4 w-4 text-success" />
            <h3 className="text-sm font-semibold">Platform Income</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {platformBalances.map((p, i) => {
              const pastAfterPayments = Math.max(0, p.owedPast - p.totalPaid);
              const excessPayments = Math.max(0, p.totalPaid - p.owedPast);
              const upcomingAfterPayments = Math.max(0, p.owedUpcoming - excessPayments);
              return (
                <div
                  key={p.id}
                  className={cn(
                    "relative rounded-xl p-5 text-white overflow-hidden bg-gradient-to-br shadow-lg",
                    cardGradients[i % cardGradients.length]
                  )}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -mr-10 -mt-10" />
                  <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-white/5 -ml-6 -mb-6" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <LogoAvatar name={p.name} logoUrl={p.logoUrl} entityType="platform" entityId={p.id} size="md" />
                      <p className="font-semibold text-sm truncate">{p.name}</p>
                    </div>
                    <p className="text-2xl font-bold tracking-tight">
                      {p.balance >= 0 ? "" : "-"}{fmt(p.balance)}
                    </p>
                    <div className="flex items-center justify-between mt-3 text-[11px] opacity-80">
                      <span>{p.orderCount} order{p.orderCount !== 1 ? "s" : ""}</span>
                      <span>Total: {fmt(p.totalOwed)}</span>
                    </div>
                    {(pastAfterPayments > 0 || upcomingAfterPayments > 0) && (
                      <div className="flex items-center gap-3 mt-2 text-[10px] opacity-70">
                        {pastAfterPayments > 0 && <span>Accessible: {fmt(pastAfterPayments)}</span>}
                        {upcomingAfterPayments > 0 && <span>Upcoming: {fmt(upcomingAfterPayments)}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {platformBalances.length === 0 && (
              <div className="col-span-2 rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                No platforms yet. Add platforms on the Platforms page.
              </div>
            )}
          </div>
        </div>

        {/* Suppliers */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold">Suppliers</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {supplierBalances.map(s => {
              const hasBalance = s.balance > 0;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "rounded-xl border bg-card p-4 flex items-center gap-3 transition-all",
                    hasBalance ? "border-destructive/20" : "border-border"
                  )}
                >
                  <LogoAvatar name={s.name} logoUrl={s.logoUrl} entityType="supplier" entityId={s.id} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.purchaseCount} purchase{s.purchaseCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {hasBalance ? (
                      <p className="text-sm font-bold text-destructive">{fmt(s.balance)}</p>
                    ) : (
                      <p className="text-xs text-success font-medium">Settled</p>
                    )}
                  </div>
                </div>
              );
            })}
            {supplierBalances.length === 0 && (
              <div className="col-span-2 rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                No suppliers yet. Add suppliers on the Suppliers page.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Virtual Cards */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Virtual Cards</h3>
          <Dialog open={addCardOpen} onOpenChange={setAddCardOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Card
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Virtual Card</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div>
                  <Label className="text-xs">Platform</Label>
                  <Select value={cardForm.platform_id} onValueChange={v => setCardForm(f => ({ ...f, platform_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select platform" /></SelectTrigger>
                    <SelectContent>
                      {platforms.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Card Name</Label>
                  <Input placeholder="e.g. Tixstock Prepaid" value={cardForm.card_name} onChange={e => setCardForm(f => ({ ...f, card_name: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Card Number</Label>
                  <Input placeholder="1234 5678 9012 3456" value={cardForm.card_number} onChange={e => setCardForm(f => ({ ...f, card_number: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Expiry</Label>
                    <Input placeholder="MM/YY" value={cardForm.expiry} onChange={e => setCardForm(f => ({ ...f, expiry: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Input placeholder="Optional notes" value={cardForm.notes} onChange={e => setCardForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <Button onClick={handleAddCard} className="w-full">Add Card</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {virtualCards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {virtualCards.map(card => {
              const idx = platformIndex[card.platform_id] ?? 0;
              const platformName = platformMap[card.platform_id]?.name || "Unknown";
              const balance = getCardBalance(card.platform_id);
              return (
                <div
                  key={card.id}
                  className={cn(
                    "relative rounded-2xl p-6 text-white overflow-hidden bg-gradient-to-br shadow-xl",
                    cardBgColors[idx % cardBgColors.length]
                  )}
                  style={{ aspectRatio: "1.586/1", minHeight: 180 }}
                >
                  {/* Card decorations */}
                  <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -mr-12 -mt-12" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 -ml-8 -mb-8" />
                  <div className="absolute top-4 right-5 w-10 h-7 rounded bg-white/15 border border-white/20" />

                  <div className="relative z-10 h-full flex flex-col justify-between">
                    {/* Issuer */}
                    <div>
                      <p className="text-xs font-medium opacity-70 uppercase tracking-wider">{platformName}</p>
                      {card.card_name && <p className="text-sm font-semibold mt-0.5">{card.card_name}</p>}
                    </div>

                    {/* Masked number */}
                    <p className="text-lg font-mono tracking-[0.15em] opacity-90 my-auto py-2">
                      {maskCardNumber(card.card_number)}
                    </p>

                    {/* Bottom row */}
                    <div className="flex items-end justify-between">
                      <div>
                        {card.expiry && (
                          <div>
                            <p className="text-[9px] uppercase opacity-50">Expires</p>
                            <p className="text-xs font-medium">{card.expiry}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase opacity-50">Balance</p>
                        <p className="text-xl font-bold">{fmt(balance)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
            No virtual cards yet. Add a card to track platform balances.
          </div>
        )}
      </div>
    </div>
  );
}
