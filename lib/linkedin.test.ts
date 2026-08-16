import { describe, expect, it } from "vitest";
import { normalizeLinkedInUrl } from "./linkedin";

const CANONICAL = "linkedin.com/in/johnsmith";

describe("normalizeLinkedInUrl", () => {
  describe("the forms from the spec all collapse to one value", () => {
    const variants = [
      "https://www.linkedin.com/in/johnsmith/",
      "http://linkedin.com/in/JohnSmith",
      "https://ca.linkedin.com/in/johnsmith?utm_source=share",
      "linkedin.com/in/johnsmith#experience",
      "  LINKEDIN.COM/IN/JOHNSMITH",
    ];

    for (const variant of variants) {
      it(`normalizes ${JSON.stringify(variant)}`, () => {
        expect(normalizeLinkedInUrl(variant)).toBe(CANONICAL);
      });
    }

    it("maps every variant onto a single deduplication key", () => {
      const keys = new Set(variants.map(normalizeLinkedInUrl));
      expect(keys).toEqual(new Set([CANONICAL]));
    });
  });

  describe("protocol", () => {
    it("strips https", () => {
      expect(normalizeLinkedInUrl("https://linkedin.com/in/johnsmith")).toBe(CANONICAL);
    });

    it("strips http", () => {
      expect(normalizeLinkedInUrl("http://linkedin.com/in/johnsmith")).toBe(CANONICAL);
    });

    it("accepts a bare host with no protocol", () => {
      expect(normalizeLinkedInUrl("linkedin.com/in/johnsmith")).toBe(CANONICAL);
    });

    it("rejects other schemes", () => {
      expect(normalizeLinkedInUrl("ftp://linkedin.com/in/johnsmith")).toBeNull();
      expect(normalizeLinkedInUrl("javascript://linkedin.com/in/johnsmith")).toBeNull();
    });
  });

  describe("subdomains", () => {
    it("strips www", () => {
      expect(normalizeLinkedInUrl("www.linkedin.com/in/johnsmith")).toBe(CANONICAL);
    });

    it("strips country subdomains", () => {
      expect(normalizeLinkedInUrl("ca.linkedin.com/in/johnsmith")).toBe(CANONICAL);
      expect(normalizeLinkedInUrl("uk.linkedin.com/in/johnsmith")).toBe(CANONICAL);
      expect(normalizeLinkedInUrl("de.linkedin.com/in/johnsmith")).toBe(CANONICAL);
    });

    it("strips stacked subdomains", () => {
      expect(normalizeLinkedInUrl("www.ca.linkedin.com/in/johnsmith")).toBe(CANONICAL);
    });

    it("rejects lookalike domains", () => {
      expect(normalizeLinkedInUrl("evil-linkedin.com/in/johnsmith")).toBeNull();
      expect(normalizeLinkedInUrl("linkedin.com.evil.co/in/johnsmith")).toBeNull();
      expect(normalizeLinkedInUrl("notlinkedin.com/in/johnsmith")).toBeNull();
    });
  });

  describe("query strings, fragments and trailing slashes", () => {
    it("drops query parameters", () => {
      expect(normalizeLinkedInUrl("linkedin.com/in/johnsmith?utm_source=share")).toBe(CANONICAL);
      expect(normalizeLinkedInUrl("linkedin.com/in/johnsmith?a=1&b=2")).toBe(CANONICAL);
    });

    it("drops fragments", () => {
      expect(normalizeLinkedInUrl("linkedin.com/in/johnsmith#experience")).toBe(CANONICAL);
    });

    it("drops a trailing slash before the query", () => {
      expect(normalizeLinkedInUrl("linkedin.com/in/johnsmith/?utm_source=share")).toBe(CANONICAL);
    });

    it("drops a trailing slash before the fragment", () => {
      expect(normalizeLinkedInUrl("linkedin.com/in/johnsmith/#experience")).toBe(CANONICAL);
    });

    it("drops repeated trailing slashes", () => {
      expect(normalizeLinkedInUrl("linkedin.com/in/johnsmith///")).toBe(CANONICAL);
    });
  });

  describe("slugs", () => {
    it("keeps hyphens and digits", () => {
      expect(normalizeLinkedInUrl("https://www.linkedin.com/in/john-smith-1a2b3c/")).toBe(
        "linkedin.com/in/john-smith-1a2b3c",
      );
    });

    it("collapses percent-encoded accents onto the decoded form", () => {
      expect(normalizeLinkedInUrl("linkedin.com/in/jos%C3%A9")).toBe(
        normalizeLinkedInUrl("linkedin.com/in/josé"),
      );
    });

    it("rejects an encoded slash rather than splitting the path", () => {
      expect(normalizeLinkedInUrl("linkedin.com/in/john%2Fsmith")).toBeNull();
    });

    it("survives a malformed escape sequence", () => {
      expect(normalizeLinkedInUrl("linkedin.com/in/john%zzsmith")).toBe(
        "linkedin.com/in/john%zzsmith",
      );
    });
  });

  describe("rejects anything that is not a profile URL", () => {
    const rejected = [
      "",
      "   ",
      "johnsmith",
      "linkedin.com",
      "linkedin.com/",
      "linkedin.com/in",
      "linkedin.com/in/",
      "linkedin.com/company/acme",
      "linkedin.com/jobs/view/123",
      "linkedin.com/in/johnsmith/detail/recent-activity",
      "https://twitter.com/johnsmith",
      "https://example.com/in/johnsmith",
    ];

    for (const input of rejected) {
      it(`rejects ${JSON.stringify(input)}`, () => {
        expect(normalizeLinkedInUrl(input)).toBeNull();
      });
    }
  });

  describe("is idempotent", () => {
    it("normalizing its own output changes nothing", () => {
      const once = normalizeLinkedInUrl("https://ca.linkedin.com/in/JohnSmith/?utm_source=share");
      expect(once).toBe(CANONICAL);
      expect(normalizeLinkedInUrl(once!)).toBe(CANONICAL);
    });
  });
});
