/**
 * Canonicalises a LinkedIn profile URL so two people pasting the same profile
 * in different shapes collide on one value.
 *
 * This is the load-bearing function for duplicate detection: `contacts` carries
 * a unique index on (workspace_id, linkedin_url_normalized), so whatever this
 * returns is exactly what the database dedupes on. A bug here means two members
 * silently reach out to the same person.
 *
 * Returns null when the input is not a LinkedIn *profile* URL, so the form can
 * show a validation error rather than storing a value that will never match.
 */
export function normalizeLinkedInUrl(input: string): string | null {
  if (typeof input !== "string") return null;

  let value = input.trim().toLowerCase();
  if (!value) return null;

  if (value.startsWith("https://")) {
    value = value.slice("https://".length);
  } else if (value.startsWith("http://")) {
    value = value.slice("http://".length);
  } else if (value.includes("://")) {
    return null; // some other scheme entirely
  }

  // Query string and fragment carry tracking junk (?utm_source, #experience).
  value = value.split("?")[0].split("#")[0];
  value = value.replace(/\/+$/, "");

  const slash = value.indexOf("/");
  if (slash === -1) return null;

  const host = value.slice(0, slash);
  const path = value.slice(slash);

  // Accepts linkedin.com and any subdomain (www., ca., uk., ...). Lookalikes
  // such as evil-linkedin.com are rejected: they lack the separating dot.
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null;

  if (!path.startsWith("/in/")) return null;
  let slug = path.slice("/in/".length);
  if (!slug) return null;

  // Accented names get pasted both encoded and decoded; collapse to one form
  // so /in/jos%C3%A9 and /in/josé are recognised as the same person.
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // Malformed escape sequence — keep the raw slug rather than throwing.
  }

  if (!/^[^/?#\s]+$/.test(slug)) return null;

  return `linkedin.com/in/${slug}`;
}
