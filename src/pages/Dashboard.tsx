import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  CheckCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";

interface Stats {
  totalRevenue: number;
  totalProfit: number;
  owedToSuppliers: number;
  pendingPayouts: number;
  openOrders: number;
  completedOrders: number;
  refunds: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    totalProfit: 0,
    owedToSuppliers: 0,
    pendingPayouts: 0,
    openOrders: 0,
    completedOrders: 0,
    refunds: 0,
  });

  useEffect(() => {
    async function loadStats() {
      const [ordersRes, purchasesRes, payoutsRes, refundsRes] = await Promise.all([
        supabase.from("orders").select("sale_price, fees, status"),
        supabase.from("purchases").select("total_cost, status"),
        supabase.from("payouts").select("amount, status"),
        supabase.from("refunds").select("amount, status"),
      ]);

      const orders = ordersRes.data || [];
      const purchases = purchasesRes.data || [];
      const payouts = payoutsRes.data || [];
      const refunds = refundsRes.data || [];

      const totalRevenue = orders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
      const totalCosts = purchases.reduce((s, p) => s + Number(p.total_cost || 0), 0);
      const totalFees = orders.reduce((s, o) => s + Number(o.fees || 0), 0);

      setStats({
        totalRevenue,
        totalProfit: totalRevenue - totalCosts - totalFees,
        owedToSuppliers: purchases
          .filter((p) => p.status === "confirmed" || p.status === "pending")
          .reduce((s, p) => s + Number(p.total_cost || 0), 0),
        pendingPayouts: payouts
          .filter((p) => p.status === "pending")
          .reduce((s, p) => s + Number(p.amount || 0), 0),
        openOrders: orders.filter((o) => o.status === "pending" || o.status === "fulfilled").length,
        completedOrders: orders.filter((o) => o.status === "delivered").length,
        refunds: refunds.length,
      });
    }
    loadStats();
  }, []);

  const cards = [
    { title: "Total Revenue", value: stats.totalRevenue, icon: DollarSign, prefix: "£" },
    { title: "Total Profit", value: stats.totalProfit, icon: stats.totalProfit >= 0 ? TrendingUp : TrendingDown, prefix: "£" },
    { title: "Owed to Suppliers", value: stats.owedToSuppliers, icon: AlertTriangle, prefix: "£" },
    { title: "Pending Payouts", value: stats.pendingPayouts, icon: Clock, prefix: "£" },
    { title: "Open Orders", value: stats.openOrders, icon: ShoppingCart },
    { title: "Completed Orders", value: stats.completedOrders, icon: CheckCircle },
    { title: "Refunds", value: stats.refunds, icon: AlertTriangle },
  ];

  const fmt = (v: number, prefix?: string) =>
    `${prefix || ""}${v.toLocaleString("en-GB", { minimumFractionDigits: prefix ? 2 : 0, maximumFractionDigits: 2 })}`;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your ticket trading operations</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{fmt(c.value, c.prefix)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
