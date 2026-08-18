import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, WorkspaceRow } from "@/types/database";

export const WORKSPACE_COOKIE = "active_workspace";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type CookieStore = Awaited<ReturnType<typeof cookies>>;

export type WorkspaceOption = {
  workspace: WorkspaceRow;
  role: MemberRole;
  memberCount: number;
};

export type WorkspaceContext = {
  supabase: SupabaseServerClient;
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

/** PostgREST's code for "that function is not in the schema cache". */
const FUNCTION_MISSING = "PGRST202";

function assemble(
  supabase: SupabaseServerClient,
  cookieStore: CookieStore,
  userId: string,
  options: WorkspaceOption[],
): WorkspaceContext | null {
  if (!options.length) return null;

  const requestedId = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const active =
    options.find((option) => option.workspace.id === requestedId) ?? options[0];

  return {
    supabase,
    userId,
    workspace: active.workspace,
    role: active.role,
    options,
    memberCount: active.memberCount,
    isShared: active.memberCount > 1,
    canAdminister: active.role === "owner" || active.role === "admin",
  };
}

/**
 * The original path: four sequential round trips.
 *
 * Kept as a fallback so that deploying code ahead of its migration degrades to
 * "slower" rather than "the whole app is down".
 */
async function fallbackContext(
  supabase: SupabaseServerClient,
  cookieStore: CookieStore,
): Promise<WorkspaceContext | null> {
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

  const [{ data: workspaces }, { data: allMembers }] = await Promise.all([
    supabase
      .from("workspaces")
      .select("*")
      .in("id", memberships.map((m) => m.workspace_id)),
    // One query for every membership row in those workspaces, counted in
    // memory, rather than a count query per workspace.
    supabase
      .from("memberships")
      .select("workspace_id")
      .in("workspace_id", memberships.map((m) => m.workspace_id)),
  ]);

  const byId = new Map((workspaces ?? []).map((w) => [w.id, w]));

  const counts = new Map<string, number>();
  for (const row of allMembers ?? []) {
    counts.set(row.workspace_id, (counts.get(row.workspace_id) ?? 0) + 1);
  }

  const options: WorkspaceOption[] = [];
  for (const membership of memberships) {
    const workspace = byId.get(membership.workspace_id);
    if (!workspace) continue;
    options.push({
      workspace,
      role: membership.role,
      memberCount: counts.get(workspace.id) ?? 1,
    });
  }

  return assemble(supabase, cookieStore, user.id, options);
}

/**
 * Resolves which workspace the request is operating on, in a single round trip.
 *
 * The cookie is a *request*, never an authority: it is validated against the
 * memberships actually returned. Trusting it blindly would leave someone who
 * left a workspace staring at empty lists with no explanation.
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

  if (error) {
    if (error.code === FUNCTION_MISSING) {
      return fallbackContext(supabase, cookieStore);
    }

    // Anything else is a real failure. Returning null would send the caller to
    // /login, which the proxy bounces straight back — an infinite redirect.
    // Fail loudly so the error boundary can show what actually went wrong.
    throw new Error(`Could not load your workspaces: ${error.message}`);
  }

  if (!rows?.length) return null;

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

  return assemble(supabase, cookieStore, rows[0].user_id, options);
}

/**
 * Same, but for routes that cannot render without a workspace.
 */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const context = await getWorkspaceContext();
  if (!context) redirect("/login");
  return context;
}
