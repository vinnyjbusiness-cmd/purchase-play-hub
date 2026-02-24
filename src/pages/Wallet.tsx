import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet as WalletIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (n: number) => `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

export default function Wallet() {
  const [orders, setOrders] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("orders").select("id,sale_price,fees,net_received,quantity,platform_id,payment_received,status"),
      supabase.from("purchases").select("id,quantity,unit_cost,total_cost,total_cost_gbp,currency,supplier_id,supplier_paid"),
      supabase.from("suppliers").select("id,name"),
      supabase.from("platforms").select("id,name"),
      supabase.from("balance_payments").select("*"),
    ]).then(([o, p, s, pl, pay]) => {
      setOrders(o.data || []);
      setPurchases(p.data || []);
      setSuppliers(s.data || []);
      setPlatforms(pl.data || []);
      setPayments(pay.data || []);
    });
  }, []);

  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const platformMap = useMemo(() => Object.fromEntries(platforms.map(p => [p.id, p])), [platforms]);

  // Platform balances: net received from paid orders
  const platformBalances = useMemo(() => {
    const map: Record<string, { name: string; received: number }> = {};
    orders.filter(o => o.status !== "cancelled" && o.status !== "refunded" && o.payment_received).forEach(o => {
      const key = o.platform_id || "direct";
      const net = Number(o.net_received || (o.sale_price - o.fees));
      if (!map[key]) map[key] = { name: key === "direct" ? "Direct Sale" : (platformMap[key]?.name || "Unknown"), received: 0 };
      map[key].received += net;
    });
    // Add platform payments received
    payments.filter(p => p.party_type === "platform" && p.party_id).forEach(pay => {
      if (!map[pay.party_id]) map[pay.party_id] = { name: platformMap[pay.party_id]?.name || "Unknown", received: 0 };
      if (pay.type === "payment") map[pay.party_id].received += pay.amount;
    });
    return Object.entries(map).map(([id, d]) => ({ id, ...d })).filter(d => Math.abs(d.received) > 0.01).sort((a, b) => b.received - a.received);
  }, [orders, payments, platformMap]);

  // Supplier balances: payments made to suppliers (accessible = money we've deployed)
  const supplierBalances = useMemo(() => {
    const map: Record<string, { name: string; paid: number }> = {};
    payments.filter(p => p.party_type === "supplier" && p.party_id).forEach(pay => {
      if (!map[pay.party_id]) map[pay.party_id] = { name: supplierMap[pay.party_id]?.name || "Unknown", paid: 0 };
      if (pay.type === "payment") map[pay.party_id].paid += pay.amount;
    });
    return Object.entries(map).map(([id, d]) => ({ id, ...d })).filter(d => d.paid > 0.01).sort((a, b) => b.paid - a.paid);
  }, [payments, supplierMap]);

  const totalPlatform = platformBalances.reduce((s, d) => s + d.received, 0);
  const totalSupplierPaid = supplierBalances.reduce((s, d) => s + d.paid, 0);
  const totalAccessible = totalPlatform - totalSupplierPaid;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <WalletIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
      </div>

      {/* Total accessible balance */}
      <div className="rounded-xl border bg-card p-6 text-center">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Accessible Balance</p>
        <p className={cn("text-4xl font-bold", totalAccessible >= 0 ? "text-success" : "text-destructive")}>
          {totalAccessible >= 0 ? "" : "-"}{fmt(totalAccessible)}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Platform income minus supplier payments
        </p>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Platform income */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Platform Income</h3>
            <span className="text-sm font-bold text-success">{fmt(totalPlatform)}</span>
          </div>
          {platformBalances.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No platform income recorded</p>
          ) : (
            <div className="divide-y divide-border">
              {platformBalances.map(d => (
                <div key={d.id} className="px-4 py-3 flex items-center justify-between">
                  <p className="text-sm font-medium">{d.name}</p>
                  <span className="text-sm font-bold text-success">{fmt(d.received)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Supplier payments */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Supplier Payments Made</h3>
            <span className="text-sm font-bold text-destructive">{fmt(totalSupplierPaid)}</span>
          </div>
          {supplierBalances.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No supplier payments recorded</p>
          ) : (
            <div className="divide-y divide-border">
              {supplierBalances.map(d => (
                <div key={d.id} className="px-4 py-3 flex items-center justify-between">
                  <p className="text-sm font-medium">{d.name}</p>
                  <span className="text-sm font-bold text-destructive">{fmt(d.paid)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
