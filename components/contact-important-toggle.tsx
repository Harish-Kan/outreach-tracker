"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StarIcon } from "@/components/contact-table";
import { toggleImportant } from "@/lib/actions/contacts";

/** Pins a contact to the top of every list, whatever sort is applied. */
export function ContactImportantToggle({
  contactId,
  important,
}: {
  contactId: string;
  important: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={important}
      aria-label={important ? "Remove important" : "Mark as important"}
      title={
        error ??
        (important ? "Important — pinned to the top" : "Mark as important")
      }
      onClick={() => {
        setError(null);
        startTransition(async () => {
          const result = await toggleImportant(contactId, !important);
          if (!result.ok) setError(result.message);
          router.refresh();
        });
      }}
      className="text-muted-foreground transition-colors hover:text-amber-500 disabled:opacity-50"
    >
      <StarIcon filled={important} />
    </button>
  );
}
