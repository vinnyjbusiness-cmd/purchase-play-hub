import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Plus, Trash2, Settings, Download, ArrowLeft, Pencil, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LineItem { description: string; quantity: number; unitPrice: number; total: number; }
interface Invoice {
  id: string; invoice_number: number; invoice_date: string; due_date: string | null;
  status: string; sender_name: string | null; sender_address: string | null;
  sender_email: string | null; sender_phone: string | null;
  recipient_name: string | null; recipient_address: string | null; recipient_email: string | null;
  line_items: LineItem[]; subtotal: number; tax_rate: number; tax_amount: number; total: number;
  bank_name: string | null; account_name: string | null; account_number: string | null;
  sort_code: string | null; notes: string | null; payment_terms: string | null;
  created_at: string;
}
interface InvoiceSettings {
  business_name: string | null; business_address: string | null; business_email: string | null;
  business_phone: string | null; bank_name: string | null; account_name: string | null;
  account_number: string | null; sort_code: string | null; payment_terms: string | null; notes: string | null;
}

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

export default function InvoiceGenerator() {
  const { orgId } = useOrg();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState<Invoice | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Form state
  const [senderName, setSenderName] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const [taxRate, setTaxRate] = useState(0);
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Payment due within 14 days");
  const [saving, setSaving] = useState(false);

  // Settings form
  const [sBizName, setSBizName] = useState("");
  const [sBizAddr, setSBizAddr] = useState("");
  const [sBizEmail, setSBizEmail] = useState("");
  const [sBizPhone, setSBizPhone] = useState("");
  const [sBankName, setSBankName] = useState("");
  const [sAccName, setSAccName] = useState("");
  const [sAccNum, setSAccNum] = useState("");
  const [sSortCode, setSSortCode] = useState("");
  const [sPayTerms, setSPayTerms] = useState("Payment due within 14 days");
  const [sNotes, setSNotes] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const loadData = () => {
    if (!orgId) return;
    Promise.all([
      supabase.from("invoices").select("*").eq("org_id", orgId).order("invoice_number", { ascending: false }),
      supabase.from("invoice_settings").select("*").eq("org_id", orgId).maybeSingle(),
    ]).then(([inv, sett]) => {
      setInvoices((inv.data as unknown as Invoice[]) || []);
      if (sett.data) setSettings(sett.data as InvoiceSettings);
    });
  };

  useEffect(() => { loadData(); }, [orgId]);

  const nextInvoiceNumber = invoices.length > 0 ? Math.max(...invoices.map(i => i.invoice_number)) + 1 : 1;

  const updateLineItem = (idx: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      updated.total = updated.quantity * updated.unitPrice;
      return updated;
    }));
  };

  const subtotal = lineItems.reduce((s, li) => s + li.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    // Pre-fill from settings
    if (settings) {
      setSenderName(settings.business_name || "");
      setSenderAddress(settings.business_address || "");
      setSenderEmail(settings.business_email || "");
      setSenderPhone(settings.business_phone || "");
      setBankName(settings.bank_name || "");
      setAccountName(settings.account_name || "");
      setAccountNumber(settings.account_number || "");
      setSortCode(settings.sort_code || "");
      setPaymentTerms(settings.payment_terms || "Payment due within 14 days");
      setNotes(settings.notes || "");
    } else {
      setSenderName(""); setSenderAddress(""); setSenderEmail(""); setSenderPhone("");
      setBankName(""); setAccountName(""); setAccountNumber(""); setSortCode("");
      setPaymentTerms("Payment due within 14 days"); setNotes("");
    }
    setRecipientName(""); setRecipientAddress(""); setRecipientEmail("");
    setLineItems([{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
    setTaxRate(0);
  };

  const openEdit = (inv: Invoice) => {
    setEditing(inv); setCreating(true);
    setSenderName(inv.sender_name || ""); setSenderAddress(inv.sender_address || "");
    setSenderEmail(inv.sender_email || ""); setSenderPhone(inv.sender_phone || "");
    setRecipientName(inv.recipient_name || ""); setRecipientAddress(inv.recipient_address || "");
    setRecipientEmail(inv.recipient_email || "");
    setLineItems(inv.line_items.length > 0 ? inv.line_items : [{ description: "", quantity: 1, unitPrice: 0, total: 0 }]);
    setTaxRate(inv.tax_rate || 0);
    setBankName(inv.bank_name || ""); setAccountName(inv.account_name || "");
    setAccountNumber(inv.account_number || ""); setSortCode(inv.sort_code || "");
    setNotes(inv.notes || ""); setPaymentTerms(inv.payment_terms || "");
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      const payload: any = {
        org_id: orgId,
        sender_name: senderName || null, sender_address: senderAddress || null,
        sender_email: senderEmail || null, sender_phone: senderPhone || null,
        recipient_name: recipientName || null, recipient_address: recipientAddress || null,
        recipient_email: recipientEmail || null,
        line_items: lineItems.filter(li => li.description.trim()),
        subtotal, tax_rate: taxRate, tax_amount: taxAmount, total,
        bank_name: bankName || null, account_name: accountName || null,
        account_number: accountNumber || null, sort_code: sortCode || null,
        notes: notes || null, payment_terms: paymentTerms || null,
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
      setSBizName(settings.business_name || ""); setSBizAddr(settings.business_address || "");
      setSBizEmail(settings.business_email || ""); setSBizPhone(settings.business_phone || "");
      setSBankName(settings.bank_name || ""); setSAccName(settings.account_name || "");
      setSAccNum(settings.account_number || ""); setSSortCode(settings.sort_code || "");
      setSPayTerms(settings.payment_terms || ""); setSNotes(settings.notes || "");
    }
  };

  const saveSettings = async () => {
    if (!orgId) return;
    setSavingSettings(true);
    try {
      const payload: any = {
        org_id: orgId,
        business_name: sBizName || null, business_address: sBizAddr || null,
        business_email: sBizEmail || null, business_phone: sBizPhone || null,
        bank_name: sBankName || null, account_name: sAccName || null,
        account_number: sAccNum || null, sort_code: sSortCode || null,
        payment_terms: sPayTerms || null, notes: sNotes || null,
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
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Invoice #${String(inv.invoice_number).padStart(4, "0")}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 28px; margin: 0 0 4px; } .meta { color: #666; font-size: 13px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 30px 0; }
        .section h3 { font-size: 11px; text-transform: uppercase; color: #999; margin: 0 0 6px; letter-spacing: 1px; }
        .section p { margin: 2px 0; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #f5f5f5; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 2px solid #e5e5e5; }
        td { padding: 10px; font-size: 13px; border-bottom: 1px solid #eee; }
        .text-right { text-align: right; }
        .totals { margin-left: auto; width: 250px; }
        .totals .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
        .totals .total { font-weight: bold; font-size: 18px; border-top: 2px solid #1a1a1a; padding-top: 8px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
        .footer h3 { font-size: 11px; text-transform: uppercase; color: #999; margin: 0 0 6px; }
        .footer p { margin: 2px 0; font-size: 12px; color: #666; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <h1>INVOICE</h1>
      <p class="meta">#${String(inv.invoice_number).padStart(4, "0")} · ${format(new Date(inv.invoice_date), "dd MMM yyyy")}</p>
      <div class="grid">
        <div class="section"><h3>From</h3>
          ${inv.sender_name ? `<p><strong>${inv.sender_name}</strong></p>` : ""}
          ${inv.sender_address ? `<p>${inv.sender_address.replace(/\n/g, "<br>")}</p>` : ""}
          ${inv.sender_email ? `<p>${inv.sender_email}</p>` : ""}
          ${inv.sender_phone ? `<p>${inv.sender_phone}</p>` : ""}
        </div>
        <div class="section"><h3>To</h3>
          ${inv.recipient_name ? `<p><strong>${inv.recipient_name}</strong></p>` : ""}
          ${inv.recipient_address ? `<p>${inv.recipient_address.replace(/\n/g, "<br>")}</p>` : ""}
          ${inv.recipient_email ? `<p>${inv.recipient_email}</p>` : ""}
        </div>
      </div>
      <table>
        <thead><tr><th>Description</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Total</th></tr></thead>
        <tbody>
          ${inv.line_items.map(li => `<tr><td>${li.description}</td><td class="text-right">${li.quantity}</td><td class="text-right">${fmt(li.unitPrice)}</td><td class="text-right">${fmt(li.total)}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
        ${inv.tax_rate > 0 ? `<div class="row"><span>Tax (${inv.tax_rate}%)</span><span>${fmt(inv.tax_amount)}</span></div>` : ""}
        <div class="row total"><span>Total</span><span>${fmt(inv.total)}</span></div>
      </div>
      <div class="footer">
        ${inv.bank_name || inv.account_number ? `<h3>Payment Details</h3>
          ${inv.bank_name ? `<p>Bank: ${inv.bank_name}</p>` : ""}
          ${inv.account_name ? `<p>Account: ${inv.account_name}</p>` : ""}
          ${inv.account_number ? `<p>Acc No: ${inv.account_number}</p>` : ""}
          ${inv.sort_code ? `<p>Sort Code: ${inv.sort_code}</p>` : ""}` : ""}
        ${inv.payment_terms ? `<p style="margin-top:12px">${inv.payment_terms}</p>` : ""}
        ${inv.notes ? `<p style="margin-top:8px; color:#999">${inv.notes}</p>` : ""}
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

        {/* From / To */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</h3>
            <div className="space-y-2">
              <Input placeholder="Business name" value={senderName} onChange={e => setSenderName(e.target.value)} />
              <Textarea placeholder="Address" value={senderAddress} onChange={e => setSenderAddress(e.target.value)} rows={2} />
              <Input placeholder="Email" value={senderEmail} onChange={e => setSenderEmail(e.target.value)} />
              <Input placeholder="Phone" value={senderPhone} onChange={e => setSenderPhone(e.target.value)} />
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To</h3>
            <div className="space-y-2">
              <Input placeholder="Recipient name" value={recipientName} onChange={e => setRecipientName(e.target.value)} />
              <Textarea placeholder="Address" value={recipientAddress} onChange={e => setRecipientAddress(e.target.value)} rows={2} />
              <Input placeholder="Email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Line Items</h3>
          <div className="space-y-2">
            {lineItems.map((li, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_100px_100px_36px] gap-2 items-center">
                <Input placeholder="Description" value={li.description} onChange={e => updateLineItem(idx, "description", e.target.value)} />
                <Input type="number" min={1} value={li.quantity} onChange={e => updateLineItem(idx, "quantity", parseInt(e.target.value) || 0)} />
                <Input type="number" step="0.01" min={0} value={li.unitPrice || ""} onChange={e => updateLineItem(idx, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="0.00" />
                <span className="text-sm font-medium text-right">{fmt(li.total)}</span>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))} disabled={lineItems.length <= 1}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLineItems(prev => [...prev, { description: "", quantity: 1, unitPrice: 0, total: 0 }])}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
            </Button>
          </div>
          <Separator />
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium w-24 text-right">{fmt(subtotal)}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">Tax (%)</span>
              <Input type="number" className="w-20 h-8 text-sm" value={taxRate || ""} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} />
              <span className="font-medium w-24 text-right">{fmt(taxAmount)}</span>
            </div>
            <div className="flex items-center gap-4 text-lg font-bold pt-2 border-t border-border mt-1">
              <span>Total</span>
              <span className="w-24 text-right">{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Payment details */}
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Details</h3>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Bank name" value={bankName} onChange={e => setBankName(e.target.value)} />
            <Input placeholder="Account name" value={accountName} onChange={e => setAccountName(e.target.value)} />
            <Input placeholder="Account number" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
            <Input placeholder="Sort code" value={sortCode} onChange={e => setSortCode(e.target.value)} />
          </div>
          <Textarea placeholder="Payment terms" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} rows={1} />
          <Textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : editing ? "Update Invoice" : "Create Invoice"}
        </Button>
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="space-y-6">
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
            {invoices.map(inv => (
              <div key={inv.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">#{String(inv.invoice_number).padStart(4, "0")}</span>
                    <span className="text-sm font-medium">{inv.recipient_name || "No recipient"}</span>
                    <Badge variant={inv.status === "paid" ? "default" : inv.status === "sent" ? "secondary" : "outline"} className="text-[10px]">
                      {inv.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(inv.invoice_date), "dd MMM yyyy")} · {fmt(inv.total)}
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
            ))}
          </div>
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={v => { if (!v) setShowSettings(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Default Business Details</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">These will be pre-filled when creating new invoices.</p>
          <div className="space-y-3 mt-2">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={sBizName} onChange={e => setSBizName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={sBizAddr} onChange={e => setSBizAddr(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Email</Label><Input value={sBizEmail} onChange={e => setSBizEmail(e.target.value)} /></div>
              <div className="space-y-1"><Label>Phone</Label><Input value={sBizPhone} onChange={e => setSBizPhone(e.target.value)} /></div>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Bank Name</Label><Input value={sBankName} onChange={e => setSBankName(e.target.value)} /></div>
              <div className="space-y-1"><Label>Account Name</Label><Input value={sAccName} onChange={e => setSAccName(e.target.value)} /></div>
              <div className="space-y-1"><Label>Account No.</Label><Input value={sAccNum} onChange={e => setSAccNum(e.target.value)} /></div>
              <div className="space-y-1"><Label>Sort Code</Label><Input value={sSortCode} onChange={e => setSSortCode(e.target.value)} /></div>
            </div>
            <div className="space-y-1"><Label>Payment Terms</Label><Input value={sPayTerms} onChange={e => setSPayTerms(e.target.value)} /></div>
            <div className="space-y-1"><Label>Default Notes</Label><Textarea value={sNotes} onChange={e => setSNotes(e.target.value)} rows={2} /></div>
            <Button onClick={saveSettings} disabled={savingSettings} className="w-full">
              {savingSettings ? "Saving..." : "Save Defaults"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
