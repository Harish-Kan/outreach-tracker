import type { ContactStatus } from "@/types/database";

/**
 * added → reached_out → responded → chat_booked → chat_completed
 *               ↓            ↓
 *         no_response   not_interested
 *               ↓
 *         (back to reached_out on follow-up)
 */
export const NEXT_STATUSES: Record<ContactStatus, ContactStatus[]> = {
  added: ["reached_out", "not_interested"],
  reached_out: ["responded", "no_response", "not_interested"],
  responded: ["chat_booked", "no_response", "not_interested"],
  chat_booked: ["chat_completed", "no_response", "not_interested"],
  chat_completed: [],
  no_response: ["reached_out", "responded", "not_interested"],
  not_interested: [],
};

/** Statuses that still expect something from us, used by "needs follow-up". */
export const ACTIVE_STATUSES: ContactStatus[] = ["reached_out", "responded"];
