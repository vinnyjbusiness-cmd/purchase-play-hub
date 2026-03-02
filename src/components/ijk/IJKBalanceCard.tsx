import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GameBalance {
  eventId: string;
  matchName: string;
  eventDate: string;
  ijkShare: number;
  status: "pending" | "balance_added" | "settled";
}

interface Props {
  gameBalances: GameBalance[];
  totalPayments: number; // total paid to IJK so far
  onRecordPayment: () => void;
}

export default function IJKBalanceCard({ gameBalances, totalPayments, onRecordPayment }: Props) {
  const totalUnsettled = gameBalances
    .filter(g => g.status !== "settled")
    .reduce((s, g) => s + g.ijkShare, 0);

  const netBalance = totalUnsettled - totalPayments;
  const oweIJK = netBalance > 0;

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">IJK Running Balance</CardTitle>
          </div>
          <Button size="sm" onClick={onRecordPayment}>
            Record Payment
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-2">
          <p className={cn(
            "text-3xl sm:text-4xl font-extrabold font-mono tracking-tight",
            oweIJK ? "text-destructive" : "text-success"
          )}>
            £{Math.abs(netBalance).toFixed(2)}
          </p>
          <p className={cn(
            "text-sm font-semibold mt-1",
            oweIJK ? "text-destructive" : "text-success"
          )}>
            {Math.abs(netBalance) < 0.01
              ? "All settled ✓"
              : oweIJK
                ? "You owe IJK"
                : "IJK owe you"}
          </p>
        </div>

        {gameBalances.filter(g => g.status !== "settled").length > 0 && (
          <div className="space-y-1.5 border-t pt-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Unsettled Games</p>
            {gameBalances
              .filter(g => g.status !== "settled")
              .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
              .map(g => (
                <div key={g.eventId} className="flex items-center justify-between text-sm py-1 px-2 rounded-md hover:bg-muted/50">
                  <span className="truncate mr-2">{g.matchName}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold">£{g.ijkShare.toFixed(2)}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        g.status === "balance_added" && "border-warning text-warning",
                        g.status === "pending" && "border-destructive text-destructive"
                      )}
                    >
                      {g.status === "balance_added" ? "Balance Added" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        )}

        {totalPayments > 0 && (
          <div className="border-t pt-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Payments Made</span>
            <span className="font-mono font-semibold text-success">£{totalPayments.toFixed(2)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
