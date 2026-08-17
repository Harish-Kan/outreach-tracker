"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = { error?: string; notice?: string } | undefined;

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
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");

  const { data, error } = await supabase.auth.signUp({
    email,
    password: String(formData.get("password") ?? ""),
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

  if (password.length < 8) {
    return { error: "Use at least 8 characters" };
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
