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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Link2, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  purchaseId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

interface PurchaseInfo {
  id: string;
  supplier_order_id: string | null;
  category: string;
  section: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  status: string;
  supplier_paid: boolean;
  purchase_date: string;
  notes: string | null;
  event_id: string;
  suppliers: { name: string } | null;
  events: { match_code: string; home_team: string; away_team: string } | null;
}

interface InventoryItem {
  id: string;
  status: string;
  category: string;
  section: string | null;
  row_name: string | null;
  seat: string | null;
  linked_order_ref: string | null;
  linked_order_id: string | null;
}

interface MatchingOrder {
  id: string;
  order_ref: string | null;
  category: string;
  quantity: number;
  sale_price: number;
  status: string;
  platforms: { name: string } | null;
  linked_count: number;
  needed: number;
  match_score: number;
  match_reasons: string[];
}

export default function PurchaseDetailSheet({ purchaseId, onClose, onUpdated }: Props) {
  const [purchase, setPurchase] = useState<PurchaseInfo | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [matchingOrders, setMatchingOrders] = useState<MatchingOrder[]>([]);
  const [allocating, setAllocating] = useState<string | null>(null);
  const [justAssigned, setJustAssigned] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!purchaseId) return;
    setDeleting(true);
    try {
      // Delete related order_lines via inventory
      const invIds = inventory.map((i) => i.id);
      if (invIds.length > 0) {
        await supabase.from("order_lines").delete().in("inventory_id", invIds);
        await supabase.from("inventory").delete().eq("purchase_id", purchaseId);
      }
      const { error } = await supabase.from("purchases").delete().eq("id", purchaseId);
      if (error) throw error;
      toast.success("Purchase deleted");
      onClose();
      onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const load = useCallback(async () => {
    if (!purchaseId) return;

    const { data: purchaseData } = await supabase
      .from("purchases")
      .select("*, suppliers(name), events(match_code, home_team, away_team)")
      .eq("id", purchaseId)
      .single();

    if (!purchaseData) return;
    setPurchase(purchaseData as any);

    // Load inventory for this purchase
    const { data: invData } = await supabase
      .from("inventory")
      .select("id, status, category, section, row_name, seat")
      .eq("purchase_id", purchaseId);

    // Check which inventory items are linked to orders
    const inventoryItems: InventoryItem[] = [];
    for (const inv of invData || []) {
      let linkedOrderRef: string | null = null;
      let linkedOrderId: string | null = null;
      if (inv.status === "sold") {
        const { data: olData } = await supabase
          .from("order_lines")
          .select("order_id")
          .eq("inventory_id", inv.id)
          .limit(1);
        if (olData && olData.length > 0) {
          linkedOrderId = olData[0].order_id;
          const { data: orderData } = await supabase
            .from("orders")
            .select("order_ref")
            .eq("id", olData[0].order_id)
            .single();
          linkedOrderRef = orderData?.order_ref || olData[0].order_id.slice(0, 8);
        }
      }
      inventoryItems.push({ ...inv, linked_order_ref: linkedOrderRef, linked_order_id: linkedOrderId });
    }
    setInventory(inventoryItems);

    // Find matching orders for this event - smart matching
    const { data: eventOrders } = await supabase
      .from("orders")
      .select("*, platforms(name)")
      .eq("event_id", purchaseData.event_id)
      .order("order_date", { ascending: false });

    // Get order_lines counts for each order
    const orderIds = (eventOrders || []).map((o: any) => o.id);
    const { data: allOrderLines } = orderIds.length > 0
      ? await supabase.from("order_lines").select("order_id").in("order_id", orderIds)
      : { data: [] };

    const linkedCounts = new Map<string, number>();
    for (const ol of allOrderLines || []) {
      linkedCounts.set(ol.order_id, (linkedCounts.get(ol.order_id) || 0) + 1);
    }

    const matched: MatchingOrder[] = (eventOrders || []).map((o: any) => {
      const linkedCount = linkedCounts.get(o.id) || 0;
      const needed = o.quantity - linkedCount;
      let score = 0;
      const reasons: string[] = [];

      // Category match
      if (o.category.toLowerCase() === purchaseData.category.toLowerCase()) {
        score += 3;
        reasons.push("Category match");
      }

      // Needs tickets
      if (needed > 0) {
        score += 2;
        reasons.push(`Needs ${needed} ticket${needed !== 1 ? "s" : ""}`);
      }

      // Section match (if both have sections)
      if (purchaseData.section && o.category.toLowerCase().includes(purchaseData.section.toLowerCase())) {
        score += 1;
        reasons.push("Section match");
      }

      return {
        ...o,
        linked_count: linkedCount,
        needed,
        match_score: score,
        match_reasons: reasons,
      };
    });

    // Sort by score (best matches first), then by needed tickets
    matched.sort((a, b) => {
      if (b.match_score !== a.match_score) return b.match_score - a.match_score;
      return b.needed - a.needed;
    });

    setMatchingOrders(matched);
  }, [purchaseId]);

  useEffect(() => {
    if (purchaseId) load();
  }, [purchaseId, load]);

  const handleAllocate = async (orderId: string, needed: number) => {
    if (!purchase) return;
    setAllocating(orderId);
    try {
      let available = inventory.filter((i) => i.status === "available");

      // Auto-create inventory if none exists
      if (available.length === 0 && purchase.quantity > 0) {
        const ticketsToCreate = Array.from({ length: purchase.quantity }, () => ({
          purchase_id: purchase.id,
          event_id: purchase.event_id,
          category: purchase.category,
          section: purchase.section,
          status: "available" as const,
        }));
        const { data: newInv, error: createErr } = await supabase
          .from("inventory")
          .insert(ticketsToCreate)
          .select("id, status, category, section, row_name, seat");
        if (createErr) throw createErr;
        available = (newInv || []).map((i) => ({ ...i, linked_order_ref: null, linked_order_id: null }));
      }

      const toAllocate = available.slice(0, needed);
      if (toAllocate.length === 0) {
        toast.error("No available tickets to allocate");
        return;
      }

      // Create order_lines
      const lines = toAllocate.map((inv) => ({
        order_id: orderId,
        inventory_id: inv.id,
      }));
      const { error: lineError } = await supabase.from("order_lines").insert(lines);
      if (lineError) throw lineError;

      // Update inventory status to sold
      const { error: invError } = await supabase
        .from("inventory")
        .update({ status: "sold" as any })
        .in("id", toAllocate.map((i) => i.id));
      if (invError) throw invError;

      setJustAssigned(orderId);
      toast.success(`✅ ${toAllocate.length} ticket${toAllocate.length !== 1 ? "s" : ""} assigned`);
      setTimeout(() => setJustAssigned(null), 2000);
      load();
      onUpdated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAllocating(null);
    }
  };

  const togglePaid = async () => {
    if (!purchase) return;
    const { error } = await supabase.from("purchases").update({ supplier_paid: !purchase.supplier_paid }).eq("id", purchase.id);
    if (error) { toast.error(error.message); return; }
    setPurchase({ ...purchase, supplier_paid: !purchase.supplier_paid });
    toast.success(purchase.supplier_paid ? "Marked as unpaid" : "Marked as paid");
    onUpdated();
  };

  if (!purchase) return null;

  const availableCount = inventory.filter((i) => i.status === "available").length;
  const soldCount = inventory.filter((i) => i.status === "sold").length;

  // Parse notes for supplier info
  const notesParts = (purchase.notes || "").split(" | ").filter(Boolean);

  return (
    <Sheet open={!!purchaseId} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              Purchase from {purchase.suppliers?.name || "Unknown"}
              <Badge variant="outline">{purchase.status}</Badge>
            </SheetTitle>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete purchase?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this purchase and any linked inventory. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Purchase Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Event</p>
              <p className="font-medium">{purchase.events?.match_code} — {purchase.events?.home_team} vs {purchase.events?.away_team}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Order ID</p>
              <p className="font-medium">{purchase.supplier_order_id || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Category</p>
              <p className="font-medium">{purchase.category}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Quantity</p>
              <p className="font-medium">{purchase.quantity}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cost/Ticket</p>
              <p className="font-medium">£{Number(purchase.unit_cost).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Cost</p>
              <p className="font-medium">£{Number(purchase.total_cost).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Supplier Paid</p>
              <Switch checked={purchase.supplier_paid} onCheckedChange={togglePaid} />
            </div>
          </div>

          {/* Extra info from notes */}
          {notesParts.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1 text-sm">
                {notesParts.map((part, i) => (
                  <p key={i} className="text-muted-foreground">{part}</p>
                ))}
              </div>
            </>
          )}

          <Separator />

          {/* Allocation Status - clear visual */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" /> Ticket Allocation
            </h3>
            {(() => {
              const totalTickets = purchase.quantity;
              const allocated = soldCount;
              const remaining = totalTickets - allocated;
              const fullyAllocated = remaining === 0 && totalTickets > 0;

              return (
                <div className="space-y-3">
                  {/* Summary bar */}
                  <div className={`rounded-lg border p-4 ${fullyAllocated ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/5"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-semibold ${fullyAllocated ? "text-success" : "text-warning"}`}>
                        {fullyAllocated ? "✅ Fully Allocated" : `⚠️ ${remaining} of ${totalTickets} ticket${remaining !== 1 ? "s" : ""} unallocated`}
                      </span>
                      <span className="text-xs text-muted-foreground">{allocated}/{totalTickets} assigned</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${fullyAllocated ? "bg-success" : "bg-warning"}`}
                        style={{ width: `${totalTickets > 0 ? (allocated / totalTickets) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Individual ticket status */}
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: totalTickets }, (_, i) => {
                      const inv = inventory[i];
                      const isSold = inv?.status === "sold";
                      return (
                        <div
                          key={i}
                          className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-colors ${
                            isSold
                              ? "bg-success/20 text-success border border-success/30"
                              : "bg-destructive/10 text-destructive border border-destructive/20"
                          }`}
                          title={isSold ? `Ticket ${i + 1}: Assigned` : `Ticket ${i + 1}: Unassigned`}
                        >
                          {isSold ? "✓" : (i + 1)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          <Separator />

          {/* All Orders for this Game */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Orders for this Game
            </h3>
            {availableCount > 0 && (
              <p className="text-xs text-muted-foreground mb-3">
                {availableCount} ticket{availableCount !== 1 ? "s" : ""} available to assign. Tick the box to assign.
              </p>
            )}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Linked</TableHead>
                    <TableHead className="w-[60px] text-center">Assign</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchingOrders.map((o) => {
                    const fullyLinked = o.needed <= 0;
                    const wasJustAssigned = justAssigned === o.id;
                    return (
                      <TableRow
                        key={o.id}
                        className={`transition-colors duration-500 ${
                          wasJustAssigned ? "bg-success/20" : fullyLinked ? "bg-success/5" : ""
                        }`}
                      >
                        <TableCell className="font-medium text-sm">{o.order_ref || o.id.slice(0, 8)}</TableCell>
                        <TableCell className="text-sm">{o.platforms?.name || "—"}</TableCell>
                        <TableCell className="text-sm">{o.category}</TableCell>
                        <TableCell className="text-right text-sm">{o.quantity}</TableCell>
                        <TableCell className="text-right text-sm">
                          {o.linked_count}/{o.quantity}
                          {fullyLinked && <CheckCircle2 className="inline ml-1 h-3.5 w-3.5 text-success" />}
                        </TableCell>
                        <TableCell className="text-center">
                          {fullyLinked || wasJustAssigned ? (
                            <CheckCircle2 className={`h-4 w-4 text-success mx-auto ${wasJustAssigned ? "animate-scale-in" : ""}`} />
                          ) : (
                            <Checkbox
                              disabled={allocating === o.id}
                              onCheckedChange={(checked) => {
                                if (checked) handleAllocate(o.id, o.needed);
                              }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {matchingOrders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No orders for this event yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
