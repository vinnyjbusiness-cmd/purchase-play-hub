import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Download } from "lucide-react";

interface GameOption {
  eventId: string;
  label: string;
  date: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  games: GameOption[];
}

export default function IJKMemberSheetDialog({ open, onOpenChange, games }: Props) {
  const [selectedGame, setSelectedGame] = useState("");
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!selectedGame) { toast.error("Select a game"); return; }
    setGenerating(true);

    // Get IJK inventory for this game
    const { data: inv } = await supabase
      .from("inventory")
      .select("first_name, last_name, email, password, supporter_id, iphone_pass_link, android_pass_link, source")
      .eq("event_id", selectedGame)
      .eq("source", "IJK");

    if (!inv || inv.length === 0) {
      toast.error("No IJK inventory found for this game");
      setGenerating(false);
      return;
    }

    // Deduplicate by email to get unique accounts
    const seen = new Set<string>();
    const allAccounts: typeof inv = [];
    for (const item of inv) {
      const key = item.email || `${item.first_name}-${item.last_name}`;
      if (!seen.has(key)) { seen.add(key); allAccounts.push(item); }
    }

    // Get members data for lead booker info
    const emails = allAccounts.map(a => a.email).filter(Boolean);
    const { data: members } = await supabase
      .from("members")
      .select("first_name, last_name, email, member_password, supporter_id, iphone_pass_link, android_pass_link")
      .in("email", emails);

    const memberMap = new Map((members || []).map(m => [m.email, m]));

    const headers = ["First Name", "Last Name", "Email", "Password", "Supporter ID", "iPhone Pass", "Android Pass"];

    // All Accounts section
    const allRows = allAccounts.map(a => {
      const m = memberMap.get(a.email || "");
      return [
        a.first_name || m?.first_name || "",
        a.last_name || m?.last_name || "",
        a.email || m?.email || "",
        a.password || m?.member_password || "",
        a.supporter_id || m?.supporter_id || "",
        a.iphone_pass_link || m?.iphone_pass_link || "",
        a.android_pass_link || m?.android_pass_link || "",
      ];
    });

    // Lead Bookers — for now take the first unique account per section group as lead
    // (In a real scenario this could be flagged in the members table)
    const leadBookers = allRows.slice(0, Math.max(1, Math.ceil(allRows.length / 4)));

    const csvEncode = (rows: string[][]) => rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");

    const csv = [
      "--- ALL ACCOUNTS ---",
      csvEncode([headers, ...allRows]),
      "",
      "--- LEAD BOOKERS ---",
      csvEncode([headers, ...leadBookers]),
    ].join("\n");

    const game = games.find(g => g.eventId === selectedGame);
    const matchName = game?.label.replace(/\s+/g, "_") || "Unknown";
    const dateStr = game?.date ? format(new Date(game.date), "yyyy-MM-dd") : "unknown";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `IJK_${matchName}_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Member sheet generated");
    setGenerating(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Member Sheet</DialogTitle>
          <DialogDescription>Export IJK member accounts for a specific game</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Game</Label>
            <Select value={selectedGame} onValueChange={setSelectedGame}>
              <SelectTrigger><SelectValue placeholder="Choose a game…" /></SelectTrigger>
              <SelectContent>
                {games.map(g => (
                  <SelectItem key={g.eventId} value={g.eventId}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={generate} disabled={generating}>
            <Download className="h-4 w-4 mr-1" />
            {generating ? "Generating…" : "Generate CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
