import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, CalendarDays, TrendingUp, TrendingDown, DollarSign, CreditCard, Package, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface EventRow {
  id: string;
  match_code: string;
  competition: string;
  home_team: string;
  away_team: string;
  event_date: string;
  venue: string | null;
  city: string | null;
}

interface OrderRow {
  id: string;
  order_ref: string | null;
  buyer_ref: string | null;
  sale_price: number;
  fees: number;
  net_received: number | null;
  quantity: number;
  currency: string;
  status: string;
  delivery_status: string | null;
  payment_received: boolean;
  order_date: string;
  category: string;
  platforms: { name: string } | null;
}

interface PurchaseRow {
  id: string;
  supplier_order_id: string | null;
  unit_cost: number;
  fees: number;
  total_cost: number;
  quantity: number;
  currency: string;
  status: string;
  supplier_paid: boolean;
  purchase_date: string;
  category: string;
  section: string | null;
  suppliers: { name: string } | null;
}

const sym = (c: string) => (c === "GBP" ? "£" : c === "USD" ? "$" : "€");

const statusColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  fulfilled: "bg-primary/10 text-primary border-primary/20",
  delivered: "bg-success/10 text-success border-success/20",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  received: "bg-success/10 text-success border-success/20",
  refunded: "bg-destructive/10 text-destructive border-destructive/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const [evRes, ordRes, purRes] = await Promise.all([
      supabase.from("events").select("*").eq("id", id).single(),
      supabase.from("orders").select("*, platforms(name)").eq("event_id", id).order("order_date", { ascending: false }),
      supabase.from("purchases").select("*, suppliers(name)").eq("event_id", id).order("purchase_date", { ascending: false }),
    ]);
    setEvent(evRes.data as EventRow | null);
    setOrders((ordRes.data as any) || []);
    setPurchases((purRes.data as any) || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const toggleSupplierPaid = async (purchaseId: string, current: boolean) => {
    const { error } = await supabase.from("purchases").update({ supplier_paid: !current }).eq("id", purchaseId);
    if (error) { toast.error("Failed to update"); return; }
    setPurchases((prev) => prev.map((p) => p.id === purchaseId ? { ...p, supplier_paid: !current } : p));
    toast.success(!current ? "Marked as paid" : "Marked as unpaid");
  };

  const togglePaymentReceived = async (orderId: string, current: boolean) => {
    const { error } = await supabase.from("orders").update({ payment_received: !current }).eq("id", orderId);
    if (error) { toast.error("Failed to update"); return; }
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, payment_received: !current } : o));
    toast.success(!current ? "Marked as received" : "Marked as not received");
  };

  if (loading || !event) {
    return (
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/events")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Events
        </Button>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Aggregations
  const totalRevenue = orders.reduce((s, o) => s + Number(o.sale_price || 0), 0);
  const totalFees = orders.reduce((s, o) => s + Number(o.fees || 0), 0);
  const totalCosts = purchases.reduce((s, p) => s + Number(p.total_cost || 0), 0);
  const profit = totalRevenue - totalFees - totalCosts;

  const owedToSuppliers = purchases.filter((p) => !p.supplier_paid).reduce((s, p) => s + Number(p.total_cost || 0), 0);
  const paidToSuppliers = purchases.filter((p) => p.supplier_paid).reduce((s, p) => s + Number(p.total_cost || 0), 0);
  const owedToYou = orders.filter((o) => !o.payment_received).reduce((s, o) => s + Number(o.sale_price || 0), 0);
  const receivedFromSales = orders.filter((o) => o.payment_received).reduce((s, o) => s + Number(o.sale_price || 0), 0);

  // Group by supplier
  const supplierSummary = purchases.reduce<Record<string, { name: string; owed: number; paid: number; total: number }>>((acc, p) => {
    const name = p.suppliers?.name || "Unknown";
    if (!acc[name]) acc[name] = { name, owed: 0, paid: 0, total: 0 };
    const cost = Number(p.total_cost || 0);
    acc[name].total += cost;
    if (p.supplier_paid) acc[name].paid += cost;
    else acc[name].owed += cost;
    return acc;
  }, {});

  // Group by platform
  const platformSummary = orders.reduce<Record<string, { name: string; owed: number; received: number; total: number }>>((acc, o) => {
    const name = o.platforms?.name || "Direct";
    if (!acc[name]) acc[name] = { name, owed: 0, received: 0, total: 0 };
    const amount = Number(o.sale_price || 0);
    acc[name].total += amount;
    if (o.payment_received) acc[name].received += amount;
    else acc[name].owed += amount;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/events")} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Events
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary">{event.match_code}</Badge>
              <Badge variant="outline">{event.competition}</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{event.home_team} vs {event.away_team}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{format(new Date(event.event_date), "dd MMM yyyy, HH:mm")}</span>
              {event.venue && <span>{event.venue}{event.city ? `, ${event.city}` : ""}</span>}
            </div>
          </div>
          <Badge variant="outline" className={`text-lg px-3 py-1 ${profit >= 0 ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}`}>
            {profit >= 0 ? "+" : ""}£{profit.toFixed(2)} profit
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" />Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">£{totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{orders.length} orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Package className="h-3.5 w-3.5" />Costs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">£{totalCosts.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{purchases.length} purchases</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" />You Owe</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">£{owedToSuppliers.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">£{paidToSuppliers.toFixed(2)} already paid</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-success flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />Owed to You</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">£{owedToYou.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">£{receivedFromSales.toFixed(2)} received</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="sales" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sales">Sales ({orders.length})</TabsTrigger>
          <TabsTrigger value="purchases">Purchases ({purchases.length})</TabsTrigger>
          <TabsTrigger value="suppliers">By Supplier</TabsTrigger>
          <TabsTrigger value="platforms">By Platform</TabsTrigger>
        </TabsList>

        {/* Sales Tab */}
        <TabsContent value="sales">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Sale Price</TableHead>
                  <TableHead className="text-right">Fees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.order_ref || "—"}</TableCell>
                    <TableCell>{o.platforms?.name || "Direct"}</TableCell>
                    <TableCell>{o.category}</TableCell>
                    <TableCell className="text-right">{o.quantity}</TableCell>
                    <TableCell className="text-right">{sym(o.currency)}{Number(o.sale_price).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{sym(o.currency)}{Number(o.fees).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[o.status] || ""}>{o.status}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[o.delivery_status || "pending"] || ""}>{o.delivery_status || "pending"}</Badge></TableCell>
                    <TableCell>
                      <Switch checked={o.payment_received} onCheckedChange={() => togglePaymentReceived(o.id, o.payment_received)} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(o.order_date), "dd MMM yy")}</TableCell>
                  </TableRow>
                ))}
                {orders.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No sales for this event</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Purchases Tab */}
        <TabsContent value="purchases">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.suppliers?.name || "—"}</TableCell>
                    <TableCell>{p.supplier_order_id || "—"}</TableCell>
                    <TableCell>{p.category}</TableCell>
                    <TableCell>{p.section || "—"}</TableCell>
                    <TableCell className="text-right">{p.quantity}</TableCell>
                    <TableCell className="text-right">{sym(p.currency)}{Number(p.unit_cost).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">{sym(p.currency)}{Number(p.total_cost).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColor[p.status] || ""}>{p.status}</Badge></TableCell>
                    <TableCell>
                      <Switch checked={p.supplier_paid} onCheckedChange={() => toggleSupplierPaid(p.id, p.supplier_paid)} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(p.purchase_date), "dd MMM yy")}</TableCell>
                  </TableRow>
                ))}
                {purchases.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-muted-foreground">No purchases for this event</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* By Supplier Tab */}
        <TabsContent value="suppliers">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.values(supplierSummary).map((s) => (
              <Card key={s.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total cost</span>
                    <span className="font-medium">£{s.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="text-success font-medium">£{s.paid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Still owed</span>
                    <span className="text-destructive font-medium">£{s.owed.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {Object.keys(supplierSummary).length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-12">No supplier purchases for this event</p>
            )}
          </div>
        </TabsContent>

        {/* By Platform Tab */}
        <TabsContent value="platforms">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.values(platformSummary).map((p) => (
              <Card key={p.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total sales</span>
                    <span className="font-medium">£{p.total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Received</span>
                    <span className="text-success font-medium">£{p.received.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Owed to you</span>
                    <span className="text-destructive font-medium">£{p.owed.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {Object.keys(platformSummary).length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-12">No sales for this event</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
