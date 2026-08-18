import { ContactList } from "@/components/contact-list";
import type { ContactTableRow } from "@/components/contact-table";
import { profileNames } from "@/lib/profiles";
import { requireWorkspace } from "@/lib/workspace";

const BASE_COLUMNS =
  "id, name, company, email, status, owner_id, last_activity_at, created_at";

/**
 * Columns added by migrations that are run by hand, newest last.
 *
 * is_important came with 0008 and is_flagged with 0010. If a migration has not
 * been applied yet the select fails whole, so the newest column is dropped and
 * the query retried — the list degrades one feature at a time instead of the
 * page going down, which is what happened the last time code shipped ahead of
 * its migration.
 */
const OPTIONAL_COLUMNS = ["is_important", "is_flagged"] as const;

/** Postgres: column does not exist. */
const UNDEFINED_COLUMN = "42703";

export default async function ContactsPage() {
  const { supabase, workspace, isShared } = await requireWorkspace();

  // Filtered on workspace explicitly even though RLS would also catch it —
  // belt and braces, and it keeps the query on the index.
  const query = (columns: string[]) =>
    supabase
      .from("contacts")
      .select([BASE_COLUMNS, ...columns].join(", "))
      .eq("workspace_id", workspace.id)
      .order("last_activity_at", { ascending: false });

  let available: string[] = [...OPTIONAL_COLUMNS];
  let result = await query(available);

  while (result.error?.code === UNDEFINED_COLUMN && available.length > 0) {
    available = available.slice(0, -1);
    result = await query(available);
  }

  const { data, error } = result;

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load contacts: {error.message}
      </p>
    );
  }

  type Row = {
    id: string;
    name: string;
    company: string | null;
    email: string | null;
    status: ContactRowStatus;
    owner_id: string | null;
    last_activity_at: string;
    created_at: string;
    is_important?: boolean;
    is_flagged?: boolean;
  };

  const contacts = (data ?? []) as unknown as Row[];

  const names = await profileNames(
    supabase,
    contacts.map((contact) => contact.owner_id),
  );

  const rows: ContactTableRow[] = contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    company: contact.company,
    email: contact.email,
    status: contact.status,
    owner_name: contact.owner_id ? (names.get(contact.owner_id) ?? null) : null,
    is_important: contact.is_important ?? false,
    is_flagged: contact.is_flagged ?? false,
    last_activity_at: contact.last_activity_at,
    created_at: contact.created_at,
  }));

  return (
    <ContactList
      contacts={rows}
      showOwner={isShared}
      workspaceName={workspace.name}
      canFlag={available.includes("is_flagged")}
    />
  );
}

type ContactRowStatus = ContactTableRow["status"];
