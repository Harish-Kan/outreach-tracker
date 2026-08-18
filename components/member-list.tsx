"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeMember } from "@/lib/actions/workspace";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { MemberRole } from "@/types/database";

export type MemberRow = {
  id: string;
  userId: string;
  name: string;
  role: MemberRole;
  joinedAt: string;
};

export function MemberList({
  members,
  currentUserId,
  canRemove,
}: {
  members: MemberRow[];
  currentUserId: string;
  /** Owners and admins only; everyone else just sees the list. */
  canRemove: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(member: MemberRow) {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await removeMember(member.userId);

      if (!result.ok) {
        setError(result.message);
        setConfirming(null);
        return;
      }

      setNotice(
        result.releasedContacts > 0
          ? `${member.name} was removed. ${result.releasedContacts} of their ${
              result.releasedContacts === 1 ? "contact is" : "contacts are"
            } now unclaimed and can be taken over.`
          : `${member.name} was removed.`,
      );
      setConfirming(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {members.map((member) => {
          const isSelf = member.userId === currentUserId;
          // The owner cannot be removed: nobody would be left who can
          // administer or delete the workspace.
          const removable = canRemove && !isSelf && member.role !== "owner";

          return (
            <li key={member.id} className="p-4 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">
                  {member.name}
                  {isSelf && (
                    <span className="ms-2 text-muted-foreground">you</span>
                  )}
                </span>
                <span className="text-muted-foreground">{member.role}</span>

                <span className="ms-auto flex items-center gap-3">
                  <span className="text-muted-foreground">
                    joined {formatDate(member.joinedAt)}
                  </span>

                  {removable && confirming !== member.id && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setError(null);
                        setConfirming(member.id);
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </span>
              </div>

              {confirming === member.id && (
                <div className="mt-3 space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                  <p>
                    Remove <span className="font-medium">{member.name}</span>{" "}
                    from this workspace? They lose access to every contact in
                    it, and any contacts they own become unclaimed so someone
                    else can take them over. Their history stays in the
                    timelines.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => remove(member)}
                    >
                      {pending ? "Removing…" : "Remove"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => setConfirming(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
