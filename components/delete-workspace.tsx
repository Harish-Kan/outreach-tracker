"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteWorkspace } from "@/lib/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Typed confirmation rather than a yes/no dialog. This is not "delete one
 * thing" — it destroys every contact and every timeline in the workspace, for
 * everyone in it, and there is no undo.
 */
export function DeleteWorkspace({
  workspaceId,
  workspaceName,
  contactCount,
  memberCount,
  isOnlyWorkspace,
}: {
  workspaceId: string;
  workspaceName: string;
  contactCount: number;
  memberCount: number;
  isOnlyWorkspace: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (isOnlyWorkspace) {
    return (
      <p className="text-sm text-muted-foreground">
        This is your only workspace, so it cannot be deleted — you would be left
        with nowhere to go. Create or join another one first.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => {
            setError(null);
            setTyped("");
            setOpen(true);
          }}
        >
          Delete this workspace
        </Button>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="space-y-2 text-sm">
        <p className="font-medium">
          Are you sure you want to delete {workspaceName}?
        </p>
        <p>
          This permanently deletes{" "}
          <span className="font-medium">
            {contactCount} {contactCount === 1 ? "contact" : "contacts"}
          </span>{" "}
          and their entire timelines, every invite code, and removes all{" "}
          {memberCount} {memberCount === 1 ? "member" : "members"} from it.
          Everyone loses this data, not just you. It cannot be undone.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm_workspace">
          Type <span className="font-mono">{workspaceName}</span> to confirm
        </Label>
        <Input
          id="confirm_workspace"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          size="sm"
          disabled={pending || typed.trim() !== workspaceName}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await deleteWorkspace(workspaceId, typed);
              if (!result.ok) {
                setError(result.message);
                return;
              }
              router.push("/contacts");
              router.refresh();
            });
          }}
        >
          {pending ? "Deleting…" : "Delete workspace permanently"}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
