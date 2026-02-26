import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Phone, Mail, StickyNote, ShoppingCart, Package, TrendingUp, TrendingDown, Hash } from "lucide-react";
import { format } from "date-fns";
import LogoAvatar from "@/components/LogoAvatar";

interface Supplier {
  id: string;
  display_id: string | null;
  name: string;
  logo_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  payment_terms: string | null;
  notes: string | null;
  created_at: string;
}

interface OrderRow {
  id: string;
  quantity: number;
  sale_price: number;
  status: string;
  order_date: string;
  category: string;
  buyer_name: string | null;
  platform: { name: string } | null;
  events: { home_team: string; away_team: string; event_date: string } | null;
}

interface PurchaseRow {
  id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number | null;
  total_cost_gbp: number | null;
  status: string;
  purchase_date: string;
  category: string;
  supplier_paid: boolean;
  events: { home_team: string; away_team: string; event_date: string } | null;
}

interface Props {
  supplier: Supplier | null;
  onClose: () => void;
  onUpdated: () => void;
  isBuyer: boolean;
  isSupplier: boolean;
}

const statusColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  received: "bg-success/10 text-success border-success/20",
  fulfilled: "bg-success/10 text-success border-success/20",
  delivered: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  refunded: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function ContactProfileSheet({ supplier, onClose, onUpdated, isBuyer, isSupplier }: Props) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!supplier) return;
    setLogoUrl(supplier.logo_url);

    // Fetch purchases from this contact
    const fetchPurchases = supabase
      .from("purchases")
      .select("id, quantity, unit_cost, total_cost, total_cost_gbp, status, purchase_date, category, supplier_paid, events(home_team, away_team, event_date)")
      .eq("supplier_id", supplier.id)
      .order("purchase_date", { ascending: false });

    // Fetch orders where buyer_name matches contact name
    const fetchOrders = supabase
      .from("orders")
      .select("id, quantity, sale_price, status, order_date, category, buyer_name, platform:platforms(name), events(home_team, away_team, event_date)")
      .ilike("buyer_name", supplier.name)
      .order("order_date", { ascending: false });

    Promise.all([fetchPurchases, fetchOrders]).then(([purchRes, orderRes]) => {
      setPurchases((purchRes.data as PurchaseRow[]) || []);
      setOrders((orderRes.data as OrderRow[]) || []);
    });
  }, [supplier]);

  const totalSales = useMemo(() => orders.reduce((s, o) => s + o.sale_price, 0), [orders]);
  const totalPurchaseCost = useMemo(() => purchases.reduce((s, p) => s + (p.total_cost_gbp || p.total_cost || p.quantity * p.unit_cost), 0), [purchases]);
  const netBalance = totalSales - totalPurchaseCost;
  const totalTransactions = orders.length + purchases.length;

  const handleExportCSV = () => {
    if (!supplier) return;
    const headers = ["Date", "Type", "Event", "Category", "Quantity", "Price", "Status", "Net"];
    const rows: string[][] = [];

    orders.forEach(o => {
      const ev = o.events ? `${o.events.home_team} vs ${o.events.away_team}` : "";
      rows.push([
        format(new Date(o.order_date), "dd/MM/yyyy"),
        "Sale",
        ev,
        o.category,
        o.quantity.toString(),
        o.sale_price.toFixed(2),
        o.status,
        o.sale_price.toFixed(2),
      ]);
    });

    purchases.forEach(p => {
      const ev = p.events ? `${p.events.home_team} vs ${p.events.away_team}` : "";
      const cost = p.total_cost_gbp || p.total_cost || p.quantity * p.unit_cost;
      rows.push([
        format(new Date(p.purchase_date), "dd/MM/yyyy"),
        "Purchase",
        ev,
        p.category,
        p.quantity.toString(),
        cost.toFixed(2),
        p.status,
        `-${cost.toFixed(2)}`,
      ]);
    });

    // Sort by date
    rows.sort((a, b) => new Date(b[0].split("/").reverse().join("-")).getTime() - new Date(a[0].split("/").reverse().join("-")).getTime());

    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${supplier.name.replace(/\s+/g, "-")}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={!!supplier} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {supplier && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <LogoAvatar
                  name={supplier.name}
                  logoUrl={logoUrl}
                  entityType="supplier"
                  entityId={supplier.id}
                  editable
                  size="lg"
                  onLogoUpdated={(url) => setLogoUrl(url)}
                />
                <div className="min-w-0">
                  <SheetTitle className="text-lg">{supplier.name}</SheetTitle>
                  <div className="flex items-center gap-1.5 mt-1">
                    {isBuyer && (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                        Buyer
                      </Badge>
                    )}
                    {isSupplier && (
                      <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/30 text-[10px]">
                        Supplier
                      </Badge>
                    )}
                    {!isBuyer && !isSupplier && (
                      <span className="text-[10px] text-muted-foreground">No transactions yet</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {supplier.contact_phone && (
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {supplier.contact_phone}</span>
                    )}
                    {supplier.contact_email && (
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {supplier.contact_email}</span>
                    )}
                    {supplier.contact_name && (
                      <span>{supplier.contact_name}</span>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {supplier.notes && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                {supplier.notes}
              </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="text-center rounded-lg border bg-muted/30 p-3">
                <TrendingUp className="h-4 w-4 mx-auto mb-1 text-emerald-400" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sales to them</p>
                <p className="text-sm font-bold font-mono">£{totalSales.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
              <div className="text-center rounded-lg border bg-muted/30 p-3">
                <TrendingDown className="h-4 w-4 mx-auto mb-1 text-purple-400" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bought from them</p>
                <p className="text-sm font-bold font-mono">£{totalPurchaseCost.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
              <div className="text-center rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Net Balance</p>
                <p className={`text-sm font-bold font-mono ${netBalance >= 0 ? "text-emerald-400" : "text-destructive"}`}>
                  £{Math.abs(netBalance).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="text-center rounded-lg border bg-muted/30 p-3">
                <Hash className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Transactions</p>
                <p className="text-sm font-bold font-mono">{totalTransactions}</p>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={handleExportCSV} disabled={totalTransactions === 0}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export Contact Report
              </Button>
            </div>

            <Separator className="my-4" />

            {/* Tabs */}
            <Tabs defaultValue={orders.length > 0 ? "sales" : "purchases"} className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="sales" className="flex-1">Sales to them ({orders.length})</TabsTrigger>
                <TabsTrigger value="purchases" className="flex-1">Purchases from them ({purchases.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="sales" className="mt-3">
                {orders.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No sales to this contact</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Event</TableHead>
                          <TableHead className="text-[10px]">Date</TableHead>
                          <TableHead className="text-[10px]">Cat</TableHead>
                          <TableHead className="text-[10px] text-right">Qty</TableHead>
                          <TableHead className="text-[10px] text-right">Sale</TableHead>
                          <TableHead className="text-[10px]">Platform</TableHead>
                          <TableHead className="text-[10px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orders.map(o => (
                          <TableRow key={o.id}>
                            <TableCell className="text-xs">{o.events ? `${o.events.home_team} vs ${o.events.away_team}` : "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(o.order_date), "dd MMM yy")}</TableCell>
                            <TableCell className="text-xs">{o.category}</TableCell>
                            <TableCell className="text-xs text-right">{o.quantity}</TableCell>
                            <TableCell className="text-xs text-right font-mono">£{Number(o.sale_price).toFixed(2)}</TableCell>
                            <TableCell className="text-xs">{(o.platform as any)?.name || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${statusColor[o.status] || ""}`}>{o.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="purchases" className="mt-3">
                {purchases.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No purchases from this contact</p>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Event</TableHead>
                          <TableHead className="text-[10px]">Date</TableHead>
                          <TableHead className="text-[10px]">Cat</TableHead>
                          <TableHead className="text-[10px] text-right">Qty</TableHead>
                          <TableHead className="text-[10px] text-right">Cost</TableHead>
                          <TableHead className="text-[10px]">Status</TableHead>
                          <TableHead className="text-[10px]">Paid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchases.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs">{p.events ? `${p.events.home_team} vs ${p.events.away_team}` : "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(p.purchase_date), "dd MMM yy")}</TableCell>
                            <TableCell className="text-xs">{p.category}</TableCell>
                            <TableCell className="text-xs text-right">{p.quantity}</TableCell>
                            <TableCell className="text-xs text-right font-mono">£{Number(p.total_cost_gbp || p.total_cost || p.quantity * p.unit_cost).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${statusColor[p.status] || ""}`}>{p.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${p.supplier_paid ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"}`}>
                                {p.supplier_paid ? "Paid" : "Unpaid"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
