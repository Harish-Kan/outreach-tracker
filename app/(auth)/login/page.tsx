import Link from "next/link";
import { SignInForm } from "@/components/auth-forms";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = next ?? "/contacts";

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Outreach Tracker</p>

      {/* Set by the /auth/* routes when a confirmation link fails, so a broken
          link says why instead of silently dumping the user here. */}
      {error && (
        <p
          className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      <SignInForm next={target} />

      <p className="mt-6 text-sm text-muted-foreground">
        <Link
          href="/forgot-password"
          className="underline underline-offset-4"
        >
          Forgot your password?
        </Link>
      </p>

      <p className="mt-2 text-sm text-muted-foreground">
        No account?{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(target)}`}
          className="underline underline-offset-4"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
