import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Circle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useOrg } from "@/hooks/useOrg";

const STAGES = [
  "Order Created",
  "Waiting on Delivery",
  "Customer Contacted",
  "Delivered",
  "Completed",
];

interface Props {
  orderId: string;
}

interface StageEntry {
  stage: string;
  reached_at: string;
}

export default function OrderMiniTimeline({ orderId }: Props) {
  const { orgId } = useOrg();
  const [history, setHistory] = useState<StageEntry[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("order_status_history")
      .select("stage, reached_at")
      .eq("order_id", orderId)
      .order("reached_at", { ascending: true });
    setHistory(data || []);
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const reachedMap = new Map(history.map(h => [h.stage, h.reached_at]));

  const markStage = async (stage: string) => {
    if (reachedMap.has(stage)) return;
    const { error } = await supabase.from("order_status_history").insert({
      order_id: orderId,
      stage,
      org_id: orgId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked "${stage}"`);
    load();
  };

  // Find the highest reached index
  const highestReached = STAGES.reduce((max, stage, idx) => reachedMap.has(stage) ? idx : max, -1);

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold mb-3">Order Timeline</h3>
      <div className="relative">
        {STAGES.map((stage, idx) => {
          const reached = reachedMap.get(stage);
          const isReached = !!reached;
          const isLast = idx === STAGES.length - 1;

          return (
            <div key={stage} className="flex gap-3 relative">
              {/* Vertical line */}
              {!isLast && (
                <div
                  className={`absolute left-[11px] top-[24px] w-0.5 h-[calc(100%-8px)] ${
                    idx < highestReached ? "bg-success" : "bg-border"
                  }`}
                />
              )}

              {/* Circle */}
              <div className="relative z-10 flex-shrink-0 mt-0.5">
                {isReached ? (
                  <div className="h-6 w-6 rounded-full bg-success flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-success-foreground" />
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 hover:border-primary"
                    onClick={() => markStage(stage)}
                    title={`Mark "${stage}"`}
                  >
                    <Circle className="h-2.5 w-2.5 text-muted-foreground/40" />
                  </Button>
                )}
              </div>

              {/* Content */}
              <div className="pb-5 flex-1 min-w-0">
                <p className={`text-sm font-medium ${isReached ? "text-foreground" : "text-muted-foreground"}`}>
                  {stage}
                </p>
                {isReached && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(reached), "dd MMM yyyy, HH:mm")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
