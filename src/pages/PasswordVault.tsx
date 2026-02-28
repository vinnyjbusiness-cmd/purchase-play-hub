import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { KeyRound, Plus, Eye, EyeOff, Copy, MoreVertical, Pencil, Trash2, Settings, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

/* ── colour palette for cards ── */
const CARD_COLORS = [
  { bg: "from-primary/80 to-primary/40", icon: "hsl(var(--primary))" },
  { bg: "from-emerald-600/80 to-emerald-400/40", icon: "#059669" },
  { bg: "from-violet-600/80 to-violet-400/40", icon: "#7c3aed" },
  { bg: "from-amber-600/80 to-amber-400/40", icon: "#d97706" },
  { bg: "from-rose-600/80 to-rose-400/40", icon: "#e11d48" },
  { bg: "from-cyan-600/80 to-cyan-400/40", icon: "#0891b2" },
];

const SESSION_KEY = "vjx_vault_unlocked";
const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 min

type VaultEntry = {
  id: string;
  org_id: string;
  site_name: string;
  url: string | null;
  username: string;
  password: string;
  icon_color: string;
  created_at: string;
  updated_at: string;
};

export default function PasswordVault() {
  const { orgId } = useOrg();

  /* ── PIN state ── */
  const [unlocked, setUnlocked] = useState(false);
  const [vaultPin, setVaultPin] = useState<string | null>(null); // null = not loaded, "" = no pin set
  const [pinInput, setPinInput] = useState("");
  const [pinLoading, setPinLoading] = useState(true);
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [confirmPin, setConfirmPin] = useState("");
  const [changePinOpen, setChangePinOpen] = useState(false);

  /* ── vault data ── */
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  /* ── add/edit modal ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VaultEntry | null>(null);
  const [form, setForm] = useState({ site_name: "", url: "", username: "", password: "" });

  /* ── auto-lock ── */
  const lastActivity = useRef(Date.now());

  const lock = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setUnlocked(false);
    setPinInput("");
    setVisiblePasswords(new Set());
  }, []);

  useEffect(() => {
    const bump = () => { lastActivity.current = Date.now(); };
    window.addEventListener("click", bump);
    window.addEventListener("keydown", bump);
    window.addEventListener("mousemove", bump);

    const timer = setInterval(() => {
      if (unlocked && Date.now() - lastActivity.current > LOCK_TIMEOUT) lock();
    }, 30_000);

    return () => {
      window.removeEventListener("click", bump);
      window.removeEventListener("keydown", bump);
      window.removeEventListener("mousemove", bump);
      clearInterval(timer);
    };
  }, [unlocked, lock]);

  /* ── check session on mount ── */
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      const ts = parseInt(stored, 10);
      if (Date.now() - ts < LOCK_TIMEOUT) {
        setUnlocked(true);
        lastActivity.current = Date.now();
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  /* ── fetch vault pin ── */
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setPinLoading(true);
      const { data } = await supabase
        .from("vault_settings")
        .select("vault_pin")
        .eq("org_id", orgId)
        .maybeSingle();
      setVaultPin(data?.vault_pin ?? "");
      setPinLoading(false);
    })();
  }, [orgId]);

  /* ── fetch entries when unlocked ── */
  useEffect(() => {
    if (!unlocked || !orgId) return;
    fetchEntries();
  }, [unlocked, orgId]);

  const fetchEntries = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("password_vault")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load vault");
    else setEntries((data as VaultEntry[]) || []);
    setLoading(false);
  };

  /* ── PIN handlers ── */
  const handleUnlock = (value: string) => {
    setPinInput(value);
    if (value.length === 4) {
      if (value === vaultPin) {
        sessionStorage.setItem(SESSION_KEY, String(Date.now()));
        setUnlocked(true);
        lastActivity.current = Date.now();
      } else {
        toast.error("Incorrect PIN");
        setTimeout(() => setPinInput(""), 300);
      }
    }
  };

  const handleSetPin = async () => {
    if (pinInput.length !== 4) return;
    if (!isSettingPin) {
      setIsSettingPin(true);
      setConfirmPin(pinInput);
      setPinInput("");
      return;
    }
    if (pinInput !== confirmPin) {
      toast.error("PINs do not match");
      setIsSettingPin(false);
      setConfirmPin("");
      setPinInput("");
      return;
    }
    const { error } = await supabase.from("vault_settings").upsert({ org_id: orgId!, vault_pin: pinInput }, { onConflict: "org_id" });
    if (error) { toast.error("Failed to set PIN"); return; }
    setVaultPin(pinInput);
    sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    setUnlocked(true);
    lastActivity.current = Date.now();
    setIsSettingPin(false);
    setConfirmPin("");
    toast.success("Vault PIN set");
  };

  const handleChangePin = async (newPin: string) => {
    if (newPin.length !== 4) return;
    const { error } = await supabase.from("vault_settings").upsert({ org_id: orgId!, vault_pin: newPin }, { onConflict: "org_id" });
    if (error) { toast.error("Failed to update PIN"); return; }
    setVaultPin(newPin);
    setChangePinOpen(false);
    toast.success("Vault PIN updated");
  };

  /* ── CRUD ── */
  const openAdd = () => {
    setEditingEntry(null);
    setForm({ site_name: "", url: "", username: "", password: "" });
    setModalOpen(true);
  };

  const openEdit = (entry: VaultEntry) => {
    setEditingEntry(entry);
    setForm({ site_name: entry.site_name, url: entry.url || "", username: entry.username, password: entry.password });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.site_name.trim() || !form.username.trim() || !form.password.trim()) {
      toast.error("Site name, username and password are required");
      return;
    }
    const color = CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)].icon;
    if (editingEntry) {
      const { error } = await supabase.from("password_vault").update({
        site_name: form.site_name.trim(),
        url: form.url.trim() || null,
        username: form.username.trim(),
        password: form.password,
      }).eq("id", editingEntry.id);
      if (error) { toast.error("Failed to update"); return; }
      toast.success("Updated");
    } else {
      const { error } = await supabase.from("password_vault").insert({
        org_id: orgId!,
        site_name: form.site_name.trim(),
        url: form.url.trim() || null,
        username: form.username.trim(),
        password: form.password,
        icon_color: color,
      });
      if (error) { toast.error("Failed to save"); return; }
      toast.success("Password saved");
    }
    setModalOpen(false);
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("password_vault").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Deleted");
    fetchEntries();
  };

  const copyPassword = (pw: string) => {
    navigator.clipboard.writeText(pw);
    toast.success("Password copied");
  };

  const toggleVisible = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getInitials = (name: string) => {
    const words = name.split(/\s+/);
    return words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  /* ── PIN loading ── */
  if (pinLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  /* ── PIN screen ── */
  if (!unlocked) {
    const needsSetup = vaultPin === "";
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold">
            {needsSetup ? "Set Up Vault PIN" : "Password Vault"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {needsSetup
              ? (isSettingPin ? "Confirm your 4-digit PIN" : "Create a 4-digit PIN to protect your vault")
              : "Enter your 4-digit PIN to unlock"}
          </p>
        </div>
        <InputOTP maxLength={4} value={pinInput} onChange={needsSetup ? (v) => setPinInput(v) : handleUnlock}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
          </InputOTPGroup>
        </InputOTP>
        {needsSetup && pinInput.length === 4 && (
          <Button onClick={handleSetPin} className="min-w-[160px]">
            {isSettingPin ? "Confirm PIN" : "Set PIN"}
          </Button>
        )}
      </div>
    );
  }

  /* ── Unlocked view ── */
  return (
    <div className="space-y-6 p-2 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold md:text-2xl">Password Vault</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setChangePinOpen(true)} title="Change Vault PIN">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={lock} title="Lock Vault">
            <Lock className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-1 h-4 w-4" /> Add New
          </Button>
        </div>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
          <KeyRound className="h-12 w-12 opacity-30" />
          <p>No saved passwords yet</p>
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus className="mr-1 h-4 w-4" /> Add your first password
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, idx) => {
            const color = CARD_COLORS[idx % CARD_COLORS.length];
            const isVisible = visiblePasswords.has(entry.id);
            return (
              <div
                key={entry.id}
                className={cn(
                  "relative rounded-xl bg-gradient-to-br p-4 shadow-lg",
                  color.bg
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Initials circle */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: entry.icon_color || color.icon }}
                  >
                    {getInitials(entry.site_name)}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white truncate">{entry.site_name}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(entry)}>
                            <Pencil className="mr-2 h-3 w-3" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(entry.id)}>
                            <Trash2 className="mr-2 h-3 w-3" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <p className="text-xs text-white/70 truncate">{entry.username}</p>
                    {entry.url && (
                      <p className="text-xs text-white/50 truncate">{entry.url}</p>
                    )}

                    {/* Password row */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-mono text-sm text-white/90 truncate">
                        {isVisible ? entry.password : "••••••••"}
                      </span>
                      <button onClick={() => toggleVisible(entry.id)} className="rounded p-1 text-white/60 hover:text-white">
                        {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => copyPassword(entry.password)} className="rounded p-1 text-white/60 hover:text-white">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit Password" : "Add New Password"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Site Name *</Label>
              <Input value={form.site_name} onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))} placeholder="e.g. Google" />
            </div>
            <div>
              <Label>URL</Label>
              <Input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <Label>Username *</Label>
              <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="email or username" />
            </div>
            <div>
              <Label>Password *</Label>
              <Input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
            </div>
            <Button className="w-full" onClick={handleSave}>
              {editingEntry ? "Save Changes" : "Add Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change PIN Modal */}
      <ChangePinModal open={changePinOpen} onOpenChange={setChangePinOpen} onSave={handleChangePin} />
    </div>
  );
}

/* ── Change PIN sub-component ── */
function ChangePinModal({ open, onOpenChange, onSave }: { open: boolean; onOpenChange: (o: boolean) => void; onSave: (pin: string) => void }) {
  const [pin, setPin] = useState("");

  useEffect(() => { if (open) setPin(""); }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Change Vault PIN</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <InputOTP maxLength={4} value={pin} onChange={setPin}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
            </InputOTPGroup>
          </InputOTP>
          <Button disabled={pin.length !== 4} onClick={() => onSave(pin)} className="w-full">
            Update PIN
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
