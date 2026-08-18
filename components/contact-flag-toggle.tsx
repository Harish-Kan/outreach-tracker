"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlagIcon } from "@/components/contact-table";
import { toggleFlagged } from "@/lib/actions/contacts";

/**
 * Marks a contact so its row stands out in the list.
 *
 * Deliberately inert otherwise: no reordering, no filtering, no status change.
 * Important already covers "pin this to the top", and a second control that
 * also reordered things would just fight it.
 */
export function ContactFlagToggle({
  contactId,
  flagged,
}: {
  contactId: string;
  flagged: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={flagged}
      aria-label={flagged ? "Remove flag" : "Flag this contact"}
      title={
        error ??
        (flagged
          ? "Flagged — highlighted, but not reordered"
          : "Flag to make this row stand out")
      }
      onClick={() => {
        setError(null);
        startTransition(async () => {
          const result = await toggleFlagged(contactId, !flagged);
          if (!result.ok) setError(result.message);
          router.refresh();
        });
      }}
      className="text-muted-foreground transition-colors hover:text-rose-500 disabled:opacity-50"
    >
      <FlagIcon filled={flagged} />
    </button>
  );
}
