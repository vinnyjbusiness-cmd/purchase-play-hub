import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Loader2 } from "lucide-react";

export default function JoinTeam() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    supabase
      .from("team_invites")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data }) => {
        setInvite(data);
        setLoading(false);
      });
  }, [token]);

  const handleJoin = async () => {
    if (!invite || !password || password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSubmitting(true);
    try {
      // Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: { display_name: invite.name },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Signup failed");

      // Create team_members record
      const { error: tmError } = await supabase.from("team_members").insert({
        org_id: invite.org_id,
        user_id: authData.user.id,
        name: invite.name,
        email: invite.email,
        role_label: invite.role_label,
        permissions: invite.permissions,
      });

      // Mark invite as accepted
      await supabase
        .from("team_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      toast.success("Account created! Check your email to verify, then log in.");
      navigate("/auth");
    } catch (e: any) {
      toast.error(e.message || "Failed to create account");
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token || !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-muted-foreground">This invite link is invalid or has expired.</p>
            <Button variant="outline" onClick={() => navigate("/auth")}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Join VJX Portal</CardTitle>
          <CardDescription>
            You've been invited to join as{" "}
            <Badge variant="outline" className="ml-1">{invite.role_label}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={invite.name} disabled />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={invite.email} disabled />
          </div>
          <div className="space-y-1">
            <Label>Create Password</Label>
            <Input
              type="password"
              placeholder="Min 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Confirm Password</Label>
            <Input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button onClick={handleJoin} disabled={submitting} className="w-full">
            {submitting ? "Creating Account..." : "Create Account & Join"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
