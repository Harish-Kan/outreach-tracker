import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("lowercases", () => {
    expect(normalizeEmail("John.Smith@Example.COM")).toBe(
      "john.smith@example.com",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeEmail("  john@example.com  ")).toBe("john@example.com");
  });

  it("collapses casing variants onto one deduplication key", () => {
    const keys = new Set(
      ["john@example.com", "JOHN@EXAMPLE.COM", " John@Example.com "].map(
        normalizeEmail,
      ),
    );
    expect(keys).toEqual(new Set(["john@example.com"]));
  });

  it("keeps plus-tags and dots distinct", () => {
    // Treating these as the same person would block a legitimate add.
    expect(normalizeEmail("john+ops@example.com")).not.toBe(
      normalizeEmail("john@example.com"),
    );
    expect(normalizeEmail("j.smith@example.com")).not.toBe(
      normalizeEmail("jsmith@example.com"),
    );
  });

  it("is idempotent", () => {
    const once = normalizeEmail("  John@Example.COM ");
    expect(normalizeEmail(once!)).toBe(once);
  });

  describe("rejects unusable input", () => {
    const rejected = [
      "",
      "   ",
      "john",
      "john@",
      "@example.com",
      "john@example",
      "john @example.com",
      "john@exam ple.com",
      "john@@example.com",
    ];

    for (const input of rejected) {
      it(`rejects ${JSON.stringify(input)}`, () => {
        expect(normalizeEmail(input)).toBeNull();
      });
    }
  });
});
