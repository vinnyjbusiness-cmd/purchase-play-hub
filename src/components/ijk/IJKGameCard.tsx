import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Clock, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface IJKTicket {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  section: string | null;
  block: string | null;
  rowName: string | null;
  seat: string | null;
  faceValue: number;
  salePrice: number;
  status: string;
  isBanned: boolean;
  // Order allocation details
  orderId?: string | null;
  orderRef?: string | null;
  buyerName?: string | null;
  platformName?: string | null;
  orderTotal?: number | null;
  orderFees?: number | null;
  orderQty?: number | null;
}

export interface IJKReplacement {
  id: string;
  bannedInventoryId: string;
  replacementInventoryId: string | null;
  replacementCost: number;
  originalCost: number;
}

export interface IJKGameData {
  eventId: string;
  matchName: string;
  eventDate: string;
  tickets: IJKTicket[];
  replacements: IJKReplacement[];
  settlementStatus: "pending" | "balance_added" | "settled";
  settlementId: string | null;
}

const GRADIENTS = [
  "from-rose-600 to-orange-500",
  "from-violet-600 to-indigo-500",
  "from-emerald-600 to-teal-500",
  "from-blue-600 to-cyan-500",
  "from-amber-600 to-yellow-500",
  "from-fuchsia-600 to-pink-500",
];

const statusPill = {
  settled: { label: "Settled", className: "bg-success/15 text-success border-success/30" },
  balance_added: { label: "Balance Added", className: "bg-warning/15 text-warning border-warning/30" },
  pending: { label: "Pending", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

interface Props {
  game: IJKGameData;
  index: number;
  orgId: string | null;
  onRefresh: () => void;
}

export default function IJKGameCard({ game, index, orgId, onRefresh }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [bannedOpen, setBannedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const gradient = GRADIENTS[index % GRADIENTS.length];
  const pill = statusPill[game.settlementStatus];

  const totalCost = game.tickets.reduce((s, t) => s + t.faceValue, 0);
  const totalRevenue = game.tickets.filter(t => t.status === "sold").reduce((s, t) => s + t.salePrice, 0);
  const replacementExtra = game.replacements.reduce((s, r) => s + Math.max(0, r.replacementCost - r.originalCost), 0);
  const netProfit = totalRevenue - totalCost - replacementExtra;
  const ijkShare = netProfit / 2;
  const vinnyShare = netProfit - ijkShare;

  const soldCount = game.tickets.filter(t => t.status === "sold").length;
  const bannedTickets = game.tickets.filter(t => t.isBanned);
  const selectedTicket = selectedTicketId ? game.tickets.find(t => t.id === selectedTicketId) : null;

  const handleSettle = async (status: "balance_added" | "settled") => {
    setSaving(true);
    if (game.settlementId) {
      await supabase.from("ijk_settlements" as any).update({
        status,
        ijk_share: ijkShare,
        vinny_share: vinnyShare,
        settled_at: status === "settled" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      } as any).eq("id", game.settlementId);
    } else {
      await supabase.from("ijk_settlements" as any).insert({
        event_id: game.eventId,
        org_id: orgId,
        status,
        ijk_share: ijkShare,
        vinny_share: vinnyShare,
        settled_at: status === "settled" ? new Date().toISOString() : null,
      } as any);
    }
    toast.success(status === "settled" ? "Marked as Paid" : "Added to Balance");
    setSaving(false);
    onRefresh();
  };

  return (
    <Card className="overflow-hidden">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left focus:outline-none">
            <div className={cn("bg-gradient-to-r text-white p-4 sm:p-5", gradient)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {expanded ? <ChevronDown className="h-5 w-5 shrink-0" /> : <ChevronRight className="h-5 w-5 shrink-0" />}
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold truncate">{game.matchName}</h3>
                    <p className="text-white/80 text-xs sm:text-sm">
                      {game.eventDate ? format(new Date(game.eventDate), "EEE dd MMM yyyy, HH:mm") : "TBC"}
                    </p>
                  </div>
                </div>
                <Badge className={cn("shrink-0 text-[10px] font-semibold", pill.className)}>
                  {pill.label}
                </Badge>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 text-center">
                <StatBlock label="Tickets" value={String(game.tickets.length)} />
                <StatBlock label="Sold" value={String(soldCount)} />
                <StatBlock label="Cost" value={`£${totalCost.toFixed(0)}`} />
                <StatBlock label="Revenue" value={`£${totalRevenue.toFixed(0)}`} />
                <StatBlock label="Profit" value={`£${netProfit.toFixed(0)}`} negative={netProfit < 0} />
                <StatBlock label="IJK Split" value={`£${ijkShare.toFixed(0)}`} negative={ijkShare < 0} />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-4 sm:p-6 space-y-6">
            {/* Tickets Table */}
            <section>
              <h4 className="font-semibold text-sm mb-3 uppercase tracking-wider text-muted-foreground">Tickets</h4>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Seat</TableHead>
                      <TableHead className="text-right">Face Value</TableHead>
                      <TableHead className="text-right">Sale Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Allocated To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {game.tickets.map(t => (
                      <TableRow
                        key={t.id}
                        className={cn(
                          "cursor-pointer transition-colors",
                          t.isBanned && "bg-destructive/5",
                          selectedTicketId === t.id && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                        )}
                        onClick={() => setSelectedTicketId(selectedTicketId === t.id ? null : t.id)}
                      >
                        <TableCell className="text-sm font-medium">
                          {[t.firstName, t.lastName].filter(Boolean).join(" ") || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {[t.section, t.block, t.rowName].filter(Boolean).join(" / ") || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{t.seat || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">£{t.faceValue.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {t.status === "sold" ? `£${t.salePrice.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              t.isBanned && "border-destructive text-destructive",
                              t.status === "sold" && "border-success text-success",
                              t.status === "available" && "border-primary text-primary",
                            )}
                          >
                            {t.isBanned ? "Banned" : t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {t.orderId ? (
                            <span className="text-muted-foreground">
                              {t.platformName || t.buyerName || "Order"}
                              {t.orderRef && <span className="text-[10px] ml-1 font-mono">#{t.orderRef}</span>}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Ticket detail panel */}
              {selectedTicket && (
                <div className="mt-3 rounded-lg border bg-muted/20 p-4 animate-fade-in">
                  <div className="flex items-start justify-between mb-3">
                    <h5 className="font-semibold text-sm">
                      Ticket: {[selectedTicket.firstName, selectedTicket.lastName].filter(Boolean).join(" ")} — Seat {selectedTicket.seat || "?"}
                    </h5>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedTicketId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Account</p>
                      <p className="font-medium truncate">{selectedTicket.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Section / Block / Row</p>
                      <p className="font-medium">{[selectedTicket.section, selectedTicket.block, selectedTicket.rowName].filter(Boolean).join(" / ") || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Face Value</p>
                      <p className="font-mono font-semibold">£{selectedTicket.faceValue.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        selectedTicket.isBanned && "border-destructive text-destructive",
                        selectedTicket.status === "sold" && "border-success text-success",
                      )}>
                        {selectedTicket.isBanned ? "Banned" : selectedTicket.status}
                      </Badge>
                    </div>
                  </div>

                  {selectedTicket.orderId && (
                    <div className="mt-4 pt-3 border-t">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Order Allocation</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Platform / Buyer</p>
                          <p className="font-medium">{selectedTicket.platformName || selectedTicket.buyerName || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Order Ref</p>
                          <p className="font-mono">{selectedTicket.orderRef || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Order Total</p>
                          <p className="font-mono font-semibold">£{(selectedTicket.orderTotal || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Fees</p>
                          <p className="font-mono">£{(selectedTicket.orderFees || 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="mt-3 bg-muted/40 rounded-lg p-3 font-mono text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>Sale per ticket</span>
                          <span>£{selectedTicket.salePrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>minus Face value</span>
                          <span>-£{selectedTicket.faceValue.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-dashed border-muted-foreground/30 my-1" />
                        <div className="flex justify-between font-bold">
                          <span>Ticket profit</span>
                          <span className={cn(
                            (selectedTicket.salePrice - selectedTicket.faceValue) >= 0 ? "text-success" : "text-destructive"
                          )}>
                            £{(selectedTicket.salePrice - selectedTicket.faceValue).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground text-xs">
                          <span>IJK 50%</span>
                          <span>£{((selectedTicket.salePrice - selectedTicket.faceValue) / 2).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!selectedTicket.orderId && selectedTicket.status !== "cancelled" && (
                    <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                      This ticket hasn't been allocated to an order yet.
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Banned & Replacement Tracker */}
            {bannedTickets.length > 0 && (
              <Collapsible open={bannedOpen} onOpenChange={setBannedOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 text-destructive border-destructive/30">
                    <AlertTriangle className="h-4 w-4" />
                    Banned & Replaced ({bannedTickets.length})
                    {bannedOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Banned Ticket</TableHead>
                          <TableHead>Original Cost</TableHead>
                          <TableHead>Replacement Cost</TableHead>
                          <TableHead>Extra Loss</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bannedTickets.map(bt => {
                          const rep = game.replacements.find(r => r.bannedInventoryId === bt.id);
                          return (
                            <TableRow key={bt.id}>
                              <TableCell className="text-sm">
                                {[bt.firstName, bt.lastName].filter(Boolean).join(" ")} — Seat {bt.seat || "?"}
                              </TableCell>
                              <TableCell className="font-mono text-sm">£{bt.faceValue.toFixed(2)}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {rep ? `£${rep.replacementCost.toFixed(2)}` : <span className="text-muted-foreground">Not replaced</span>}
                              </TableCell>
                              <TableCell className="font-mono text-sm text-destructive font-semibold">
                                {rep ? `£${Math.max(0, rep.replacementCost - rep.originalCost).toFixed(2)}` : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* P&L Breakdown */}
            <section>
              <h4 className="font-semibold text-sm mb-3 uppercase tracking-wider text-muted-foreground">Profit & Loss Breakdown</h4>
              <div className="bg-muted/30 rounded-xl p-4 sm:p-6 font-mono text-sm space-y-1.5">
                <PLRow label="Total Revenue" value={totalRevenue} />
                <PLRow label="minus Total Cost (face value)" value={-totalCost} />
                {replacementExtra > 0 && (
                  <PLRow label="minus Replacement Extra Costs" value={-replacementExtra} />
                )}
                <div className="border-t border-dashed border-muted-foreground/30 my-2" />
                <PLRow label="Net Profit" value={netProfit} bold highlight />
                <p className="text-muted-foreground text-xs pt-1">÷ 2 (50/50 split)</p>
                <div className="border-t border-dashed border-muted-foreground/30 my-2" />
                <PLRow label="IJK Share" value={ijkShare} bold highlight />
                <PLRow label="Vinny Share" value={vinnyShare} bold highlight />
              </div>
            </section>

            {/* Settlement Section */}
            <section>
              <h4 className="font-semibold text-sm mb-3 uppercase tracking-wider text-muted-foreground">Settlement</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                {game.settlementStatus !== "settled" && (
                  <>
                    <Button
                      variant="outline"
                      className="border-warning text-warning hover:bg-warning/10"
                      onClick={() => handleSettle("balance_added")}
                      disabled={saving || game.settlementStatus === "balance_added"}
                    >
                      <Clock className="h-4 w-4 mr-1" />
                      {game.settlementStatus === "balance_added" ? "Already on Balance" : "Add to Balance"}
                    </Button>
                    <Button
                      className="bg-success hover:bg-success/90 text-white"
                      onClick={() => handleSettle("settled")}
                      disabled={saving}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Mark as Paid
                    </Button>
                  </>
                )}
                {game.settlementStatus === "settled" && (
                  <div className="flex items-center gap-2 text-success text-sm font-semibold">
                    <CheckCircle2 className="h-5 w-5" />
                    Settled
                  </div>
                )}
              </div>
            </section>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function StatBlock({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div>
      <p className="text-[10px] sm:text-xs uppercase tracking-wider text-white/70">{label}</p>
      <p className={cn("text-sm sm:text-lg font-bold", negative && "text-destructive/80")}>{value}</p>
    </div>
  );
}

function PLRow({ label, value, bold, highlight }: { label: string; value: number; bold?: boolean; highlight?: boolean }) {
  const isNeg = value < 0;
  return (
    <div className={cn("flex justify-between", bold && "font-bold text-base")}>
      <span>{label}</span>
      <span className={cn(
        highlight && (isNeg ? "text-destructive" : "text-success")
      )}>
        {isNeg ? "-" : ""}£{Math.abs(value).toFixed(2)}
      </span>
    </div>
  );
}
