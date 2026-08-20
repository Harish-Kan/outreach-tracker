import type { ContactStatus } from "@/types/database";

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
  chat_completed: ["follow_up_needed"],
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
  not_interested: [],
};

/** Statuses that still expect something from us, used by "needs follow-up". */
export const ACTIVE_STATUSES: ContactStatus[] = [
  "reached_out",
  "responded",
  "follow_up_needed",
];
