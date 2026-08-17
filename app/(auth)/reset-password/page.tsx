import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth-forms";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createClient();

  // Arriving here without a session means the link expired, was already used,
  // or someone navigated to the URL directly. Say so plainly rather than
  // showing a form that cannot work.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Set a new password</h1>

      {user ? (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {user.email}. At least 8 characters.
          </p>
          <ResetPasswordForm />
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-destructive">
            This reset link has expired or has already been used.
          </p>
          <p className="mt-4 text-sm">
            <Link
              href="/forgot-password"
              className="underline underline-offset-4"
            >
              Request a new link
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
