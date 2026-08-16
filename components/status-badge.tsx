import { Badge } from "@/components/ui/badge";
import type { ContactStatus } from "@/types/database";

const LABELS: Record<ContactStatus, string> = {
  added: "Added",
  reached_out: "Reached out",
  responded: "Responded",
  chat_booked: "Chat booked",
  chat_completed: "Chat completed",
  no_response: "No response",
  not_interested: "Not interested",
};

// Cool greys for "nothing has happened yet", warming through the pipeline to
// green at a completed chat, with the two closed states muted.
const STYLES: Record<ContactStatus, string> = {
  added: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  reached_out:
    "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  responded:
    "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200",
  chat_booked:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  chat_completed:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  no_response:
    "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200",
  not_interested:
    "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200",
};

export function statusLabel(status: ContactStatus) {
  return LABELS[status];
}

export function StatusBadge({ status }: { status: ContactStatus }) {
  return (
    <Badge variant="outline" className={STYLES[status]}>
      {LABELS[status]}
    </Badge>
  );
}
