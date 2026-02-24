import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet as WalletIcon, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const fmt = (n: number) => `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

const COLORS = [
  "hsl(220, 70%, 55%)", "hsl(160, 60%, 45%)", "hsl(340, 65%, 50%)",
  "hsl(45, 80%, 50%)", "hsl(280, 60%, 55%)", "hsl(190, 70%, 45%)",
  "hsl(10, 70%, 55%)", "hsl(120, 50%, 45%)",
];

export default function Wallet() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("purchases").select("id,quantity,unit_cost,total_cost,total_cost_gbp,currency,supplier_id,supplier_paid"),
      supabase.from("orders").select("id,sale_price,fees,net_received,quantity,platform_id,payment_received,status"),
      supabase.from("suppliers").select("id,name"),
      supabase.from("platforms").select("id,name"),
      supabase.from("balance_payments").select("*"),
    ]).then(([p, o, s, pl, pay]) => {
      setPurchases(p.data || []);
      setOrders(o.data || []);
      setSuppliers(s.data || []);
      setPlatforms(pl.data || []);
      setPayments(pay.data || []);
    });
  }, []);

  const supplierMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);
  const platformMap = useMemo(() => Object.fromEntries(platforms.map(p => [p.id, p])), [platforms]);

  // Calculate what we owe suppliers
  const supplierDebts = useMemo(() => {
    const map: Record<string, { name: string; owed: number; paid: number }> = {};
    purchases.forEach(p => {
      const cost = p.total_cost_gbp || (p.quantity * p.unit_cost);
      if (!map[p.supplier_id]) map[p.supplier_id] = { name: supplierMap[p.supplier_id]?.name || "Unknown", owed: 0, paid: 0 };
      map[p.supplier_id].owed += cost;
    });
    payments.filter(p => p.party_type === "supplier" && p.party_id).forEach(pay => {
      if (!map[pay.party_id]) map[pay.party_id] = { name: supplierMap[pay.party_id]?.name || "Unknown", owed: 0, paid: 0 };
      if (pay.type === "payment") map[pay.party_id].paid += pay.amount;
      else if (pay.type === "opening_balance" || pay.type === "adjustment") map[pay.party_id].owed += pay.amount;
    });
    return Object.entries(map).map(([id, d]) => ({ id, ...d, balance: d.owed - d.paid })).filter(d => d.balance > 0.01).sort((a, b) => b.balance - a.balance);
  }, [purchases, payments, supplierMap]);

  // Calculate what platforms owe us
  const platformReceivables = useMemo(() => {
    const map: Record<string, { name: string; owed: number; paid: number }> = {};
    orders.filter(o => o.status !== "cancelled" && o.status !== "refunded").forEach(o => {
      const key = o.platform_id || "direct";
      const net = o.net_received || (o.sale_price - o.fees);
      if (!map[key]) map[key] = { name: key === "direct" ? "Direct Sale" : (platformMap[key]?.name || "Unknown"), owed: 0, paid: 0 };
      map[key].owed += net;
    });
    payments.filter(p => p.party_type === "platform" && p.party_id).forEach(pay => {
      if (!map[pay.party_id]) map[pay.party_id] = { name: platformMap[pay.party_id]?.name || "Unknown", owed: 0, paid: 0 };
      if (pay.type === "payment") map[pay.party_id].paid += pay.amount;
      else if (pay.type === "opening_balance" || pay.type === "adjustment") map[pay.party_id].owed += pay.amount;
    });
    return Object.entries(map).map(([id, d]) => ({ id, ...d, balance: d.owed - d.paid })).filter(d => d.balance > 0.01).sort((a, b) => b.balance - a.balance);
  }, [orders, payments, platformMap]);

  const totalOwed = supplierDebts.reduce((s, d) => s + d.balance, 0);
  const totalReceivable = platformReceivables.reduce((s, d) => s + d.balance, 0);
  const netPosition = totalReceivable - totalOwed;

  // Chart data
  const owedChartData = supplierDebts.map(d => ({ name: d.name, value: d.balance }));
  const receivableChartData = platformReceivables.map(d => ({ name: d.name, value: d.balance }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <WalletIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>
      </div>

      {/* Top summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ArrowDownRight className="h-4 w-4 text-destructive" />
            <span className="text-xs font-medium">I Owe Out</span>
          </div>
          <p className="text-2xl font-bold text-destructive">{fmt(totalOwed)}</p>
          <p className="text-xs text-muted-foreground mt-1">{supplierDebts.length} supplier{supplierDebts.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ArrowUpRight className="h-4 w-4 text-success" />
            <span className="text-xs font-medium">Owed to Me</span>
          </div>
          <p className="text-2xl font-bold text-success">{fmt(totalReceivable)}</p>
          <p className="text-xs text-muted-foreground mt-1">{platformReceivables.length} platform{platformReceivables.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            {netPosition >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
            <span className="text-xs font-medium">Net Position</span>
          </div>
          <p className={cn("text-2xl font-bold", netPosition >= 0 ? "text-success" : "text-destructive")}>
            {netPosition >= 0 ? "+" : "-"}{fmt(Math.abs(netPosition))}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{netPosition >= 0 ? "Net positive" : "Net negative"}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Owed Out Chart */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-destructive" /> I Owe — by Supplier
          </h3>
          {owedChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No outstanding supplier debts</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={owedChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {owedChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Receivable Chart */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-success" /> Owed to Me — by Platform
          </h3>
          {receivableChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No outstanding platform receivables</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={receivableChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {receivableChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Breakdown tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold">Supplier Debts</h3>
          </div>
          {supplierDebts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">All clear — no debts</p>
          ) : (
            <div className="divide-y divide-border">
              {supplierDebts.map(d => (
                <div key={d.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">Owed: {fmt(d.owed)} · Paid: {fmt(d.paid)}</p>
                  </div>
                  <span className="text-sm font-bold text-destructive">{fmt(d.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold">Platform Receivables</h3>
          </div>
          {platformReceivables.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">All clear — nothing outstanding</p>
          ) : (
            <div className="divide-y divide-border">
              {platformReceivables.map(d => (
                <div key={d.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">Owed: {fmt(d.owed)} · Received: {fmt(d.paid)}</p>
                  </div>
                  <span className="text-sm font-bold text-success">{fmt(d.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
