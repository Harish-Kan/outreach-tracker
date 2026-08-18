import type { ContactStatus } from "@/types/database";

export type SortKey =
  | "activity"
  | "added_desc"
  | "added_asc"
  | "name_asc"
  | "name_desc"
  | "company_asc"
  | "status";

export const SORT_LABELS: Record<SortKey, string> = {
  activity: "Last activity",
  added_desc: "Recently added",
  added_asc: "Added first",
  name_asc: "Name A–Z",
  name_desc: "Name Z–A",
  company_asc: "Company A–Z",
  status: "Status",
};

/** Pipeline order, so sorting by status walks the funnel rather than the alphabet. */
const STATUS_ORDER: Record<ContactStatus, number> = {
  added: 0,
  reached_out: 1,
  responded: 2,
  chat_booked: 3,
  chat_completed: 4,
  no_response: 5,
  not_interested: 6,
};

type Sortable = {
  name: string;
  company: string | null;
  status: ContactStatus;
  is_important: boolean;
  last_activity_at: string;
  created_at: string;
};

const byText = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base" });

const newestFirst = (a: string, b: string) =>
  new Date(b).getTime() - new Date(a).getTime();

export function sortContacts<T extends Sortable>(
  contacts: T[],
  key: SortKey,
): T[] {
  const compare = (a: T, b: T): number => {
    switch (key) {
      case "added_desc":
        return newestFirst(a.created_at, b.created_at);
      case "added_asc":
        return -newestFirst(a.created_at, b.created_at);
      case "name_asc":
        return byText(a.name, b.name);
      case "name_desc":
        return byText(b.name, a.name);
      case "company_asc":
        // Contacts with no company sink rather than sorting under "".
        if (!a.company && !b.company) return byText(a.name, b.name);
        if (!a.company) return 1;
        if (!b.company) return -1;
        return byText(a.company, b.company) || byText(a.name, b.name);
      case "status":
        return (
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          byText(a.name, b.name)
        );
      case "activity":
      default:
        return newestFirst(a.last_activity_at, b.last_activity_at);
    }
  };

  // Important always wins, whatever the chosen ordering — that is the point of
  // marking someone important.
  return [...contacts].sort(
    (a, b) => Number(b.is_important) - Number(a.is_important) || compare(a, b),
  );
}
