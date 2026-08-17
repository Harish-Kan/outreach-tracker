"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInvite, revokeInvite } from "@/lib/actions/invites";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export type InviteRow = {
  id: string;
  code: string;
  expires_at: string;
  max_uses: number;
  uses_count: number;
};

export function InviteManager({
  invites,
  origin,
}: {
  invites: InviteRow[];
  /** Passed from the server so the join link is right in any environment. */
  origin: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await createInvite();
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  function revoke(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeInvite(id);
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard can be blocked; the code is on screen to copy by hand.
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={generate} disabled={pending} size="sm">
          {pending ? "Working…" : "Generate invite code"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Codes last 7 days and allow up to 25 people.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active codes. Generate one and share it with your team.
        </p>
      ) : (
        <ul className="space-y-3">
          {invites.map((invite) => {
            const link = `${origin}/join/${invite.code}`;
            return (
              <li key={invite.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <code className="rounded bg-muted px-2 py-1 font-mono text-base tracking-widest">
                    {invite.code}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy(invite.code, `code-${invite.id}`)}
                  >
                    {copied === `code-${invite.id}` ? "Copied" : "Copy code"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy(link, `link-${invite.id}`)}
                  >
                    {copied === `link-${invite.id}` ? "Copied" : "Copy link"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => revoke(invite.id)}
                    className="ms-auto"
                  >
                    Revoke
                  </Button>
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  {invite.uses_count} of {invite.max_uses} used · expires{" "}
                  {formatDate(invite.expires_at)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
