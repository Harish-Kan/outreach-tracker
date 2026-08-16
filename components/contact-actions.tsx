"use client";

import { useState, useTransition } from "react";
import { advanceStatus, takeOwnership } from "@/lib/actions/contacts";
import { addNote } from "@/lib/actions/interactions";
import { statusLabel } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ContactStatus } from "@/types/database";

export function ContactActions({
  contactId,
  nextStatuses,
  isOwner,
  ownerName,
}: {
  contactId: string;
  nextStatuses: ContactStatus[];
  isOwner: boolean;
  ownerName: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message ?? "Something went wrong");
    });
  }

  return (
    <div className="space-y-6">
      {/* Ownership. Taking over is allowed but always logged, so the timeline
          shows the handoff rather than the contact quietly changing hands. */}
      {!isOwner && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/50">
          <p>
            {ownerName
              ? `${ownerName} owns this contact.`
              : "Nobody owns this contact yet."}{" "}
            Take it over before logging outreach.
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => takeOwnership(contactId))}
          >
            {ownerName ? "Take over" : "Claim contact"}
          </Button>
        </div>
      )}

      {nextStatuses.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Advance status</p>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((status) => (
              <Button
                key={status}
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    advanceStatus({ contact_id: contactId, status, note: "" }),
                  )
                }
              >
                {statusLabel(status)}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Add a note</p>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="What happened?"
        />
        <Button
          size="sm"
          disabled={pending || note.trim().length === 0}
          onClick={() =>
            run(async () => {
              const result = await addNote({
                contact_id: contactId,
                note,
              });
              if (result.ok) setNote("");
              return result;
            })
          }
        >
          {pending ? "Saving…" : "Add note"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
