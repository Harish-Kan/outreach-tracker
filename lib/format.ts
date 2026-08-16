const DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatDate(value: string) {
  return DATE_FORMAT.format(new Date(value));
}

export function formatDateTime(value: string) {
  return DATE_TIME_FORMAT.format(new Date(value));
}

export const STALE_AFTER_DAYS = 14;

export function daysSince(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  return Math.floor(elapsed / (1000 * 60 * 60 * 24));
}

/** "today", "3 days ago", "2 months ago" — enough for a last-activity column. */
export function relativeDays(value: string) {
  const days = daysSince(value);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}
