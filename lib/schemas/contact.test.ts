import { describe, expect, it } from "vitest";
import {
  contactFormSchema,
  EMAIL_INVALID,
  IDENTIFIER_REQUIRED,
  LINKEDIN_INVALID,
} from "./contact";

const base = {
  first_name: "John",
  last_name: "Smith",
  linkedin_url: "",
  email: "",
  company: "",
  title: "",
  notes: "",
  mark_as_reached_out: false,
};

function errorsFor(overrides: Partial<typeof base>) {
  const result = contactFormSchema.safeParse({ ...base, ...overrides });
  if (result.success) return {};
  const byField: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0]);
    (byField[key] ??= []).push(issue.message);
  }
  return byField;
}

describe("contactFormSchema identifiers", () => {
  it("accepts a LinkedIn URL alone", () => {
    expect(
      contactFormSchema.safeParse({
        ...base,
        linkedin_url: "linkedin.com/in/johnsmith",
      }).success,
    ).toBe(true);
  });

  it("accepts an email alone", () => {
    expect(
      contactFormSchema.safeParse({ ...base, email: "john@example.com" })
        .success,
    ).toBe(true);
  });

  it("accepts both together", () => {
    expect(
      contactFormSchema.safeParse({
        ...base,
        linkedin_url: "https://www.linkedin.com/in/johnsmith/",
        email: "John@Example.com",
      }).success,
    ).toBe(true);
  });

  it("rejects neither, flagging both fields", () => {
    const errors = errorsFor({});
    expect(errors.linkedin_url).toContain(IDENTIFIER_REQUIRED);
    expect(errors.email).toContain(IDENTIFIER_REQUIRED);
  });

  it("rejects a malformed LinkedIn URL even when an email is present", () => {
    const errors = errorsFor({
      linkedin_url: "linkedin.com/company/acme",
      email: "john@example.com",
    });
    expect(errors.linkedin_url).toContain(LINKEDIN_INVALID);
  });

  it("rejects a malformed email even when a LinkedIn URL is present", () => {
    const errors = errorsFor({
      linkedin_url: "linkedin.com/in/johnsmith",
      email: "not-an-email",
    });
    expect(errors.email).toContain(EMAIL_INVALID);
  });

  it("still requires a name", () => {
    const errors = errorsFor({
      first_name: "",
      email: "john@example.com",
    });
    expect(errors.first_name?.length).toBeGreaterThan(0);
  });

  it("treats whitespace-only identifiers as absent", () => {
    const errors = errorsFor({ linkedin_url: "   ", email: "  " });
    expect(errors.linkedin_url).toContain(IDENTIFIER_REQUIRED);
  });
});
