import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Plus, Trash2, Settings, Download, ArrowLeft, Pencil, Upload, Image } from "lucide-react";
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
  signature_url: string | null;
}

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0 })}`;

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
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadData = useCallback(() => {
    if (!orgId) return;
    Promise.all([
      supabase.from("invoices").select("*").eq("org_id", orgId).order("invoice_number", { ascending: false }),
      supabase.from("invoice_settings").select("*").eq("org_id", orgId).maybeSingle(),
    ]).then(([inv, sett]) => {
      setInvoices((inv.data as unknown as Invoice[]) || []);
      if (sett.data) {
        const s = sett.data as unknown as InvoiceSettings;
        setSettings(s);
        setSignatureUrl(s.signature_url);
      }
    });
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  const nextInvoiceNumber = invoices.length > 0 ? Math.max(...invoices.map(i => i.invoice_number)) + 1 : 1;

  const updateLineItem = (idx: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map((item, i) => i !== idx ? item : { ...item, [field]: value }));
  };

  const total = lineItems.reduce((s, li) => s + (Number(li.total) || 0), 0);

  const resetForm = () => {
    setRecipientAddress(""); setRecipientAccountName(""); setRecipientSwift(""); setRecipientIban("");
    setSenderAccountHolder(""); setSenderAddress("");
    setLineItems([{ description: "", quantity: 1, total: 0 }]);
    setInvoiceDate(format(new Date(), "yyyy-MM-dd"));
  };

  const applyDefaults = () => {
    if (settings) {
      setSenderAccountHolder(settings.business_name || "");
      setSenderAddress(settings.business_address || "");
      setRecipientAddress(settings.notes || "");
      setRecipientAccountName(settings.account_name || "");
      setRecipientSwift(settings.swift_bic || "");
      setRecipientIban(settings.iban || "");
    }
  };

  const openCreate = () => {
    setEditing(null); setCreating(true); resetForm();
    applyDefaults();
  };

  // Auto-open create with defaults when no invoices exist and settings are loaded
  useEffect(() => {
    if (invoices.length === 0 && settings && !creating && !editing) {
      openCreate();
    }
  }, [invoices, settings]);

  const openEdit = (inv: Invoice) => {
    setEditing(inv); setCreating(true);
    setRecipientAddress(inv.recipient_address || "");
    setRecipientAccountName(inv.account_name || "");
    setRecipientSwift(inv.swift_bic || "");
    setRecipientIban(inv.iban || "");
    setSenderAccountHolder(inv.sender_name || "");
    setSenderAddress(inv.sender_address || "");
    setInvoiceDate(inv.invoice_date ? format(new Date(inv.invoice_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
    const items = inv.line_items as unknown as LineItem[];
    setLineItems(items?.length ? items : [{ description: "", quantity: 1, total: 0 }]);
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const payload: any = {
        org_id: orgId, invoice_date: invoiceDate,
        sender_name: senderAccountHolder || null, sender_address: senderAddress || null,
        recipient_address: recipientAddress || null, account_name: recipientAccountName || null,
        swift_bic: recipientSwift || null, iban: recipientIban || null,
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
      setCreating(false); loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const deleteInvoice = async (id: string) => {
    await supabase.from("invoices").delete().eq("id", id);
    toast.success("Invoice deleted"); loadData();
  };

  // Signature upload
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    setUploadingSig(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${orgId}/signature.${ext}`;
      const { error: upErr } = await supabase.storage.from("signatures").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("signatures").getPublicUrl(path);
      setSignatureUrl(data.publicUrl + "?t=" + Date.now());
      toast.success("Signature uploaded");
    } catch (err: any) { toast.error(err.message); }
    finally { setUploadingSig(false); }
  };

  const openSettingsDialog = () => {
    setShowSettings(true);
    if (settings) {
      setSAccHolder(settings.business_name || ""); setSAddr(settings.business_address || "");
      setSRecipAddr(settings.notes || ""); setSRecipAccName(settings.account_name || "");
      setSSwift(settings.swift_bic || ""); setSIban(settings.iban || "");
    }
  };

  const saveSettings = async () => {
    if (!orgId) return;
    setSavingSettings(true);
    try {
      const payload: any = {
        org_id: orgId, business_name: sAccHolder || null, business_address: sAddr || null,
        account_name: sRecipAccName || null, swift_bic: sSwift || null, iban: sIban || null,
        notes: sRecipAddr || null, signature_url: signatureUrl || null,
      };
      if (settings) {
        const { error } = await supabase.from("invoice_settings").update(payload).eq("org_id", orgId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoice_settings").insert(payload);
        if (error) throw error;
      }
      toast.success("Settings saved"); setShowSettings(false); loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingSettings(false); }
  };

  const downloadPDF = (inv: Invoice) => {
    const items = (inv.line_items as unknown as LineItem[]) || [];
    const invTotal = items.reduce((s, li) => s + (Number(li.total) || 0), 0);
    const dateStr = inv.invoice_date ? format(new Date(inv.invoice_date), "do MMMM yyyy") : "";
    const sigUrl = signatureUrl || settings?.signature_url || "";

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Invoice #${String(inv.invoice_number).padStart(4, "0")}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; padding: 50px 60px; color: #1a3a2a; max-width: 800px; margin: 0 auto; background: #fff; }
        .title { text-align: center; font-family: 'Playfair Display', serif; font-size: 42px; font-weight: 900; letter-spacing: 8px; text-transform: uppercase; color: #1a3a2a; padding-bottom: 12px; margin-bottom: 28px; border-bottom: 3px solid #1a3a2a; }
        .header-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 24px; }
        .header-label { font-size: 14px; font-weight: 500; color: #4a6a5a; }
        .header-value { font-weight: 700; font-size: 15px; color: #1a3a2a; }
        .recipient-block { margin-bottom: 32px; padding: 16px 20px; background: #f0f7f4; border-radius: 8px; border-left: 4px solid #2d6a4f; }
        .recipient-block p { font-size: 13px; margin: 4px 0; color: #2d4a3e; }
        .recipient-block .label { font-weight: 600; color: #1a3a2a; }
        table { width: 100%; border-collapse: collapse; margin: 28px 0; }
        th { text-align: right; padding: 12px 16px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #fff; background: #2d6a4f; }
        th:first-child { text-align: left; border-radius: 6px 0 0 6px; }
        th:last-child { border-radius: 0 6px 6px 0; }
        td { padding: 16px; font-size: 14px; text-align: right; border-bottom: 1px solid #e8f0ec; }
        td:first-child { text-align: left; font-weight: 500; }
        .bottom-section { display: flex; justify-content: space-between; margin-top: 28px; padding-top: 24px; border-top: 2px solid #2d6a4f; }
        .from-block { max-width: 55%; }
        .from-block .from-title { font-size: 13px; font-weight: 500; color: #4a6a5a; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
        .from-block p { font-size: 13px; margin: 3px 0; color: #2d4a3e; }
        .from-block .bold { font-weight: 700; color: #1a3a2a; }
        .total-block { text-align: right; }
        .total-box { background: #2d6a4f; color: #fff; padding: 14px 24px; border-radius: 8px; display: inline-block; margin-bottom: 16px; }
        .total-box .label { font-size: 14px; font-weight: 500; opacity: 0.9; }
        .total-box .value { font-size: 28px; font-weight: 700; font-family: 'Playfair Display', serif; }
        .signature-area { margin-top: 12px; }
        .signature-area img { max-width: 160px; max-height: 70px; object-fit: contain; }
        .signature-line { width: 160px; border-top: 1px solid #2d4a3e; margin-top: 6px; margin-left: auto; }
        @media print { body { padding: 30px 40px; } }
      </style></head><body>
      <div class="title">Invoice</div>
      <div class="header-row">
        <span class="header-label">Invoice To :</span>
        <div><span class="header-label">Invoice Date : </span><span class="header-value">${dateStr}</span></div>
      </div>
      <div class="recipient-block">
        ${inv.recipient_address ? `<p><span class="label">Address:</span> ${inv.recipient_address}</p>` : ""}
        ${inv.account_name ? `<p><span class="label">Account Name :</span> ${inv.account_name}</p>` : ""}
        ${inv.swift_bic ? `<p><span class="label">SWIFT / BIC :</span> ${inv.swift_bic}</p>` : ""}
        ${inv.iban ? `<p><span class="label">IBAN :</span> ${inv.iban}</p>` : ""}
      </div>
      <table>
        <thead><tr><th style="text-align:left">Description</th><th>QTY</th><th>TOTAL</th></tr></thead>
        <tbody>
          ${items.map(li => `<tr><td>${li.description}</td><td style="text-align:right">${li.quantity}</td><td style="text-align:right; font-weight:700">£${Number(li.total).toLocaleString("en-GB")}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="bottom-section">
        <div class="from-block">
          <div class="from-title">Invoice From</div>
          ${inv.sender_name ? `<p class="bold">Account holder: ${inv.sender_name}</p>` : ""}
          ${inv.sender_address ? `<p class="bold">Address: ${inv.sender_address}</p>` : ""}
        </div>
        <div class="total-block">
          <div class="total-box">
            <div class="label">Total</div>
            <div class="value">£${invTotal.toLocaleString("en-GB")}</div>
          </div>
          ${sigUrl ? `<div class="signature-area"><img src="${sigUrl}" alt="Signature" /><div class="signature-line"></div></div>` : `<div class="signature-area"><div style="height:50px"></div><div class="signature-line"></div></div>`}
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
        <button onClick={() => setCreating(false)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </button>

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{editing ? `Edit Invoice #${String(editing.invoice_number).padStart(4, "0")}` : `New Invoice #${String(nextInvoiceNumber).padStart(4, "0")}`}</h1>
        </div>

        {/* Invoice Date */}
        <div className="rounded-xl border bg-card p-5 space-y-3 shadow-sm">
          <div className="space-y-2 max-w-xs">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice Date</Label>
            <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
          </div>
        </div>

        {/* Invoice To */}
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice To</h3>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Address</Label>
              <Textarea placeholder="e.g. Etihad Airways Centre 5th Floor, Abu Dhabi, UAE" value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1">
              <Label>Account Name</Label>
              <Input placeholder="e.g. S C M HOSPITALITY SERVICES CO. L.L.C" value={recipientAccountName} onChange={e => setRecipientAccountName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Items</h3>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_80px_120px_36px] gap-2 items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Description</span><span className="text-right">QTY</span><span className="text-right">Total (£)</span><span />
            </div>
            {lineItems.map((li, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_120px_36px] gap-2 items-center">
                <Input placeholder="e.g. Liverpool v Real Madrid hospitality" value={li.description} onChange={e => updateLineItem(idx, "description", e.target.value)} />
                <Input type="number" min={1} value={li.quantity} onChange={e => updateLineItem(idx, "quantity", parseInt(e.target.value) || 0)} />
                <Input type="number" step="0.01" min={0} value={li.total || ""} onChange={e => updateLineItem(idx, "total", parseFloat(e.target.value) || 0)} placeholder="0.00" />
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
          <div className="flex justify-end items-center gap-4">
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total</span>
            <span className="text-2xl font-bold text-primary">{fmt(total)}</span>
          </div>
        </div>

        {/* Invoice From */}
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice From</h3>
          </div>
          <div className="space-y-3">
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

        {/* Signature preview */}
        {signatureUrl && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Signature</h3>
            </div>
            <img src={signatureUrl} alt="Your signature" className="max-h-16 object-contain opacity-80" />
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full h-12 text-base font-semibold">
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
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
            <p className="text-xs text-muted-foreground">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""} created</p>
          </div>
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
        <div className="rounded-xl border bg-card p-16 text-center shadow-sm">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-semibold">No invoices yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first invoice to get started.</p>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> New Invoice</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {invoices.map(inv => {
            const items = (inv.line_items as unknown as LineItem[]) || [];
            const invTotal = items.reduce((s, li) => s + (Number(li.total) || 0), 0);
            return (
              <div key={inv.id} className="rounded-xl border bg-card p-4 flex items-center justify-between hover:shadow-md transition-all hover:border-primary/30 group">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    #{String(inv.invoice_number).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{inv.account_name || inv.recipient_name || "No recipient"}</span>
                      <Badge variant={inv.status === "paid" ? "default" : inv.status === "sent" ? "secondary" : "outline"} className="text-[10px]">
                        {inv.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(inv.invoice_date), "dd MMM yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-bold text-primary">{fmt(invTotal)}</span>
                  <div className="flex items-center gap-0.5">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadPDF(inv)} title="Download PDF">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(inv)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteInvoice(inv.id)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={v => { if (!v) setShowSettings(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Default Invoice Details</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Pre-filled when creating new invoices.</p>
          <div className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Invoice From (Your Details)</h4>
            </div>
            <div className="space-y-1"><Label>Account Holder</Label><Input value={sAccHolder} onChange={e => setSAccHolder(e.target.value)} /></div>
            <div className="space-y-1"><Label>Address</Label><Textarea value={sAddr} onChange={e => setSAddr(e.target.value)} rows={2} /></div>
            <Separator />
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Invoice To (Default Recipient)</h4>
            </div>
            <div className="space-y-1"><Label>Address</Label><Textarea value={sRecipAddr} onChange={e => setSRecipAddr(e.target.value)} rows={2} /></div>
            <div className="space-y-1"><Label>Account Name</Label><Input value={sRecipAccName} onChange={e => setSRecipAccName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>SWIFT / BIC</Label><Input value={sSwift} onChange={e => setSSwift(e.target.value)} /></div>
              <div className="space-y-1"><Label>IBAN</Label><Input value={sIban} onChange={e => setSIban(e.target.value)} /></div>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Signature</h4>
            </div>
            <div className="space-y-2">
              {signatureUrl ? (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                  <img src={signatureUrl} alt="Signature" className="max-h-12 object-contain" />
                  <span className="text-xs text-muted-foreground flex-1">Signature uploaded</span>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild><span><Upload className="h-3 w-3 mr-1" /> Replace</span></Button>
                    <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                  </label>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <Image className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <span className="text-sm font-medium text-muted-foreground">{uploadingSig ? "Uploading..." : "Upload your signature"}</span>
                  <span className="text-xs text-muted-foreground/70 mt-0.5">PNG or JPG recommended</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} disabled={uploadingSig} />
                </label>
              )}
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
