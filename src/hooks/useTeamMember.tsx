import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Permissions } from "@/lib/permissions";

interface TeamMemberCtx {
  isTeamMember: boolean;
  teamMember: {
    id: string;
    permissions: Permissions;
    training_completed: boolean;
    training_progress: Record<string, boolean>;
    role_label: string;
    name: string;
  } | null;
  loading: boolean;
  refetch: () => void;
}

const Ctx = createContext<TeamMemberCtx>({
  isTeamMember: false,
  teamMember: null,
  loading: true,
  refetch: () => {},
});

export function TeamMemberProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<TeamMemberCtx, "refetch">>({
    isTeamMember: false,
    teamMember: null,
    loading: true,
  });

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setState({ isTeamMember: false, teamMember: null, loading: false });
      return;
    }

    const { data } = await supabase
      .from("team_members")
      .select("*")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (data) {
      setState({
        isTeamMember: true,
        teamMember: {
          id: data.id,
          permissions: (data.permissions || {}) as Permissions,
          training_completed: data.training_completed,
          training_progress: (data.training_progress || {}) as Record<string, boolean>,
          role_label: data.role_label,
          name: data.name,
        },
        loading: false,
      });
    } else {
      setState({ isTeamMember: false, teamMember: null, loading: false });
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <Ctx.Provider value={{ ...state, refetch: load }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTeamMember = () => useContext(Ctx);
