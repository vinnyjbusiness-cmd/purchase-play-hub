import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Plus, Trash2, Settings, Download, ArrowLeft, Pencil } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface LineItem { description: string; quantity: number; total: number; }
interface Invoice {
  id: string; invoice_number: number; invoice_date: string; due_date: string | null;
  status: string; sender_name: string | null; sender_address: string | null;
  sender_email: string | null; sender_phone: string | null;
  recipient_name: string | null; recipient_address: string | null; recipient_email: string | null;
  line_items: LineItem[]; subtotal: number; tax_rate: number; tax_amount: number; total: number;
  bank_name: string | null; account_name: string | null; account_number: string | null;
  sort_code: string | null; swift_bic: string | null; iban: string | null;
  notes: string | null; payment_terms: string | null; created_at: string;
}
interface InvoiceSettings {
  business_name: string | null; business_address: string | null; business_email: string | null;
  business_phone: string | null; bank_name: string | null; account_name: string | null;
  account_number: string | null; sort_code: string | null; swift_bic: string | null;
  iban: string | null; payment_terms: string | null; notes: string | null;
}

export default function InvoiceGenerator() {
  const { orgId } = useOrg();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [creating, setCreating] = useState(false);

  // Form – Invoice To (recipient)
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientAccountName, setRecipientAccountName] = useState("");
  const [recipientSwift, setRecipientSwift] = useState("");
  const [recipientIban, setRecipientIban] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Form – Invoice From (sender)
  const [senderAccountHolder, setSenderAccountHolder] = useState("");
  const [senderAddress, setSenderAddress] = useState("");

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: 1, total: 0 }]);
  const [saving, setSaving] = useState(false);

  // Settings form
  const [sAccHolder, setSAccHolder] = useState("");
  const [sAddr, setSAddr] = useState("");
  const [sRecipAddr, setSRecipAddr] = useState("");
  const [sRecipAccName, setSRecipAccName] = useState("");
  const [sSwift, setSSwift] = useState("");
  const [sIban, setSIban] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const loadData = () => {
    if (!orgId) return;
    Promise.all([
      supabase.from("invoices").select("*").eq("org_id", orgId).order("invoice_number", { ascending: false }),
      supabase.from("invoice_settings").select("*").eq("org_id", orgId).maybeSingle(),
    ]).then(([inv, sett]) => {
      setInvoices((inv.data as unknown as Invoice[]) || []);
      if (sett.data) setSettings(sett.data as unknown as InvoiceSettings);
    });
  };

  useEffect(() => { loadData(); }, [orgId]);

  const nextInvoiceNumber = invoices.length > 0 ? Math.max(...invoices.map(i => i.invoice_number)) + 1 : 1;

  const updateLineItem = (idx: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      return { ...item, [field]: value };
    }));
  };

  const total = lineItems.reduce((s, li) => s + (Number(li.total) || 0), 0);

  const resetForm = () => {
    setRecipientAddress(""); setRecipientAccountName(""); setRecipientSwift(""); setRecipientIban("");
    setSenderAccountHolder(""); setSenderAddress("");
    setLineItems([{ description: "", quantity: 1, total: 0 }]);
    setInvoiceDate(format(new Date(), "yyyy-MM-dd"));
  };

  const openCreate = () => {
    setEditing(null); setCreating(true);
    resetForm();
    if (settings) {
      setSenderAccountHolder(settings.business_name || "");
      setSenderAddress(settings.business_address || "");
      setRecipientAddress(settings.notes || ""); // use notes for default recipient address
      setRecipientAccountName(settings.account_name || "");
      setRecipientSwift(settings.swift_bic || "");
      setRecipientIban(settings.iban || "");
    }
  };

  const openEdit = (inv: Invoice) => {
    setEditing(inv); setCreating(true);
    setRecipientAddress(inv.recipient_address || "");
    setRecipientAccountName(inv.account_name || "");
    setRecipientSwift(inv.swift_bic || "");
    setRecipientIban(inv.iban || "");
    setSenderAccountHolder(inv.sender_name || "");
    setSenderAddress(inv.sender_address || "");
    setInvoiceDate(inv.invoice_date ? format(new Date(inv.invoice_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
    const items = (inv.line_items as unknown as LineItem[]);
    setLineItems(items && items.length > 0 ? items : [{ description: "", quantity: 1, total: 0 }]);
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const payload: any = {
        org_id: orgId,
        invoice_date: invoiceDate,
        sender_name: senderAccountHolder || null,
        sender_address: senderAddress || null,
        recipient_address: recipientAddress || null,
        account_name: recipientAccountName || null,
        swift_bic: recipientSwift || null,
        iban: recipientIban || null,
        line_items: lineItems.filter(li => li.description.trim()),
        subtotal: total, tax_rate: 0, tax_amount: 0, total,
      };
      if (editing) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Invoice updated");
      } else {
        payload.invoice_number = nextInvoiceNumber;
        const { error } = await supabase.from("invoices").insert(payload);
        if (error) throw error;
        toast.success("Invoice created");
      }
      setCreating(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteInvoice = async (id: string) => {
    await supabase.from("invoices").delete().eq("id", id);
    toast.success("Invoice deleted");
    loadData();
  };

  const openSettingsDialog = () => {
    setShowSettings(true);
    if (settings) {
      setSAccHolder(settings.business_name || "");
      setSAddr(settings.business_address || "");
      setSRecipAddr(settings.notes || "");
      setSRecipAccName(settings.account_name || "");
      setSSwift(settings.swift_bic || "");
      setSIban(settings.iban || "");
    }
  };

  const saveSettings = async () => {
    if (!orgId) return;
    setSavingSettings(true);
    try {
      const payload: any = {
        org_id: orgId,
        business_name: sAccHolder || null,
        business_address: sAddr || null,
        account_name: sRecipAccName || null,
        swift_bic: sSwift || null,
        iban: sIban || null,
        notes: sRecipAddr || null,
      };
      if (settings) {
        const { error } = await supabase.from("invoice_settings").update(payload).eq("org_id", orgId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoice_settings").insert(payload);
        if (error) throw error;
      }
      toast.success("Settings saved");
      setShowSettings(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const downloadPDF = (inv: Invoice) => {
    const items = (inv.line_items as unknown as LineItem[]) || [];
    const invTotal = items.reduce((s, li) => s + (Number(li.total) || 0), 0);
    const dateStr = inv.invoice_date ? format(new Date(inv.invoice_date), "do MMMM yyyy") : "";

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Invoice</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Georgia, 'Times New Roman', serif; padding: 50px 60px; color: #2d4a3e; max-width: 800px; margin: 0 auto; }
        .title { text-align: center; font-size: 36px; font-weight: bold; letter-spacing: 6px; text-transform: uppercase; border-bottom: 2px solid #2d4a3e; padding-bottom: 8px; margin-bottom: 24px; }
        .header-row { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .header-label { font-size: 15px; }
        .header-value { font-weight: bold; font-size: 15px; }
        .recipient-block { margin-bottom: 30px; }
        .recipient-block p { font-size: 14px; margin: 3px 0; }
        .field-label { font-size: 13px; }
        .field-value { font-weight: bold; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        th { text-align: right; padding: 10px 12px; font-size: 13px; font-weight: bold; text-transform: uppercase; border-top: 1.5px solid #2d4a3e; border-bottom: 1.5px solid #2d4a3e; }
        th:first-child { text-align: left; }
        td { padding: 14px 12px; font-size: 14px; text-align: right; }
        td:first-child { text-align: left; }
        .bottom-section { display: flex; justify-content: space-between; margin-top: 20px; border-top: 1.5px solid #2d4a3e; padding-top: 20px; }
        .from-block p { font-size: 13px; margin: 2px 0; }
        .from-block .bold { font-weight: bold; }
        .total-block { text-align: right; }
        .total-label { font-size: 18px; font-weight: bold; }
        .total-value { font-size: 22px; font-weight: bold; }
        .signature-area { margin-top: 20px; border-top: 1px solid #2d4a3e; padding-top: 4px; width: 180px; margin-left: auto; }
        @media print { body { padding: 30px 40px; } }
      </style></head><body>
      <div class="title">INVOICE</div>
      <div class="header-row">
        <span class="header-label">Invoice To :</span>
        <div><span class="header-label">Invoice Date : </span><span class="header-value">${dateStr}</span></div>
      </div>
      <div class="recipient-block">
        ${inv.recipient_address ? `<p>Address: ${inv.recipient_address}</p>` : ""}
        ${inv.account_name ? `<p>Account Name : ${inv.account_name}</p>` : ""}
        ${inv.swift_bic ? `<p>SWIFT / BIC : ${inv.swift_bic}</p>` : ""}
        ${inv.iban ? `<p>IBAN : ${inv.iban}</p>` : ""}
      </div>
      <table>
        <thead><tr><th style="text-align:left"></th><th>QTY</th><th>TOTAL</th></tr></thead>
        <tbody>
          ${items.map(li => `<tr><td>${li.description}</td><td style="text-align:right">${li.quantity}</td><td style="text-align:right; font-weight:bold">${li.total}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="bottom-section">
        <div class="from-block">
          <p class="header-label" style="margin-bottom: 8px">Invoice From :</p>
          ${inv.sender_name ? `<p class="bold">Account holder: ${inv.sender_name}</p>` : ""}
          ${inv.sender_address ? `<p class="bold">Address: ${inv.sender_address}</p>` : ""}
        </div>
        <div class="total-block">
          <div style="border-top: 1.5px solid #2d4a3e; border-bottom: 1.5px solid #2d4a3e; padding: 8px 0; margin-bottom: 16px;">
            <span class="total-label">Total : </span>
            <span class="total-value">${invTotal}</span>
          </div>
          <div class="signature-area"></div>
        </div>
      </div>
      <script>window.print();</script>
      </body></html>
    `);
    w.document.close();
  };

  // ─── CREATE/EDIT VIEW ───
  if (creating) {
    return (
      <div className="space-y-6 max-w-3xl">
        <button onClick={() => setCreating(false)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </button>
        <h1 className="text-2xl font-bold">{editing ? `Edit Invoice #${String(editing.invoice_number).padStart(4, "0")}` : `New Invoice #${String(nextInvoiceNumber).padStart(4, "0")}`}</h1>

        {/* Invoice Date */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="space-y-2 max-w-xs">
            <Label>Invoice Date</Label>
            <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
        </div>

        {/* Invoice To */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice To</h3>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label>Address</Label>
              <Textarea placeholder="e.g. Etihad Airways Centre 5th Floor, Abu Dhabi, UAE" value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Account Name</Label>
              <Input placeholder="e.g. S C M HOSPITALITY SERVICES CO. L.L.C" value={recipientAccountName} onChange={e => setRecipientAccountName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>SWIFT / BIC</Label>
                <Input placeholder="e.g. WIOBAEADXXX" value={recipientSwift} onChange={e => setRecipientSwift(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>IBAN</Label>
                <Input placeholder="e.g. AE940860000009951529757" value={recipientIban} onChange={e => setRecipientIban(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_80px_100px_36px] gap-2 items-center text-xs font-semibold text-muted-foreground uppercase">
              <span>Description</span><span className="text-right">QTY</span><span className="text-right">Total</span><span />
            </div>
            {lineItems.map((li, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_100px_36px] gap-2 items-center">
                <Input placeholder="e.g. Liverpool v Real Madrid hospitality" value={li.description} onChange={e => updateLineItem(idx, "description", e.target.value)} />
                <Input type="number" min={1} value={li.quantity} onChange={e => updateLineItem(idx, "quantity", parseInt(e.target.value) || 0)} />
                <Input type="number" step="0.01" min={0} value={li.total || ""} onChange={e => updateLineItem(idx, "total", parseFloat(e.target.value) || 0)} placeholder="0" />
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))} disabled={lineItems.length <= 1}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLineItems(prev => [...prev, { description: "", quantity: 1, total: 0 }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
            </Button>
          </div>
          <Separator />
          <div className="flex justify-end text-lg font-bold">
            <span className="mr-4">Total</span>
            <span>{total}</span>
          </div>
        </div>

        {/* Invoice From */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice From</h3>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label>Account Holder</Label>
              <Input placeholder="e.g. FTN GROUP - FCZO" value={senderAccountHolder} onChange={e => setSenderAccountHolder(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Address</Label>
              <Textarea placeholder="e.g. IFZA business park, DDP, premises number 30357-001 Dubai, UAE" value={senderAddress} onChange={e => setSenderAddress(e.target.value)} rows={2} />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : editing ? "Update Invoice" : "Create Invoice"}
        </Button>
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <Badge variant="secondary">{invoices.length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openSettingsDialog}>
            <Settings className="h-4 w-4 mr-1.5" /> Defaults
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> New Invoice
          </Button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-lg font-medium">No invoices yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first invoice to get started.</p>
          <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> New Invoice</Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="divide-y divide-border">
            {invoices.map(inv => {
              const items = (inv.line_items as unknown as LineItem[]) || [];
              const invTotal = items.reduce((s, li) => s + (Number(li.total) || 0), 0);
              return (
                <div key={inv.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">#{String(inv.invoice_number).padStart(4, "0")}</span>
                      <span className="text-sm font-medium">{inv.account_name || inv.recipient_name || "No recipient"}</span>
                      <Badge variant={inv.status === "paid" ? "default" : inv.status === "sent" ? "secondary" : "outline"} className="text-[10px]">
                        {inv.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(inv.invoice_date), "dd MMM yyyy")} · Total: {invTotal}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadPDF(inv)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(inv)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteInvoice(inv.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={v => { if (!v) setShowSettings(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Default Invoice Details</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">These will be pre-filled when creating new invoices.</p>
          <div className="space-y-3 mt-2">
            <Separator />
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Invoice From (Your Details)</h4>
            <div className="space-y-1"><Label>Account Holder</Label><Input value={sAccHolder} onChange={e => setSAccHolder(e.target.value)} /></div>
            <div className="space-y-1"><Label>Address</Label><Textarea value={sAddr} onChange={e => setSAddr(e.target.value)} rows={2} /></div>
            <Separator />
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">Invoice To (Default Recipient)</h4>
            <div className="space-y-1"><Label>Address</Label><Textarea value={sRecipAddr} onChange={e => setSRecipAddr(e.target.value)} rows={2} /></div>
            <div className="space-y-1"><Label>Account Name</Label><Input value={sRecipAccName} onChange={e => setSRecipAccName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>SWIFT / BIC</Label><Input value={sSwift} onChange={e => setSSwift(e.target.value)} /></div>
              <div className="space-y-1"><Label>IBAN</Label><Input value={sIban} onChange={e => setSIban(e.target.value)} /></div>
            </div>
            <Button onClick={saveSettings} disabled={savingSettings} className="w-full">
              {savingSettings ? "Saving..." : "Save Defaults"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
