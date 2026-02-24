import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, UserPlus, Mail, Shield, Eye, Clock, Check, X, Play, ChevronDown, BookOpen, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Member {
  id: string;
  user_id: string;
  role: "admin" | "viewer";
  created_at: string;
  profiles: { display_name: string | null } | null;
}

interface Invitation {
  id: string;
  email: string;
  role: "admin" | "viewer";
  status: string;
  created_at: string;
  expires_at: string;
}

const FEATURE_GUIDE = [
  { name: "Dashboard", desc: "Overview of key metrics — total revenue, active orders, upcoming events, and quick-access shortcuts to the most used pages." },
  { name: "Orders", desc: "Track all customer sales. Update order status, delivery type, link inventory tickets, and view profit/loss per order." },
  { name: "Purchases", desc: "Record supplier ticket buys with cost, quantity, and category. Purchases auto-generate inventory items." },
  { name: "Inventory", desc: "Manage all ticket stock. View seating details, login credentials, and ticket pass links. Group by singles, pairs, quads." },
  { name: "Suppliers", desc: "Manage supplier contacts, payment terms, logos, and track purchase history per supplier." },
  { name: "Events", desc: "Create and manage events with match codes, venues, and dates. All orders and inventory link to events." },
  { name: "Platforms", desc: "Configure selling platforms (e.g. StubHub, Viagogo). Track fees, payout schedules, and per-platform performance." },
  { name: "Finance", desc: "PIN-protected financial overview — profit/loss, revenue breakdown, fee analysis, and transaction ledger." },
  { name: "Analytics", desc: "Deep-dive metrics: margin %, average ticket price, club/tournament filters, and side-by-side event comparison." },
  { name: "Balances", desc: "Track what you owe suppliers and what platforms owe you. Partial payments, payment age warnings, and history." },
  { name: "Wallet", desc: "Quick snapshot of total accessible liquid funds across all platforms and suppliers." },
  { name: "Cashflow", desc: "Calendar view of expected income and outflows. Recurring payout markers and weekly summary panel." },
  { name: "To-Do List", desc: "Team task management with priorities (Urgent to Low), assignees, due dates, and completion celebrations." },
  { name: "Invoices", desc: "Generate professional invoices with saved business details, line items, tax, and bank info." },
  { name: "Health Check", desc: "Automated system checks with live status banner. Auto-rechecks every 60 seconds." },
  { name: "Communications", desc: "Send team emails and set up automated rules for alerts like unactioned orders or weekly summaries." },
];

export default function Team() {
  const { orgId, orgName, userRole } = useOrg();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "viewer">("viewer");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    const [membersRes, invitesRes] = await Promise.all([
      supabase.from("org_members").select("id, user_id, role, created_at, profiles(display_name)").eq("org_id", orgId),
      supabase.from("invitations").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
    ]);
    setMembers((membersRes.data as any) || []);
    setInvitations((invitesRes.data as any) || []);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async () => {
    if (!orgId || !inviteEmail) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    const { error } = await supabase.from("invitations").insert({
      org_id: orgId,
      email: inviteEmail.toLowerCase().trim(),
      role: inviteRole,
      invited_by: user.id,
    });

    if (error) {
      toast.error("Failed to send invitation");
    } else {
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteOpen(false);
      load();
    }
    setSending(false);
  };

  const updateMemberRole = async (memberId: string, newRole: "admin" | "viewer") => {
    const { error } = await supabase.from("org_members").update({ role: newRole }).eq("id", memberId);
    if (error) toast.error("Failed to update role");
    else { toast.success("Role updated"); load(); }
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from("org_members").delete().eq("id", memberId);
    if (error) toast.error("Failed to remove member");
    else { toast.success("Member removed"); load(); }
  };

  const cancelInvitation = async (inviteId: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", inviteId);
    if (error) toast.error("Failed to cancel invitation");
    else { toast.success("Invitation cancelled"); load(); }
  };

  const isAdmin = userRole === "admin";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground text-sm">
            {orgName || "Your Organization"} · {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4 mr-1" /> Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "viewer")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5" /> Admin — Full access
                        </div>
                      </SelectItem>
                      <SelectItem value="viewer">
                        <div className="flex items-center gap-2">
                          <Eye className="h-3.5 w-3.5" /> Viewer — Read only
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  They'll need to sign up with this email. The invitation expires in 7 days.
                </p>
                <Button onClick={handleInvite} disabled={!inviteEmail || sending} className="w-full">
                  {sending ? "Sending..." : "Send Invitation"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Members */}
      <Card>
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Members</span>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {isAdmin && <TableHead className="w-[120px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-muted-foreground">
                    No members yet. Invite someone to get started.
                  </TableCell>
                </TableRow>
              ) : members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {(m as any).profiles?.display_name || "Unknown"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={m.role === "admin"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted text-muted-foreground"
                    }>
                      {m.role === "admin" ? <><Shield className="h-3 w-3 mr-1" />Admin</> : <><Eye className="h-3 w-3 mr-1" />Viewer</>}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(m.created_at), "dd MMM yyyy")}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Select
                          value={m.role}
                          onValueChange={(v) => updateMemberRole(m.id, v as "admin" | "viewer")}
                        >
                          <SelectTrigger className="h-7 w-[80px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeMember(m.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <Mail className="h-4 w-4 text-warning" />
            <span className="font-semibold text-sm">Pending Invitations</span>
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  {isAdmin && <TableHead className="w-[60px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{inv.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        inv.status === "pending" ? "bg-warning/10 text-warning border-warning/20" :
                        inv.status === "accepted" ? "bg-success/10 text-success border-success/20" :
                        "bg-muted text-muted-foreground"
                      }>
                        {inv.status === "pending" ? <><Clock className="h-3 w-3 mr-1" />Pending</> :
                         inv.status === "accepted" ? <><Check className="h-3 w-3 mr-1" />Accepted</> : inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(inv.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(inv.expires_at), "dd MMM yyyy")}
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        {inv.status === "pending" && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => cancelInvitation(inv.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Roles Reference */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Platform Roles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Admin</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Full access — can manage purchases, orders, inventory, suppliers, finances, team members, and all platform settings.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted">
                <Eye className="h-4 w-4 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-sm">Viewer</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Read-only access — can view orders, inventory, and analytics but cannot create, edit, or delete any records.
            </p>
          </div>
        </div>
      </div>

      {/* Onboarding: Video + Feature Guide */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">Onboarding & Training</h2>

        {/* Video CTA */}
        <div className="rounded-xl border bg-card p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Watch the Platform Walkthrough</p>
            <p className="text-xs text-muted-foreground mt-0.5">A quick video showing how everything works end-to-end.</p>
          </div>
          <Button variant="secondary" asChild>
            <a href="https://www.youtube.com/watch?v=PLACEHOLDER" target="_blank" rel="noopener noreferrer">
              <Play className="h-4 w-4 mr-1.5" /> Watch Video
            </a>
          </Button>
        </div>

        {/* Written Feature Guide */}
        <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
          <div className="rounded-xl border bg-card overflow-hidden">
            <CollapsibleTrigger asChild>
              <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Feature Guide</span>
                  <Badge variant="secondary" className="text-xs">{FEATURE_GUIDE.length} pages</Badge>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${guideOpen ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t divide-y divide-border">
                {FEATURE_GUIDE.map((item) => (
                  <div key={item.name} className="px-5 py-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Briefcase className="h-3.5 w-3.5 text-primary" />
                      <h4 className="text-sm font-medium">{item.name}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground pl-5.5">{item.desc}</p>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </div>
    </div>
  );
}
