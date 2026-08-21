import { describe, expect, it } from "vitest";
import { statusTransitionSchema } from "./schemas/contact";
import { CONTACT_STATUSES, NEXT_STATUSES, nextStatus } from "./pipeline";

const CONTACT_ID = "00000000-0000-4000-8000-000000000000";

describe("CONTACT_STATUSES", () => {
  // Regression: 'follow_up_needed' was added to the database and the UI but
  // not to statusTransitionSchema, so every attempt to set it was rejected by
  // validation before it reached the RPC. The schema now derives from this
  // list; this test fails if the two are ever separated again.
  it("is accepted in full by the status transition schema", () => {
    for (const status of CONTACT_STATUSES) {
      const result = statusTransitionSchema.safeParse({
        contact_id: CONTACT_ID,
        status,
      });
      expect(result.success, `schema rejected "${status}"`).toBe(true);
    }
  });

  it("has a transition list for every status", () => {
    for (const status of CONTACT_STATUSES) {
      expect(NEXT_STATUSES[status], `no entry for "${status}"`).toBeDefined();
    }
  });

  it("declares no status the pipeline does not know about", () => {
    expect(Object.keys(NEXT_STATUSES).sort()).toEqual(
      [...CONTACT_STATUSES].sort(),
    );
  });
});

describe("NEXT_STATUSES", () => {
  it("only ever points at real statuses", () => {
    for (const [from, targets] of Object.entries(NEXT_STATUSES)) {
      for (const target of targets) {
        expect(
          CONTACT_STATUSES,
          `"${from}" points at unknown status "${target}"`,
        ).toContain(target);
      }
    }
  });

  // Every status has to be escapable. 'not_interested' and 'chat_completed'
  // were both dead ends, which meant one misclick stranded a contact there
  // permanently with no way back through the UI.
  it("leaves no status without a way out", () => {
    for (const status of CONTACT_STATUSES) {
      expect(
        NEXT_STATUSES[status].length,
        `"${status}" is a dead end`,
      ).toBeGreaterThan(0);
    }
  });

  it("never offers a transition to itself", () => {
    for (const status of CONTACT_STATUSES) {
      expect(NEXT_STATUSES[status]).not.toContain(status);
    }
  });
});

describe("nextStatus", () => {
  it("returns the first transition, which is the happy path", () => {
    expect(nextStatus("added")).toBe("reached_out");
    expect(nextStatus("reached_out")).toBe("responded");
    expect(nextStatus("responded")).toBe("chat_booked");
    expect(nextStatus("chat_booked")).toBe("chat_completed");
  });

  it("gives every status somewhere to go on a single click", () => {
    for (const status of CONTACT_STATUSES) {
      expect(nextStatus(status), `"${status}" advances nowhere`).not.toBeNull();
    }
  });
});
