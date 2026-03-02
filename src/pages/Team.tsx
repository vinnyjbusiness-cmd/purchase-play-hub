import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/hooks/useOrg";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Users, UserPlus, Mail, Shield, Eye, Clock, Check, X, Play, ChevronDown, BookOpen, Briefcase, Copy, Settings, Trash2, RefreshCw, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import PermissionsEditor from "@/components/PermissionsEditor";
import { defaultPermissions, type Permissions } from "@/lib/permissions";

interface Member {
  id: string;
  user_id: string;
  role: "admin" | "viewer";
  created_at: string;
  profiles: { display_name: string | null } | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role_label: string;
  permissions: Permissions;
  training_completed: boolean;
  training_progress: Record<string, boolean>;
  joined_at: string;
}

interface TeamInvite {
  id: string;
  email: string;
  name: string;
  role_label: string;
  token: string;
  status: string;
  permissions: Permissions;
  created_at: string;
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
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Invite form state
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleLabel, setInviteRoleLabel] = useState("");
  const [invitePermsOpen, setInvitePermsOpen] = useState(false);
  const [invitePerms, setInvitePerms] = useState<Permissions>(defaultPermissions());

  // Permissions editor
  const [permEditorOpen, setPermEditorOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  // Remove dialog
  const [removeDialog, setRemoveDialog] = useState<TeamMember | null>(null);

  const isAdmin = userRole === "admin";

  const load = useCallback(async () => {
    if (!orgId) return;
    const [membersRes, invitesRes, tmRes, tiRes] = await Promise.all([
      supabase.from("org_members").select("id, user_id, role, created_at, profiles(display_name)").eq("org_id", orgId),
      supabase.from("invitations").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
      supabase.from("team_members").select("*").eq("org_id", orgId).order("joined_at", { ascending: false }),
      supabase.from("team_invites").select("*").eq("org_id", orgId).order("created_at", { ascending: false }),
    ]);
    setMembers((membersRes.data as any) || []);
    setInvitations((invitesRes.data as any) || []);
    setTeamMembers((tmRes.data as any) || []);
    setTeamInvites((tiRes.data as any) || []);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async () => {
    if (!orgId || !inviteEmail || !inviteName) return;
    setSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    // Insert into team_invites
    const { data: inviteData, error: inviteError } = await supabase.from("team_invites").insert({
      org_id: orgId,
      email: inviteEmail.toLowerCase().trim(),
      name: inviteName.trim(),
      role_label: inviteRoleLabel.trim() || "Member",
      permissions: invitePerms as any,
    }).select().single();

    if (inviteError) {
      toast.error("Failed to create invite");
      setSending(false);
      return;
    }

    // Also create legacy invitation for auth flow
    await supabase.from("invitations").insert({
      org_id: orgId,
      email: inviteEmail.toLowerCase().trim(),
      role: "viewer" as const,
      invited_by: user.id,
    });

    const inviteLink = `${window.location.origin}/join?token=${inviteData.token}`;
    await navigator.clipboard.writeText(inviteLink);
    toast.success(`Invite created! Link copied to clipboard.`);
    
    setInviteName("");
    setInviteEmail("");
    setInviteRoleLabel("");
    setInvitePerms(defaultPermissions());
    setInviteOpen(false);
    load();
    setSending(false);
  };

  const resendInvite = async (invite: TeamInvite) => {
    const link = `${window.location.origin}/join?token=${invite.token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied to clipboard");
  };

  const updateMemberPermissions = async (perms: Permissions) => {
    if (!editingMember) return;
    const { error } = await supabase
      .from("team_members")
      .update({ permissions: perms as any })
      .eq("id", editingMember.id);
    if (error) toast.error("Failed to update permissions");
    else { toast.success("Permissions updated"); load(); }
  };

  const removeMember = async (member: TeamMember) => {
    const { error } = await supabase.from("team_members").delete().eq("id", member.id);
    if (error) toast.error("Failed to remove member");
    else { toast.success("Member removed"); setRemoveDialog(null); load(); }
  };

  const cancelInvite = async (inviteId: string) => {
    const { error } = await supabase.from("team_invites").delete().eq("id", inviteId);
    if (error) toast.error("Failed to cancel invite");
    else { toast.success("Invite cancelled"); load(); }
  };

  const updateMemberRole = async (memberId: string, newRole: "admin" | "viewer") => {
    const { error } = await supabase.from("org_members").update({ role: newRole }).eq("id", memberId);
    if (error) toast.error("Failed to update role");
    else { toast.success("Role updated"); load(); }
  };

  const removeOrgMember = async (memberId: string) => {
    const { error } = await supabase.from("org_members").delete().eq("id", memberId);
    if (error) toast.error("Failed to remove member");
    else { toast.success("Member removed"); load(); }
  };

  const cancelInvitation = async (inviteId: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", inviteId);
    if (error) toast.error("Failed to cancel invitation");
    else { toast.success("Invitation cancelled"); load(); }
  };

  const getTrainingBadge = (tm: TeamMember) => {
    if (tm.training_completed) return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-xs"><Check className="h-3 w-3 mr-1" />Completed</Badge>;
    const progressKeys = Object.values(tm.training_progress || {}).filter(Boolean).length;
    if (progressKeys > 0) return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
    return <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">Not Started</Badge>;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
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
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input placeholder="John Doe" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Email Address</Label>
                  <Input type="email" placeholder="john@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Role Label</Label>
                  <Input placeholder="e.g. Listings Manager, Analyst" value={inviteRoleLabel} onChange={(e) => setInviteRoleLabel(e.target.value)} />
                </div>

                {/* Permissions section */}
                <Collapsible open={invitePermsOpen} onOpenChange={setInvitePermsOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Set Permissions</span>
                        <Badge variant="secondary" className="text-xs">
                          {Object.values(invitePerms).filter(Boolean).length} enabled
                        </Badge>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${invitePermsOpen ? "rotate-180" : ""}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto rounded-lg border p-3">
                      {Object.entries(invitePerms).map(([key, val]) => {
                        const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                        return (
                          <label key={key} className="flex items-center justify-between text-sm cursor-pointer">
                            <span>{label}</span>
                            <input
                              type="checkbox"
                              checked={val}
                              onChange={() => setInvitePerms((p) => ({ ...p, [key]: !val }))}
                              className="accent-primary"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <p className="text-xs text-muted-foreground">
                  An invite link will be generated and copied to your clipboard.
                </p>
                <Button onClick={handleInvite} disabled={!inviteEmail || !inviteName || sending} className="w-full">
                  {sending ? "Creating..." : "Create Invite & Copy Link"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Team Members (from team_members table) */}
      {teamMembers.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Team Members</span>
            <Badge variant="secondary" className="text-xs">{teamMembers.length}</Badge>
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Training</TableHead>
                  {isAdmin && <TableHead className="w-[140px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((tm) => (
                  <TableRow key={tm.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{tm.name}</span>
                        <p className="text-xs text-muted-foreground">{tm.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{tm.role_label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(tm.joined_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>{getTrainingBadge(tm)}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => { setEditingMember(tm); setPermEditorOpen(true); }}
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => setRemoveDialog(tm)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
      )}

      {/* Pending Team Invites */}
      {teamInvites.filter((i) => i.status === "pending").length > 0 && (
        <Card>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <Mail className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-sm">Pending Team Invites</span>
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Sent</TableHead>
                  {isAdmin && <TableHead className="w-[120px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamInvites.filter((i) => i.status === "pending").map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.name}</TableCell>
                    <TableCell className="text-muted-foreground">{inv.email}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{inv.role_label}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(inv.created_at), "dd MMM yyyy")}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => resendInvite(inv)}>
                            <Copy className="h-3.5 w-3.5 mr-1" /> Link
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => cancelInvite(inv.id)}>
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
      )}

      {/* Org Members (existing) */}
      <Card>
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Organization Members</span>
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
                    No members yet.
                  </TableCell>
                </TableRow>
              ) : members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{(m as any).profiles?.display_name || "Unknown"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={m.role === "admin" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"}>
                      {m.role === "admin" ? <><Shield className="h-3 w-3 mr-1" />Admin</> : <><Eye className="h-3 w-3 mr-1" />Viewer</>}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{format(new Date(m.created_at), "dd MMM yyyy")}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Select value={m.role} onValueChange={(v) => updateMemberRole(m.id, v as "admin" | "viewer")}>
                          <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => removeOrgMember(m.id)}>
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

      {/* Legacy Pending Invitations */}
      {invitations.filter((i) => i.status === "pending").length > 0 && (
        <Card>
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <Mail className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-sm">Legacy Invitations</span>
          </div>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  {isAdmin && <TableHead className="w-[60px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.filter((i) => i.status === "pending").map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{inv.role}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                        <Clock className="h-3 w-3 mr-1" />Pending
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(inv.created_at), "dd MMM yyyy")}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => cancelInvitation(inv.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
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

      {/* Permissions Editor Sheet */}
      {editingMember && (
        <PermissionsEditor
          open={permEditorOpen}
          onOpenChange={setPermEditorOpen}
          permissions={editingMember.permissions}
          onSave={updateMemberPermissions}
          memberName={editingMember.name}
        />
      )}

      {/* Remove Confirmation */}
      <Dialog open={!!removeDialog} onOpenChange={() => setRemoveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{removeDialog?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => removeDialog && removeMember(removeDialog)}>
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
