"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteContact } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";

/**
 * Two-step confirm. Deleting a contact cascades to every interaction on them,
 * and `interactions` is append-only precisely because that history is the
 * record of who spoke to whom — so this is worth an extra click.
 */
export function DeleteContact({
  contactId,
  name,
}: {
  contactId: string;
  name: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          Delete contact
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
    <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-sm">
        Delete <span className="font-medium">{name}</span> and their entire
        timeline? This cannot be undone.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await deleteContact(contactId);
              if (!result.ok) {
                setError(result.message);
                setConfirming(false);
                return;
              }
              router.push("/contacts");
              router.refresh();
            });
          }}
        >
          {pending ? "Deleting…" : "Delete permanently"}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
