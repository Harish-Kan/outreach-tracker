"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { WORKSPACE_COOKIE } from "@/lib/workspace";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

async function rememberWorkspace(workspaceId: string) {
  const store = await cookies();
  store.set(WORKSPACE_COOKIE, workspaceId, COOKIE_OPTIONS);
}

/**
 * Switches the active workspace.
 *
 * The id arrives from the browser, so membership is confirmed here rather than
 * assumed. getWorkspaceContext() validates the cookie again on every request —
 * this check just gives a clear error instead of a silently ignored switch.
 */
export async function setActiveWorkspace(workspaceId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Not signed in" };

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!membership) {
    return { ok: false as const, message: "You are not a member of that workspace" };
  }

  await rememberWorkspace(workspaceId);
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function createTeamWorkspace(name: string) {
  const supabase = await createClient();

  const { data: workspaceId, error } = await supabase.rpc("create_team_workspace", {
    workspace_name: name,
  });

  if (error) return { ok: false as const, message: error.message };

  // Land the user in the workspace they just made.
  await rememberWorkspace(workspaceId as string);
  revalidatePath("/", "layout");
  return { ok: true as const, workspaceId: workspaceId as string };
}

export async function renameWorkspace(workspaceId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false as const, message: "Name is required" };

  const supabase = await createClient();

  // RLS restricts this to owners and admins.
  const { error } = await supabase
    .from("workspaces")
    .update({ name: trimmed })
    .eq("id", workspaceId);

  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/", "layout");
  return { ok: true as const };
}
