import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import type { DuplicateMatch } from "@/lib/actions/contacts";

/**
 * The whole point of the app, rendered.
 *
 * Shown on blur of the LinkedIn field and again if the insert loses a race to
 * the unique index. Always names the owner, because "someone has them" is much
 * less useful than "Priya has them, and they already replied".
 */
export function DuplicateNotice({ match }: { match: DuplicateMatch }) {
  const owner = match.is_mine
    ? "you"
    : (match.owner_name ?? "nobody yet — this contact is unclaimed");

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        Already in this workspace
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-medium">
          {match.first_name} {match.last_name}
        </span>
        <StatusBadge status={match.status} />
      </div>

      <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/80">
        Owned by {owner}.
      </p>

      <Link
        href={`/contacts/${match.id}`}
        className="mt-3 inline-block text-sm font-medium underline underline-offset-4"
      >
        Open their record →
      </Link>
    </div>
  );
}
