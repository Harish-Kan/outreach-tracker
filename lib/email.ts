/**
 * Canonicalises an email address so it can act as a deduplication key
 * alongside the normalized LinkedIn URL.
 *
 * Deliberately conservative: trim and lowercase only. Stripping plus-tags or
 * dots would collapse addresses that some providers genuinely treat as
 * different mailboxes, and a false duplicate is worse than a missed one — it
 * blocks a real person from being added at all.
 *
 * Returns null when the input is not a usable address, so the form can show a
 * validation error instead of storing a key that will never match.
 */
export function normalizeEmail(input: string): string | null {
  if (typeof input !== "string") return null;

  const value = input.trim().toLowerCase();
  if (!value) return null;

  // One @, something either side, and a dot in the domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;

  return value;
}
