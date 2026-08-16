import { formatDateTime } from "@/lib/format";
import type { InteractionType } from "@/types/database";

const LABELS: Record<InteractionType, string> = {
  reached_out: "Reached out",
  follow_up_sent: "Sent a follow-up",
  replied: "They replied",
  chat_booked: "Booked a chat",
  chat_completed: "Completed the chat",
  marked_no_response: "Marked as no response",
  marked_not_interested: "Marked as not interested",
  note_added: "Added a note",
  ownership_changed: "Ownership changed",
};

export type TimelineEntry = {
  id: string;
  type: InteractionType;
  note: string | null;
  occurred_at: string;
  actor_name: string | null;
};

/**
 * Append-only history, newest first. Every status change writes one of these,
 * so this is the record of who did what — the answer to "who reached out
 * to who, and when".
 */
export function InteractionTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (!entries.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing logged yet. Advancing the status or adding a note will show up
        here.
      </p>
    );
  }

  return (
    <ol className="space-y-0">
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
          <div className="flex flex-col items-center">
            <span
              className="mt-1.5 size-2.5 shrink-0 rounded-full bg-foreground/70"
              aria-hidden
            />
            {index < entries.length - 1 && (
              <span className="mt-1 w-px flex-1 bg-border" aria-hidden />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{LABELS[entry.type]}</p>
            <p className="text-xs text-muted-foreground">
              {entry.actor_name ?? "Someone"} · {formatDateTime(entry.occurred_at)}
            </p>
            {entry.note && (
              <p className="mt-2 whitespace-pre-wrap text-sm">{entry.note}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
