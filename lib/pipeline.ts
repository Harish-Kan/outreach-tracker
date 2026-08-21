import type { ContactStatus } from "@/types/database";

/**
 * Every status, in pipeline order. The one place the list is written down.
 *
 * The status validation schema and the filter dropdown both derive from this,
 * because adding 'follow_up_needed' in migration 0012 and forgetting to add it
 * to the schema made every attempt to set it fail with "Invalid status change".
 */
export const CONTACT_STATUSES = [
  "added",
  "reached_out",
  "responded",
  "chat_booked",
  "chat_completed",
  "follow_up_needed",
  "no_response",
  "not_interested",
] as const satisfies readonly ContactStatus[];

/**
 * added → reached_out → responded → chat_booked → chat_completed
 *               ↓            ↓            ↓             ↓
 *         no_response   not_interested    follow_up_needed
 *               ↓                              ↓
 *         (back to reached_out)      (back into the pipeline)
 *
 * follow_up_needed is not a stage of the funnel so much as a flag on it: the
 * ball is in our court. It is reachable from everywhere real work happens, and
 * leads back to whatever comes next once the follow-up is done.
 */
export const NEXT_STATUSES: Record<ContactStatus, ContactStatus[]> = {
  added: ["reached_out", "not_interested"],
  reached_out: [
    "responded",
    "follow_up_needed",
    "no_response",
    "not_interested",
  ],
  responded: [
    "chat_booked",
    "follow_up_needed",
    "no_response",
    "not_interested",
  ],
  chat_booked: [
    "chat_completed",
    "follow_up_needed",
    "no_response",
    "not_interested",
  ],
  // Previously a dead end. A completed chat often leaves something owed.
  chat_completed: ["follow_up_needed", "not_interested"],
  follow_up_needed: [
    "reached_out",
    "responded",
    "chat_booked",
    "no_response",
    "not_interested",
  ],
  no_response: [
    "reached_out",
    "responded",
    "follow_up_needed",
    "not_interested",
  ],
  // Not a one-way door. It is one click away from every other status and is
  // therefore easy to set by accident, so it has to be easy to undo — a
  // contact stuck here forever because of a misclick is a worse outcome than
  // an extra correcting line in the timeline.
  not_interested: ["reached_out", "responded", "follow_up_needed"],
};

/** Statuses that still expect something from us, used by "needs follow-up". */
export const ACTIVE_STATUSES: ContactStatus[] = [
  "reached_out",
  "responded",
  "follow_up_needed",
];

/**
 * The single status change offered from the contact list, or null if the badge
 * should not be clickable.
 *
 * Deliberately just the first step of the funnel, in both directions. Marking
 * someone as contacted is the thing done dozens of times in a sitting and the
 * thing most worth saving a page load on; it is also the only change that is
 * unambiguous from a list, since "reached out" needs no extra context.
 *
 * Everything past it — replied, booked, not interested — is a judgement about
 * something that happened, and belongs on the contact page where there is room
 * to choose the right one and write a note. Cycling the whole pipeline from a
 * table row would mostly generate mistakes in an append-only timeline.
 */
export function toggleStatus(current: ContactStatus): ContactStatus | null {
  if (current === "added") return "reached_out";
  // The undo half: a misclick on a row should be one click to put right.
  if (current === "reached_out") return "added";
  return null;
}
