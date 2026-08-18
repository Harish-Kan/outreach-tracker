import { ContactList } from "@/components/contact-list";
import type { ContactTableRow } from "@/components/contact-table";
import { profileNames } from "@/lib/profiles";
import { requireWorkspace } from "@/lib/workspace";

const BASE_COLUMNS =
  "id, name, company, email, status, owner_id, last_activity_at, created_at";

/** Postgres: column does not exist. */
const UNDEFINED_COLUMN = "42703";

export default async function ContactsPage() {
  const { supabase, workspace, isShared } = await requireWorkspace();

  // Filtered on workspace explicitly even though RLS would also catch it —
  // belt and braces, and it keeps the query on the index.
  const query = (columns: string) =>
    supabase
      .from("contacts")
      .select(columns)
      .eq("workspace_id", workspace.id)
      .order("last_activity_at", { ascending: false });

  let { data, error } = await query(`${BASE_COLUMNS}, is_important`);

  // Migration 0008 adds is_important. Falling back keeps the page working if
  // the code is deployed before the migration is run, rather than taking the
  // contact list down.
  let importantSupported = true;
  if (error?.code === UNDEFINED_COLUMN) {
    importantSupported = false;
    ({ data, error } = await query(BASE_COLUMNS));
  }

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
    is_important: importantSupported ? (contact.is_important ?? false) : false,
    last_activity_at: contact.last_activity_at,
    created_at: contact.created_at,
  }));

  return (
    <ContactList
      contacts={rows}
      showOwner={isShared}
      workspaceName={workspace.name}
    />
  );
}

type ContactRowStatus = ContactTableRow["status"];
