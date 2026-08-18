"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clientKey, rateLimit, tooManyMessage } from "@/lib/rate-limit";
import { requireWorkspace, WORKSPACE_COOKIE } from "@/lib/workspace";

/**
 * An invite code is a bearer token: whoever holds it sees every contact and
 * every note in the workspace, so the database default of 25 uses is far more
 * than a string pasted into a group chat should carry. The uses cap is what
 * actually bounds the damage of a leak — a code that admits five people is a
 * much smaller problem than one that admits twenty-five.
 *
 * The week-long lifetime is deliberately left alone. Shortening it mostly
 * annoys somebody who accepts on Monday a code sent on Friday, and revoking is
 * already one click for the case where a code is known to have escaped.
 */
const INVITE_LIFETIME_DAYS = 7;
const INVITE_MAX_USES = 5;

/** Codes are ~49 bits of entropy, so this is about stopping the loop, not the guess. */
const REDEEM_LIMIT = 10;
const REDEEM_WINDOW_MS = 10 * 60 * 1000;

export async function createInvite() {
  const { supabase, workspace, userId, canAdminister } = await requireWorkspace();

  if (!canAdminister) {
    return { ok: false as const, message: "Only owners and admins can invite people" };
  }

  const expiresAt = new Date(
    Date.now() + INVITE_LIFETIME_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // `code` is left out on purpose: the column defaults to gen_invite_code(),
  // so codes are generated in the database and never guessed by the client.
  const { data, error } = await supabase
    .from("invites")
    .insert({
      workspace_id: workspace.id,
      created_by: userId,
      expires_at: expiresAt,
      max_uses: INVITE_MAX_USES,
    })
    .select("code")
    .single();

  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/settings/workspace");
  return { ok: true as const, code: data.code };
}

export async function revokeInvite(inviteId: string) {
  const { supabase } = await requireWorkspace();

  const { error } = await supabase
    .from("invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);

  if (error) return { ok: false as const, message: error.message };

  revalidatePath("/settings/workspace");
  return { ok: true as const };
}

/**
 * Redeems a code and switches to the workspace it belongs to.
 *
 * All the validation — expiry, revocation, uses remaining — lives in the
 * redeem_invite RPC, because the joining user cannot read the invite row until
 * the moment they become a member.
 */
export async function joinWithCode(rawCode: string) {
  const code = rawCode.trim().toLowerCase();
  if (!code) return { ok: false as const, message: "Enter an invite code" };

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Sign in first" };

  const limit = rateLimit(
    await clientKey(user.id),
    REDEEM_LIMIT,
    REDEEM_WINDOW_MS,
  );
  if (!limit.ok) {
    return {
      ok: false as const,
      message: tooManyMessage(limit.retryAfter, "invite attempts"),
    };
  }

  const { data: workspaceId, error } = await supabase.rpc("redeem_invite", {
    invite_code: code,
  });

  if (error) {
    // The RPC raises readable messages: expired, revoked, no uses left.
    return { ok: false as const, message: error.message };
  }

  const store = await cookies();
  store.set(WORKSPACE_COOKIE, workspaceId as string, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  return { ok: true as const, workspaceId: workspaceId as string };
}
