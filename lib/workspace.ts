import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, WorkspaceRow } from "@/types/database";

export const WORKSPACE_COOKIE = "active_workspace";

export type WorkspaceOption = {
  workspace: WorkspaceRow;
  role: MemberRole;
};

export type WorkspaceContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  workspace: WorkspaceRow;
  role: MemberRole;
  options: WorkspaceOption[];
  memberCount: number;
  /**
   * Whether to show ownership columns, /team, and "who added who".
   *
   * Driven by member count rather than workspace.type, because a personal
   * workspace someone has been invited into is shared in every way that
   * matters, even though its type is still 'personal'.
   */
  isShared: boolean;
  canAdminister: boolean;
};

/**
 * Resolves which workspace the request is operating on.
 *
 * The cookie is a *request*, never an authority: it is validated against the
 * user's actual memberships every time. Trusting it blindly would leave someone
 * who left a workspace staring at empty lists with no explanation.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("memberships")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  if (!memberships?.length) return null;

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("*")
    .in(
      "id",
      memberships.map((m) => m.workspace_id),
    );

  if (!workspaces?.length) return null;

  const byId = new Map(workspaces.map((w) => [w.id, w]));
  const options: WorkspaceOption[] = memberships
    .map((m) => {
      const workspace = byId.get(m.workspace_id);
      return workspace ? { workspace, role: m.role } : null;
    })
    .filter((option): option is WorkspaceOption => option !== null);

  if (!options.length) return null;

  const requestedId = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const active =
    options.find((option) => option.workspace.id === requestedId) ?? options[0];

  const { count } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", active.workspace.id);

  const memberCount = count ?? 1;

  return {
    supabase,
    userId: user.id,
    workspace: active.workspace,
    role: active.role,
    options,
    memberCount,
    isShared: memberCount > 1,
    canAdminister: active.role === "owner" || active.role === "admin",
  };
}

/**
 * Same, but for routes that cannot render without a workspace.
 */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login");
  return context;
}
