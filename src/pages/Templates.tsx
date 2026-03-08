import { useState, useEffect, useMemo, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Copy, Pencil, Trash2, FileText, Search, Check, Keyboard, Command, RotateCcw } from "lucide-react";
import { getShortcuts, saveShortcuts, resetShortcuts, AVAILABLE_PAGES, type Shortcut } from "@/hooks/useKeyboardShortcuts";

interface Template {
  id: string;
  org_id: string;
  name: string;
  body: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TEMPLATES: { name: string; body: string }[] = [
  {
    name: "Order Confirmed",
    body: "Hi [First Name],\n\nYour order [Order ID] for [Event Name] on [Date] has been confirmed. We'll be in touch shortly with your ticket details.\n\nThank you for your purchase!",
  },
  {
    name: "Tickets Dispatched",
    body: "Hi [First Name],\n\nGreat news! Your tickets for [Event Name] on [Date] have been dispatched.\n\nOrder reference: [Order ID]\n\nPlease check your email for the ticket details. If you have any questions, don't hesitate to reach out.",
  },
  {
    name: "Refund Issued",
    body: "Hi [First Name],\n\nWe've processed a refund for your order [Order ID]. The amount should appear in your account within 5–10 business days.\n\nWe apologise for any inconvenience.",
  },
  {
    name: "Event Cancelled",
    body: "Hi [First Name],\n\nUnfortunately, [Event Name] on [Date] has been cancelled. We're processing refunds for all affected orders.\n\nYour order [Order ID] will be refunded automatically. We'll keep you updated.",
  },
  {
    name: "Awaiting Fulfilment",
    body: "Hi [First Name],\n\nJust a quick update on your order [Order ID] for [Event Name]. We're currently sourcing your tickets and will send them through as soon as they're available.\n\nThanks for your patience!",
  },
  {
    name: "Order Issue",
    body: "Hi [First Name],\n\nWe've encountered an issue with your order [Order ID] for [Event Name] on [Date]. Our team is looking into it and we'll be in touch shortly with an update.\n\nApologies for any inconvenience.",
  },
];

const PLACEHOLDER_REGEX = /\[([^\]]+)\]/g;

function HighlightedBody({ text, maxLines }: { text: string; maxLines?: number }) {
  const lines = text.split("\n");
  const display = maxLines ? lines.slice(0, maxLines).join("\n") + (lines.length > maxLines ? "…" : "") : text;
  const parts = display.split(PLACEHOLDER_REGEX);
  return (
    <span className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Badge key={i} variant="secondary" className="text-xs font-mono px-1.5 py-0 mx-0.5 align-baseline">
            [{part}]
          </Badge>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </span>
  );
}

function ShortcutsPanel() {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(getShortcuts());
  const isMac = navigator.platform?.toLowerCase().includes("mac");
  const modKey = isMac ? "⌘" : "Ctrl";

  const updateShortcut = (key: string, field: "label" | "target", value: string) => {
    const updated = shortcuts.map(s => {
      if (s.key !== key) return s;
      if (field === "target") {
        const page = AVAILABLE_PAGES.find(p => p.path === value);
        return { ...s, target: value, label: page?.label || s.label };
      }
      return { ...s, [field]: value };
    });
    setShortcuts(updated);
    saveShortcuts(updated);
    toast({ title: "Shortcut updated" });
  };

  const handleReset = () => {
    const defaults = resetShortcuts();
    setShortcuts(defaults);
    toast({ title: "Shortcuts reset to defaults" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">{modKey}</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">number</kbd> to quickly jump to a page.
        </p>
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
          <RotateCcw className="h-3 w-3 mr-1" /> Reset
        </Button>
      </div>

      <div className="space-y-2">
        {shortcuts.map(s => (
          <div key={s.key} className="flex items-center gap-3 rounded-lg border bg-card p-3">
            {/* Key badge */}
            <div className="flex items-center gap-1 shrink-0">
              <kbd className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-muted border text-xs font-bold">
                {modKey}
              </kbd>
              <span className="text-muted-foreground text-xs">+</span>
              <kbd className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-muted border text-sm font-bold">
                {s.key}
              </kbd>
            </div>

            {/* Arrow */}
            <span className="text-muted-foreground text-xs">→</span>

            {/* Page selector */}
            <Select value={s.target} onValueChange={v => updateShortcut(s.key, "target", v)}>
              <SelectTrigger className="flex-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_PAGES.map(p => (
                  <SelectItem key={p.path} value={p.path}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Shortcuts work anywhere in the app. Change the page each key combo navigates to using the dropdowns above.
      </p>
    </div>
  );
}

export default function TemplatesPage() {
  const { orgId } = useOrg();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("message_templates")
      .select("*")
      .eq("org_id", orgId)
      .order("is_default", { ascending: false })
      .order("name");
    if (error) {
      toast({ title: "Error loading templates", description: error.message, variant: "destructive" });
    } else if (data && data.length === 0) {
      const inserts = DEFAULT_TEMPLATES.map(t => ({ ...t, org_id: orgId, is_default: true }));
      const { error: seedErr } = await supabase.from("message_templates").insert(inserts as any);
      if (!seedErr) {
        const { data: seeded } = await supabase
          .from("message_templates")
          .select("*")
          .eq("org_id", orgId)
          .order("name");
        setTemplates((seeded as Template[]) || []);
      }
    } else {
      setTemplates((data as Template[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, [orgId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(t => t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q));
  }, [templates, search]);

  const openAdd = () => { setEditingId(null); setName(""); setBody(""); setFormOpen(true); };
  const openEdit = (t: Template) => { setEditingId(t.id); setName(t.name); setBody(t.body); setFormOpen(true); };

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) {
      toast({ title: "Name and body are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    if (editingId) {
      const { error } = await supabase.from("message_templates").update({ name, body, updated_at: new Date().toISOString() }).eq("id", editingId);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Template updated" });
    } else {
      const { error } = await supabase.from("message_templates").insert({ name, body, org_id: orgId });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Template created" });
    }
    setSaving(false);
    setFormOpen(false);
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("message_templates").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Template deleted" }); fetchTemplates(); }
  };

  const handleCopy = async (t: Template) => {
    try {
      await navigator.clipboard.writeText(t.body);
      setCopiedId(t.id);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" /> Templates & Shortcuts
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Message templates and keyboard shortcuts for quick access.
        </p>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="shortcuts" className="gap-1.5">
            <Keyboard className="h-3.5 w-3.5" /> Shortcuts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search templates..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> New Template
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No templates found</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map(t => (
                <Card key={t.id} className="flex flex-col">
                  <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CardTitle className="text-base truncate">{t.name}</CardTitle>
                      {t.is_default && <Badge variant="outline" className="text-[10px] shrink-0">Default</Badge>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete template?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently remove the "{t.name}" template.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(t.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between gap-3">
                    <div className="min-h-[80px]">
                      <HighlightedBody text={t.body} maxLines={5} />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleCopy(t)}
                    >
                      {copiedId === t.id ? (
                        <><Check className="h-4 w-4 mr-1 text-primary" /> Copied!</>
                      ) : (
                        <><Copy className="h-4 w-4 mr-1" /> Copy to Clipboard</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shortcuts" className="mt-4">
          <ShortcutsPanel />
        </TabsContent>
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Template Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Order Confirmed" />
            </div>
            <div className="space-y-1.5">
              <Label>Message Body *</Label>
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Hi [First Name], your order [Order ID]..."
                rows={8}
              />
              <p className="text-xs text-muted-foreground">
                Use placeholders like [First Name], [Order ID], [Event Name], [Date] — they'll be highlighted visually.
              </p>
            </div>
            {body && (
              <div className="rounded-md border p-3 bg-muted/30">
                <p className="text-xs font-medium mb-1.5 text-muted-foreground">Preview</p>
                <HighlightedBody text={body} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editingId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
