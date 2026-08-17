import Link from "next/link";
import { SignInForm } from "@/components/auth-forms";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next ?? "/contacts";

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Outreach Tracker</p>

      <SignInForm next={target} />

      <p className="mt-6 text-sm text-muted-foreground">
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
