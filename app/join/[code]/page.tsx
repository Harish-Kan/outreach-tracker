import Link from "next/link";
import { JoinInviteButton } from "@/components/workspace-forms";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const MESSAGES: Record<string, string> = {
  not_found: "That invite code does not exist. Check it and try again.",
  revoked: "This invite has been revoked by the workspace owner.",
  expired: "This invite has expired. Ask for a fresh code.",
  exhausted: "This invite has been used the maximum number of times.",
  throttled: "Too many attempts from this network. Wait a few minutes and try again.",
};

/**
 * This page is reachable without signing in, and preview_invite is granted to
 * anon so it can name the workspace before you join. That combination is an
 * open oracle for guessing codes, so it gets a ceiling — keyed on IP, since
 * there is no user to key on yet.
 */
const PREVIEW_LIMIT = 20;
const PREVIEW_WINDOW_MS = 10 * 60 * 1000;

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A signed-in visitor is keyed on their id so that sharing an office IP does
  // not make one person's typo count against everyone else's.
  const limit = rateLimit(
    `preview:${await clientKey(user?.id)}`,
    PREVIEW_LIMIT,
    PREVIEW_WINDOW_MS,
  );

  // preview_invite is security definer, so this works before membership and
  // even before sign-in.
  const { data } = limit.ok
    ? await supabase.rpc("preview_invite", {
        invite_code: code.trim().toLowerCase(),
      })
    : { data: null };

  const preview = Array.isArray(data) ? data[0] : null;
  const status = limit.ok ? (preview?.invite_status ?? "not_found") : "throttled";
  const workspaceName = preview?.workspace_name;

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Join a workspace</h1>

      {status !== "valid" ? (
        <>
          <p className="mt-3 text-sm text-destructive">
            {MESSAGES[status] ?? MESSAGES.not_found}
          </p>
          <Link
            href="/contacts"
            className="mt-6 text-sm underline underline-offset-4"
          >
            Go to your workspace
          </Link>
        </>
      ) : (
        <>
          <p className="mt-3 text-muted-foreground">
            You have been invited to{" "}
            <span className="font-medium text-foreground">{workspaceName}</span>.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            You will be able to see every contact in it, and everyone there will
            see the ones you add. Your own workspaces stay separate — you can
            switch between them at the top of the page.
          </p>

          <div className="mt-6">
            {user ? (
              <JoinInviteButton code={code} />
            ) : (
              <div className="space-y-3">
                <p className="text-sm">Sign in or create an account to join.</p>
                <div className="flex gap-3">
                  <Link
                    href={`/signup?next=/join/${code}`}
                    className="text-sm underline underline-offset-4"
                  >
                    Create account
                  </Link>
                  <Link
                    href={`/login?next=/join/${code}`}
                    className="text-sm underline underline-offset-4"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
