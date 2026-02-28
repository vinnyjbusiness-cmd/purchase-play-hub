import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ArrowRight, Package, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import LinkInventoryDialog from "./LinkInventoryDialog";
import OrderMiniTimeline from "./OrderMiniTimeline";

interface OrderDetailProps {
  orderId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

interface LinkedTicket {
  order_line_id: string;
  inventory_id: string;
  category: string;
  section: string | null;
  row_name: string | null;
  seat: string | null;
  purchase_id: string;
  supplier_name: string;
  supplier_order_id: string | null;
  unit_cost: number;
  purchase_currency: string;
}

interface OrderInfo {
  id: string;
  order_ref: string | null;
  buyer_ref: string | null;
  category: string;
  quantity: number;
  sale_price: number;
  fees: number;
  net_received: number;
  status: string;
  delivery_type: string;
  delivery_status: string | null;
  currency: string;
  order_date: string;
  notes: string | null;
  event_id: string;
  events: { match_code: string; home_team: string; away_team: string } | null;
  platforms: { name: string } | null;
}

export default function OrderDetailSheet({ orderId, onClose, onUpdated }: OrderDetailProps) {
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [linkedTickets, setLinkedTickets] = useState<LinkedTicket[]>([]);
  const [showLink, setShowLink] = useState(false);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;

    const { data: orderData } = await supabase
      .from("orders")
      .select("*, events(match_code, home_team, away_team), platforms(name)")
      .eq("id", orderId)
      .single();

    setOrder(orderData as any);

    // Load linked inventory via order_lines
    const { data: orderLines } = await supabase
      .from("order_lines")
      .select("id, inventory_id")
      .eq("order_id", orderId);

    if (orderLines && orderLines.length > 0) {
      const inventoryIds = orderLines.map((ol) => ol.inventory_id);
      const { data: inventoryData } = await supabase
        .from("inventory")
        .select("id, category, section, row_name, seat, purchase_id")
        .in("id", inventoryIds);

      if (inventoryData && inventoryData.length > 0) {
        const purchaseIds = [...new Set(inventoryData.map((i) => i.purchase_id))];
        const { data: purchaseData } = await supabase
          .from("purchases")
          .select("id, unit_cost, currency, supplier_order_id, suppliers(name)")
          .in("id", purchaseIds);

        const purchaseMap = new Map((purchaseData || []).map((p) => [p.id, p]));

        const tickets: LinkedTicket[] = inventoryData.map((inv) => {
          const ol = orderLines.find((o) => o.inventory_id === inv.id)!;
          const purchase = purchaseMap.get(inv.purchase_id) as any;
          return {
            order_line_id: ol.id,
            inventory_id: inv.id,
            category: inv.category,
            section: inv.section,
            row_name: inv.row_name,
            seat: inv.seat,
            purchase_id: inv.purchase_id,
            supplier_name: purchase?.suppliers?.name || "Unknown",
            supplier_order_id: purchase?.supplier_order_id || null,
            unit_cost: Number(purchase?.unit_cost || 0),
            purchase_currency: purchase?.currency || "GBP",
          };
        });
        setLinkedTickets(tickets);
      } else {
        setLinkedTickets([]);
      }
    } else {
      setLinkedTickets([]);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) loadOrder();
  }, [orderId, loadOrder]);

  const handleUnlink = async (orderLineId: string, inventoryId: string) => {
    const { error } = await supabase.from("order_lines").delete().eq("id", orderLineId);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Set inventory status back to available
    await supabase.from("inventory").update({ status: "available" }).eq("id", inventoryId);
    toast.success("Ticket unlinked");
    loadOrder();
    onUpdated();
  };

  if (!order) return null;

  const totalCost = linkedTickets.reduce((s, t) => s + t.unit_cost, 0);
  const saleTotal = Number(order.sale_price) * order.quantity;
  const profit = (Number(order.net_received) || saleTotal) - totalCost;
  const sym = (c: string) => (c === "GBP" ? "£" : c === "USD" ? "$" : "€");

  return (
    <>
      <Sheet open={!!orderId} onOpenChange={() => onClose()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Order {order.order_ref || order.id.slice(0, 8)}
              <Badge variant="outline" className="ml-2">{order.status}</Badge>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Order summary */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Event</p>
                <p className="font-medium">{order.events?.match_code} — {order.events?.home_team} vs {order.events?.away_team}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Platform</p>
                <p className="font-medium">{order.platforms?.name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Buyer Ref</p>
                <p className="font-medium">{order.buyer_ref || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Delivery</p>
                <p className="font-medium">{order.delivery_type.replace("_", " ")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Category</p>
                <p className="font-medium">{order.category}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Quantity</p>
                <p className="font-medium">{order.quantity}</p>
              </div>
            </div>

            <Separator />

            {/* Status & Delivery controls */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Order Status</p>
                <Select
                  value={order.status}
                  onValueChange={async (val) => {
                    const { error } = await supabase.from("orders").update({ status: val as any }).eq("id", order.id);
                    if (error) { toast.error(error.message); return; }
                    toast.success("Status updated");
                    loadOrder();
                    onUpdated();
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outstanding">Outstanding</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="partially_delivered">Partially Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Delivery Status</p>
                <Select
                  value={order.delivery_status || "pending"}
                  onValueChange={async (val) => {
                    const { error } = await supabase.from("orders").update({ delivery_status: val }).eq("id", order.id);
                    if (error) { toast.error(error.message); return; }
                    toast.success("Delivery status updated");
                    loadOrder();
                    onUpdated();
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="awaiting_delivery">Awaiting Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                {profit >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                Profit & Loss
              </h3>
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sale ({order.quantity}× £{Number(order.sale_price).toFixed(2)})</span>
                  <span className="font-medium">£{(Number(order.sale_price) * order.quantity).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform Fees</span>
                  <span className="font-medium text-destructive">-£{Number(order.fees).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Net Received</span>
                  <span className="font-medium">£{Number(order.net_received).toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supply Cost ({linkedTickets.length} ticket{linkedTickets.length !== 1 ? "s" : ""})</span>
                  <span className="font-medium text-destructive">-£{totalCost.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Profit</span>
                  <span className={profit >= 0 ? "text-success" : "text-destructive"}>
                    {profit >= 0 ? "+" : ""}£{profit.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Linked tickets / purchases */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Linked Tickets ({linkedTickets.length})
                </h3>
                <Button size="sm" variant="outline" onClick={() => setShowLink(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Link Ticket
                </Button>
              </div>

              {linkedTickets.length > 0 ? (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Seat</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedTickets.map((t) => (
                        <TableRow key={t.order_line_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-xs">{t.supplier_name}</p>
                              {t.supplier_order_id && <p className="text-xs text-muted-foreground">{t.supplier_order_id}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{t.category}</TableCell>
                          <TableCell className="text-xs">
                            {[t.section, t.row_name, t.seat].filter(Boolean).join(", ") || "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium">
                            {sym(t.purchase_currency)}{t.unit_cost.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleUnlink(t.order_line_id, t.inventory_id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  <p>No tickets linked yet</p>
                  <p className="text-xs mt-1">Link inventory tickets to see the supply cost and profit</p>
                </div>
              )}

            {linkedTickets.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  Chain: Supplier → Purchase → Inventory → This Order
                </div>
              )}
            </div>

            <Separator />

            {/* Mini Timeline */}
            <OrderMiniTimeline orderId={order.id} />
          </div>
        </SheetContent>
      </Sheet>

      {showLink && order && (
        <LinkInventoryDialog
          orderId={order.id}
          eventId={order.event_id}
          existingInventoryIds={linkedTickets.map((t) => t.inventory_id)}
          onClose={() => setShowLink(false)}
          onLinked={() => {
            setShowLink(false);
            loadOrder();
            onUpdated();
          }}
        />
      )}
    </>
  );
}
