import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, LinkIcon, TrendingDown, Clock } from "lucide-react";

interface Exception {
  type: string;
  title: string;
  description: string;
  count: number;
  icon: typeof AlertTriangle;
  color: string;
}

export default function Reconciliation() {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      // Orders with no linked inventory (order_lines)
      const { data: ordersData } = await supabase.from("orders").select("id");
      const { data: orderLinesData } = await supabase.from("order_lines").select("order_id");
      const linkedOrderIds = new Set((orderLinesData || []).map((ol) => ol.order_id));
      const unlinkedOrders = (ordersData || []).filter((o) => !linkedOrderIds.has(o.id));

      // Purchases with no sold inventory
      const { data: purchasesData } = await supabase.from("purchases").select("id");
      const { data: inventoryData } = await supabase.from("inventory").select("purchase_id, status");
      const purchaseIdsWithSold = new Set(
        (inventoryData || []).filter((i) => i.status === "sold").map((i) => i.purchase_id)
      );
      const unassignedPurchases = (purchasesData || []).filter((p) => !purchaseIdsWithSold.has(p.id));

      // Negative profit orders
      const { data: ordersWithCosts } = await supabase
        .from("orders")
        .select("id, sale_price, fees");
      // Simplified: just flag orders where fees > sale_price  
      const negativeProfitOrders = (ordersWithCosts || []).filter(
        (o) => Number(o.fees) > Number(o.sale_price)
      );

      // Delivery overdue (pending delivery, order > 7 days old)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: overdueOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("delivery_status", "pending")
        .lt("order_date", sevenDaysAgo);

      setExceptions([
        {
          type: "unlinked_orders",
          title: "Orders Without Supplier Link",
          description: "Sales with no linked supplier purchase",
          count: unlinkedOrders.length,
          icon: LinkIcon,
          color: "text-warning",
        },
        {
          type: "unassigned_purchases",
          title: "Unassigned Purchases",
          description: "Supplier buys not linked to any sale",
          count: unassignedPurchases.length,
          icon: AlertTriangle,
          color: "text-destructive",
        },
        {
          type: "negative_profit",
          title: "Negative Profit Deals",
          description: "Orders where costs exceed revenue",
          count: negativeProfitOrders.length,
          icon: TrendingDown,
          color: "text-destructive",
        },
        {
          type: "delivery_overdue",
          title: "Delivery Overdue",
          description: "Pending deliveries older than 7 days",
          count: (overdueOrders || []).length,
          icon: Clock,
          color: "text-warning",
        },
      ]);
      setLoading(false);
    }
    check();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Reconciliation</h1>
        <p className="text-muted-foreground">Loading checks...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reconciliation</h1>
        <p className="text-muted-foreground">Exception checks and data integrity alerts</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {exceptions.map((ex) => (
          <Card key={ex.type} className={ex.count > 0 ? "border-destructive/30" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{ex.title}</CardTitle>
              <ex.icon className={`h-4 w-4 ${ex.color}`} />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{ex.count}</span>
                {ex.count === 0 ? (
                  <Badge variant="secondary" className="bg-success/10 text-success border-success/20">All clear</Badge>
                ) : (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Needs attention</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{ex.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
