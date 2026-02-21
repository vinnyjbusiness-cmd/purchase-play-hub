import { useState, useEffect } from "react";
import { useOrg } from "@/hooks/useOrg";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Settings, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const SESSION_KEY = "vjx_finance_unlocked";

export function useFinanceLock() {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const val = sessionStorage.getItem(SESSION_KEY);
    if (val === "true") setUnlocked(true);
  }, []);

  const unlock = () => {
    sessionStorage.setItem(SESSION_KEY, "true");
    setUnlocked(true);
  };

  const lock = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
  };

  return { unlocked, unlock, lock };
}

export function FinancePinGate({ children }: { children: React.ReactNode }) {
  const { orgId, userRole } = useOrg();
  const { unlocked, unlock } = useFinanceLock();
  const [pin, setPin] = useState("");
  const [storedPin, setStoredPin] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("organizations")
      .select("finance_pin")
      .eq("id", orgId)
      .single()
      .then(({ data }) => {
        setStoredPin((data as any)?.finance_pin || null);
      });
  }, [orgId]);

  // If no PIN is set, allow access (admin should set one)
  if (storedPin === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!storedPin) {
    // No PIN set — if admin, prompt to set one; if viewer, block
    if (userRole === "admin") {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="rounded-xl border bg-card p-8 max-w-sm w-full text-center space-y-4">
            <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Set Finance PIN</h2>
            <p className="text-sm text-muted-foreground">Set a PIN to protect Finance, Cashflow, and Analytics pages.</p>
            <SetPinForm orgId={orgId!} onSet={(p) => { setStoredPin(p); unlock(); }} />
          </div>
        </div>
      );
    }
    // Viewer with no PIN set — just show content (admin hasn't locked it yet)
    return <>{children}</>;
  }

  if (unlocked) return <>{children}</>;

  // PIN gate
  const handleUnlock = () => {
    setLoading(true);
    if (pin === storedPin) {
      unlock();
      toast.success("Finance unlocked");
    } else {
      toast.error("Incorrect PIN");
    }
    setPin("");
    setLoading(false);
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="rounded-xl border bg-card p-8 max-w-sm w-full text-center space-y-4">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Finance Locked</h2>
        <p className="text-sm text-muted-foreground">Enter the PIN to access financial data</p>
        <div className="relative">
          <Input
            type={showPin ? "text" : "password"}
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && pin.length >= 4 && handleUnlock()}
            className="text-center text-2xl tracking-[0.5em] pr-10"
            maxLength={6}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Button onClick={handleUnlock} disabled={pin.length < 4 || loading} className="w-full">
          Unlock
        </Button>
      </div>
    </div>
  );
}

function SetPinForm({ orgId, onSet }: { orgId: string; onSet: (pin: string) => void }) {
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSet = async () => {
    if (newPin.length < 4) { toast.error("PIN must be at least 4 digits"); return; }
    if (newPin !== confirm) { toast.error("PINs don't match"); return; }
    setLoading(true);
    const { error } = await supabase
      .from("organizations")
      .update({ finance_pin: newPin } as any)
      .eq("id", orgId);
    setLoading(false);
    if (error) { toast.error("Failed to set PIN"); return; }
    toast.success("Finance PIN set!");
    onSet(newPin);
  };

  return (
    <div className="space-y-3">
      <Input
        type="password"
        placeholder="New PIN (4-6 digits)"
        value={newPin}
        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="text-center text-xl tracking-[0.5em]"
        maxLength={6}
      />
      <Input
        type="password"
        placeholder="Confirm PIN"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className="text-center text-xl tracking-[0.5em]"
        maxLength={6}
      />
      <Button onClick={handleSet} disabled={newPin.length < 4 || loading} className="w-full">
        Set PIN
      </Button>
    </div>
  );
}

export function ChangePinDialog() {
  const { orgId } = useOrg();
  const [open, setOpen] = useState(false);

  if (!orgId) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
          <Settings className="h-4 w-4" />
          Finance PIN
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change Finance PIN</DialogTitle>
        </DialogHeader>
        <SetPinForm orgId={orgId} onSet={() => { setOpen(false); toast.success("PIN updated"); }} />
      </DialogContent>
    </Dialog>
  );
}
