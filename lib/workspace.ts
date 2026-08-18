import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, WorkspaceRow } from "@/types/database";

export const WORKSPACE_COOKIE = "active_workspace";

export type WorkspaceOption = {
  workspace: WorkspaceRow;
  role: MemberRole;
  memberCount: number;
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
 * Resolves which workspace the request is operating on, in a single round trip.
 *
 * The cookie is a *request*, never an authority: it is validated against the
 * memberships the RPC actually returns. Trusting it blindly would leave someone
 * who left a workspace staring at empty lists with no explanation.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const supabase = await createClient();

  // One call replaces getUser + memberships + workspaces + member count. The
  // RPC filters on auth.uid() itself, so an unauthenticated request gets no
  // rows rather than someone else's.
  const [{ data: rows, error }, cookieStore] = await Promise.all([
    supabase.rpc("workspace_context"),
    cookies(),
  ]);

  if (error || !rows?.length) return null;

  const options: WorkspaceOption[] = rows.map((row) => ({
    workspace: {
      id: row.workspace_id,
      name: row.name,
      type: row.type,
      created_by: row.created_by,
      created_at: row.created_at,
    },
    role: row.role,
    memberCount: Number(row.member_count),
  }));

  const requestedId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const active =
    options.find((option) => option.workspace.id === requestedId) ?? options[0];

  return {
    supabase,
    userId: rows[0].user_id,
    workspace: active.workspace,
    role: active.role,
    options,
    memberCount: active.memberCount,
    isShared: active.memberCount > 1,
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
