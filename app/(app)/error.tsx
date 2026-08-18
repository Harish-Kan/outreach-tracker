"use client";

/**
 * Catches failures inside the app shell.
 *
 * Exists so a broken query shows what went wrong instead of redirecting to
 * /login, which the proxy would bounce straight back into an endless loop.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-12">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">{error.message}</p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={reset}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Try again
        </button>
        <a
          href="/login"
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Back to sign in
        </a>
      </div>
    </div>
  );
}
