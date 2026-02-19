import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OrgContext {
  orgId: string | null;
  orgName: string | null;
  userRole: "admin" | "viewer" | null;
  loading: boolean;
}

const OrgCtx = createContext<OrgContext>({ orgId: null, orgName: null, userRole: null, loading: true });

export function OrgProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OrgContext>({ orgId: null, orgName: null, userRole: null, loading: true });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState({ orgId: null, orgName: null, userRole: null, loading: false }); return; }

      const { data: membership } = await supabase
        .from("org_members")
        .select("org_id, role, organizations(name)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (membership) {
        setState({
          orgId: membership.org_id,
          orgName: (membership as any).organizations?.name || null,
          userRole: membership.role as "admin" | "viewer",
          loading: false,
        });
      } else {
        setState({ orgId: null, orgName: null, userRole: null, loading: false });
      }
    }
    load();
  }, []);

  return <OrgCtx.Provider value={state}>{children}</OrgCtx.Provider>;
}

export const useOrg = () => useContext(OrgCtx);
