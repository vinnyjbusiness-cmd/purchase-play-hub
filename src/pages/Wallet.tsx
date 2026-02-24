import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet as WalletIcon, Upload, CreditCard, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import LogoAvatar from "@/components/LogoAvatar";

const fmt = (n: number) => `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

// Credit-card gradient palette per index
const cardGradients = [
  "from-primary/80 to-primary/40",
  "from-emerald-600/80 to-emerald-400/40",
  "from-violet-600/80 to-violet-400/40",
  "from-amber-600/80 to-amber-400/40",
  "from-rose-600/80 to-rose-400/40",
  "from-cyan-600/80 to-cyan-400/40",
];

export default function Wallet() {
  const [orders, setOrders] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const loadData = () => {
    Promise.all([
      supabase.from("orders").select("id,sale_price,fees,net_received,quantity,platform_id,payment_received,status"),
      supabase.from("purchases").select("id,quantity,unit_cost,total_cost,total_cost_gbp,currency,supplier_id,supplier_paid"),
      supabase.from("suppliers").select("id,name,logo_url"),
      supabase.from("platforms").select("id,name,logo_url"),
      supabase.from("balance_payments").select("*"),
    ]).then(([o, p, s, pl, pay]) => {
      setOrders(o.data || []);
      setPurchases(p.data || []);
      setSuppliers(s.data || []);
      setPlatforms(pl.data || []);
      setPayments(pay.data || []);
    });
  };

  useEffect(() => { loadData(); }, []);

  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const platformMap = useMemo(() => Object.fromEntries(platforms.map(p => [p.id, p])), [platforms]);

  // Platform balances: total owed from orders (net received)
  const platformBalances = useMemo(() => {
    const map: Record<string, { name: string; logoUrl: string | null; totalOwed: number; totalPaid: number; orderCount: number }> = {};
    // Seed all platforms
    platforms.forEach(p => {
      map[p.id] = { name: p.name, logoUrl: p.logo_url, totalOwed: 0, totalPaid: 0, orderCount: 0 };
    });
    orders.filter(o => o.status !== "cancelled" && o.status !== "refunded").forEach(o => {
      const key = o.platform_id || "direct";
      const net = Number(o.net_received || (o.sale_price - o.fees));
      if (!map[key]) map[key] = { name: key === "direct" ? "Direct Sale" : "Unknown", logoUrl: null, totalOwed: 0, totalPaid: 0, orderCount: 0 };
      map[key].totalOwed += net;
      map[key].orderCount++;
    });
    payments.filter(p => p.party_type === "platform" && p.party_id).forEach(pay => {
      if (!map[pay.party_id]) map[pay.party_id] = { name: platformMap[pay.party_id]?.name || "Unknown", logoUrl: null, totalOwed: 0, totalPaid: 0, orderCount: 0 };
      if (pay.type === "payment") map[pay.party_id].totalPaid += pay.amount;
      else if (pay.type === "opening_balance") map[pay.party_id].totalOwed += pay.amount;
    });
    return Object.entries(map).map(([id, d]) => ({ id, ...d, balance: d.totalOwed - d.totalPaid })).sort((a, b) => b.balance - a.balance);
  }, [orders, payments, platformMap, platforms]);

  // Supplier balances: auto-include ALL suppliers from suppliers table
  const supplierBalances = useMemo(() => {
    const map: Record<string, { name: string; logoUrl: string | null; totalOwed: number; totalPaid: number; purchaseCount: number }> = {};
    // Seed all suppliers
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

  const totalPlatform = platformBalances.reduce((s, d) => s + Math.max(0, d.balance), 0);
  const totalSupplierOwed = supplierBalances.reduce((s, d) => s + Math.max(0, d.balance), 0);
  const totalAccessible = totalPlatform - totalSupplierOwed;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <WalletIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
      </div>

      {/* Total accessible balance hero */}
      <div className="rounded-2xl border bg-gradient-to-br from-card to-muted/30 p-8 text-center">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Accessible Balance</p>
        <p className={cn("text-5xl font-bold tracking-tight", totalAccessible >= 0 ? "text-success" : "text-destructive")}>
          {totalAccessible >= 0 ? "" : "-"}{fmt(totalAccessible)}
        </p>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div>
            <span className="text-muted-foreground">Platform Income: </span>
            <span className="font-semibold text-success">{fmt(totalPlatform)}</span>
          </div>
          <span className="text-muted-foreground">—</span>
          <div>
            <span className="text-muted-foreground">Owed to Suppliers: </span>
            <span className="font-semibold text-destructive">{fmt(totalSupplierOwed)}</span>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Income — credit card style */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-4 w-4 text-success" />
            <h3 className="text-sm font-semibold">Platform Income</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {platformBalances.map((p, i) => (
              <div
                key={p.id}
                className={cn(
                  "relative rounded-xl p-5 text-white overflow-hidden bg-gradient-to-br shadow-lg",
                  cardGradients[i % cardGradients.length]
                )}
              >
                {/* Card pattern */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -mr-10 -mt-10" />
                <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-white/5 -ml-6 -mb-6" />

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <LogoAvatar
                      name={p.name}
                      logoUrl={p.logoUrl}
                      entityType="platform"
                      entityId={p.id}
                      size="md"
                    />
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">
                    {p.balance >= 0 ? "" : "-"}{fmt(p.balance)}
                  </p>
                  <div className="flex items-center justify-between mt-3 text-[11px] opacity-80">
                    <span>{p.orderCount} order{p.orderCount !== 1 ? "s" : ""}</span>
                    <span>Total: {fmt(p.totalOwed)}</span>
                  </div>
                </div>
              </div>
            ))}
            {platformBalances.length === 0 && (
              <div className="col-span-2 rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
                No platforms yet. Add platforms on the Platforms page.
              </div>
            )}
          </div>
        </div>

        {/* Suppliers — card style */}
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
                  <LogoAvatar
                    name={s.name}
                    logoUrl={s.logoUrl}
                    entityType="supplier"
                    entityId={s.id}
                    size="md"
                  />
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
    </div>
  );
}
