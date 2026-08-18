"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clientKey, rateLimit, tooManyMessage } from "@/lib/rate-limit";

export type AuthResult = { error?: string; notice?: string } | undefined;

/**
 * Supabase Auth applies its own limits to these endpoints, so these are a
 * second layer rather than the only one — they refuse the request before it
 * costs a network round trip, and they are tighter than the platform defaults
 * on the two that cost real money or real inbox noise.
 */
const SIGN_IN_LIMIT = 10;
const SIGN_UP_LIMIT = 5;
const RESET_LIMIT = 4;
const AUTH_WINDOW_MS = 15 * 60 * 1000;

/** The shortest password worth allowing; Supabase's own floor is set separately. */
const MIN_PASSWORD_LENGTH = 8;

/** The deployed origin, so reset links do not point at localhost in production. */
async function currentOrigin() {
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

/**
 * Only same-site relative paths. Without this check, `?next=https://evil.tld`
 * would turn the login form into an open redirect.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//")) return "/contacts";
  return next;
}

export async function signIn(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const limit = rateLimit(
    `signin:${await clientKey()}`,
    SIGN_IN_LIMIT,
    AUTH_WINDOW_MS,
  );
  if (!limit.ok) return { error: tooManyMessage(limit.retryAfter, "sign-in attempts") };

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const limit = rateLimit(
    `signup:${await clientKey()}`,
    SIGN_UP_LIMIT,
    AUTH_WINDOW_MS,
  );
  if (!limit.ok) return { error: tooManyMessage(limit.retryAfter, "sign-up attempts") };

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters` };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user trigger to name the profile and the
      // personal workspace it creates.
      data: { full_name: String(formData.get("full_name") ?? "").trim() },
    },
  });

  if (error) return { error: error.message };

  // With email confirmation enabled there is no session yet — the user has to
  // click the link first.
  if (!data.session) {
    return { error: "Check your email to confirm your account, then sign in." };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function requestPasswordReset(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address" };

  // Without this, one script can send an unlimited number of reset emails to
  // somebody else's inbox using nothing but their address.
  const limit = rateLimit(
    `reset:${await clientKey()}`,
    RESET_LIMIT,
    AUTH_WINDOW_MS,
  );
  if (!limit.ok) return { error: tooManyMessage(limit.retryAfter, "reset requests") };

  const supabase = await createClient();
  const origin = await currentOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Lands on the callback, which exchanges the code for a session and then
    // forwards to the form where the new password is set.
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) return { error: error.message };

  // Deliberately the same message whether or not the address exists — telling
  // a stranger which emails have accounts is an information leak.
  return {
    notice: "If that email has an account, a reset link is on its way.",
  };
}

export async function updatePassword(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (password !== confirmation) {
    return { error: "Those passwords do not match" };
  }

  const supabase = await createClient();

  // The reset link created a session. No session means the link expired or was
  // already used, and updateUser would fail with something cryptic.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "That reset link has expired. Request a new one and try again.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/contacts");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
