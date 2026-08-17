"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = { error: string } | undefined;

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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
