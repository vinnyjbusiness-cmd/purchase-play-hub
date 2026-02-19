import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for a password reset link.");
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "forgot" ? "Reset Password" : mode === "login" ? "Sign In" : "Sign Up";
  const description =
    mode === "forgot"
      ? "Enter your email and we'll send a reset link"
      : mode === "login"
      ? "Sign in to your account"
      : "Create a new account";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Ticket className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {mode !== "forgot" && (
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Loading..."
                : mode === "forgot"
                ? "Send Reset Link"
                : mode === "login"
                ? "Sign In"
                : "Sign Up"}
            </Button>
          </form>
          {mode === "login" && (
            <button
              onClick={() => setMode("forgot")}
              className="mt-3 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Forgot password?
            </button>
          )}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="mt-2 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
          {mode === "forgot" && (
            <button
              onClick={() => setMode("login")}
              className="mt-1 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to Sign In
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
