import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Plus, Trash2, Edit, Send, Zap, Clock, History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";

interface Member {
  user_id: string;
  display_name: string;
}

interface EmailRule {
  id: string;
  name: string;
  trigger_type: string;
  trigger_config: any;
  recipient_user_ids: string[];
  subject_template: string;
  body_template: string;
  enabled: boolean;
  created_at: string;
}

interface SentEmail {
  id: string;
  subject: string;
  body: string;
  recipient_user_ids: string[];
  sent_by: string | null;
  created_at: string;
}

export default function Communications() {
  const { orgId } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);

  // Compose state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // Rule dialog state
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EmailRule | null>(null);
  const [ruleName, setRuleName] = useState("");
  const [ruleTriggerType, setRuleTriggerType] = useState("unactioned_order");
  const [ruleDays, setRuleDays] = useState(3);
  const [ruleDayOfWeek, setRuleDayOfWeek] = useState("monday");
  const [ruleRecipients, setRuleRecipients] = useState<Set<string>>(new Set());
  const [ruleSubject, setRuleSubject] = useState("");
  const [ruleBody, setRuleBody] = useState("");

  const loadMembers = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("org_members")
      .select("user_id, profiles(display_name)")
      .eq("org_id", orgId);
    setMembers((data || []).map((m: any) => ({
      user_id: m.user_id,
      display_name: m.profiles?.display_name || "Unknown",
    })));
  }, [orgId]);

  const loadRules = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("email_rules")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });
    setRules((data as any) || []);
  }, [orgId]);

  const loadSentEmails = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("sent_emails")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    setSentEmails((data as any) || []);
  }, [orgId]);

  useEffect(() => { loadMembers(); loadRules(); loadSentEmails(); }, [loadMembers, loadRules, loadSentEmails]);

  const toggleRecipient = (userId: string, set: Set<string>, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(userId)) next.delete(userId); else next.add(userId);
    setter(next);
  };

  const selectAllRecipients = (set: Set<string>, setter: (s: Set<string>) => void) => {
    if (set.size === members.length) {
      setter(new Set());
    } else {
      setter(new Set(members.map(m => m.user_id)));
    }
  };

  const handleSendEmail = async () => {
    if (!subject || !body || selectedRecipients.size === 0 || !orgId) {
      toast.error("Fill in subject, body, and select recipients");
      return;
    }
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // Log the sent email
      const { error } = await supabase.from("sent_emails").insert({
        org_id: orgId,
        subject,
        body,
        recipient_user_ids: [...selectedRecipients],
        sent_by: user?.id || null,
      } as any);
      if (error) throw error;

      const recipientNames = [...selectedRecipients].map(uid => members.find(m => m.user_id === uid)?.display_name || uid).join(", ");
      toast.success(`Email sent to: ${recipientNames}`);
      setSubject("");
      setBody("");
      setSelectedRecipients(new Set());
      loadSentEmails();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const openAddRule = () => {
    setEditingRule(null); setRuleName(""); setRuleTriggerType("unactioned_order");
    setRuleDays(3); setRuleDayOfWeek("monday"); setRuleRecipients(new Set());
    setRuleSubject(""); setRuleBody(""); setRuleOpen(true);
  };

  const openEditRule = (rule: EmailRule) => {
    setEditingRule(rule); setRuleName(rule.name); setRuleTriggerType(rule.trigger_type);
    setRuleDays(rule.trigger_config?.days || 3); setRuleDayOfWeek(rule.trigger_config?.day_of_week || "monday");
    setRuleRecipients(new Set(rule.recipient_user_ids)); setRuleSubject(rule.subject_template);
    setRuleBody(rule.body_template); setRuleOpen(true);
  };

  const handleSaveRule = async () => {
    if (!orgId || !ruleName || !ruleSubject || !ruleBody || ruleRecipients.size === 0) {
      toast.error("Fill in all fields and select recipients");
      return;
    }
    const triggerConfig = ruleTriggerType === "unactioned_order"
      ? { days: ruleDays }
      : ruleTriggerType === "weekly_summary"
      ? { day_of_week: ruleDayOfWeek }
      : {};

    const payload = {
      org_id: orgId, name: ruleName, trigger_type: ruleTriggerType,
      trigger_config: triggerConfig, recipient_user_ids: [...ruleRecipients],
      subject_template: ruleSubject, body_template: ruleBody,
    };

    if (editingRule) {
      const { error } = await supabase.from("email_rules").update(payload).eq("id", editingRule.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Rule updated");
    } else {
      const { error } = await supabase.from("email_rules").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Rule created");
    }
    setRuleOpen(false);
    loadRules();
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    const { error } = await supabase.from("email_rules").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Rule deleted");
    loadRules();
  };

  const toggleRuleEnabled = async (id: string, enabled: boolean) => {
    const { error } = await supabase.from("email_rules").update({ enabled }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    loadRules();
  };

  const memberName = (uid: string) => members.find(m => m.user_id === uid)?.display_name || "Unknown";

  const triggerLabel = (type: string, config: any) => {
    if (type === "unactioned_order") return `Order unactioned for ${config?.days || "?"} days`;
    if (type === "weekly_summary") return `Weekly on ${config?.day_of_week || "monday"}`;
    return "Custom trigger";
  };

  const RecipientPicker = ({ selected, onToggle, onSelectAll }: { selected: Set<string>; onToggle: (uid: string) => void; onSelectAll: () => void }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Recipients</Label>
        {members.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onSelectAll}>
            {selected.size === members.length ? "Deselect All" : "Select All"}
          </Button>
        )}
      </div>
      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">No team members found.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {members.map(m => (
            <label
              key={m.user_id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                selected.has(m.user_id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
              }`}
            >
              <Checkbox
                checked={selected.has(m.user_id)}
                onCheckedChange={() => onToggle(m.user_id)}
              />
              {m.display_name}
            </label>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Communications</h1>
        <p className="text-muted-foreground text-sm">Send updates and set up automated email rules for your team.</p>
      </div>

      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList>
          <TabsTrigger value="compose" className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Compose Email
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Automated Rules
          </TabsTrigger>
        </TabsList>

        {/* Compose Tab */}
        <TabsContent value="compose" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <RecipientPicker
                selected={selectedRecipients}
                onToggle={(uid) => toggleRecipient(uid, selectedRecipients, setSelectedRecipients)}
                onSelectAll={() => selectAllRecipients(selectedRecipients, setSelectedRecipients)}
              />
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..." />
              </div>
              <div className="space-y-1.5">
                <Label>Message</Label>
                <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message..." rows={8} />
              </div>
              <Button onClick={handleSendEmail} disabled={sending || !subject || !body || selectedRecipients.size === 0}>
                <Send className="h-4 w-4 mr-1" /> {sending ? "Sending..." : "Send Email"}
              </Button>
            </CardContent>
          </Card>

          {/* Sent History */}
          {sentEmails.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Sent History</span>
                <Badge variant="secondary" className="text-xs">{sentEmails.length}</Badge>
              </div>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Recipients</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sentEmails.map(email => (
                      <TableRow key={email.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(email.created_at), "dd MMM yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{email.subject}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {email.recipient_user_ids.map(uid => memberName(uid)).join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Set up automated email notifications based on triggers.
            </p>
            <Button size="sm" onClick={openAddRule}>
              <Plus className="h-4 w-4 mr-1" /> Add Rule
            </Button>
          </div>

          {rules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Zap className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="font-medium text-sm">No automated rules yet</p>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-sm mx-auto">
                  Automated rules send email alerts to your team based on triggers — for example, notifying when orders remain unactioned for a set number of days, or sending a weekly summary.
                </p>
                <Button size="sm" className="mt-4" onClick={openAddRule}>
                  <Plus className="h-4 w-4 mr-1" /> Add Your First Rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <Card key={rule.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm">{rule.name}</h3>
                          <Badge variant="outline" className={rule.enabled ? "bg-success/10 text-success border-success/20" : "bg-muted text-muted-foreground"}>
                            {rule.enabled ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {triggerLabel(rule.trigger_type, rule.trigger_config)}
                          </span>
                          <span>
                            → {rule.recipient_user_ids.map(uid => memberName(uid)).join(", ")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          Subject: {rule.subject_template}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Switch checked={rule.enabled} onCheckedChange={(v) => toggleRuleEnabled(rule.id, v)} />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRule(rule)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteRule(rule.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Rule Dialog */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "New Automated Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Rule Name</Label>
              <Input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="e.g. Unactioned order alert" />
            </div>
            <div className="space-y-1.5">
              <Label>Trigger Type</Label>
              <Select value={ruleTriggerType} onValueChange={setRuleTriggerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unactioned_order">Unactioned order for X days</SelectItem>
                  <SelectItem value="weekly_summary">Weekly summary</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ruleTriggerType === "unactioned_order" && (
              <div className="space-y-1.5">
                <Label>Days before triggering</Label>
                <Input type="number" min={1} value={ruleDays} onChange={e => setRuleDays(Number(e.target.value))} />
              </div>
            )}
            {ruleTriggerType === "weekly_summary" && (
              <div className="space-y-1.5">
                <Label>Day of week</Label>
                <Select value={ruleDayOfWeek} onValueChange={setRuleDayOfWeek}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(d => (
                      <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <RecipientPicker
              selected={ruleRecipients}
              onToggle={(uid) => toggleRecipient(uid, ruleRecipients, setRuleRecipients)}
              onSelectAll={() => selectAllRecipients(ruleRecipients, setRuleRecipients)}
            />
            <Separator />
            <div className="space-y-1.5">
              <Label>Email Subject</Label>
              <Input value={ruleSubject} onChange={e => setRuleSubject(e.target.value)} placeholder="Alert: Unactioned orders" />
            </div>
            <div className="space-y-1.5">
              <Label>Email Body</Label>
              <Textarea value={ruleBody} onChange={e => setRuleBody(e.target.value)} placeholder="Write the email template..." rows={5} />
            </div>
            <Button onClick={handleSaveRule} className="w-full">
              {editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
