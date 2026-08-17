import Link from "next/link";
import { SignUpForm } from "@/components/auth-forms";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next ?? "/contacts";

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        You get a personal workspace straight away — no setup.
      </p>

      <SignUpForm next={target} />

      <p className="mt-6 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(target)}`}
          className="underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
