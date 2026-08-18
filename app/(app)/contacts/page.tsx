import { ContactList } from "@/components/contact-list";
import type { ContactTableRow } from "@/components/contact-table";
import { profileNames } from "@/lib/profiles";
import { requireWorkspace } from "@/lib/workspace";

export default async function ContactsPage() {
  const { supabase, workspace, isShared } = await requireWorkspace();

  // Filtered on workspace explicitly even though RLS would also catch it —
  // belt and braces, and it keeps the query on the index.
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, name, company, status, owner_id, last_activity_at")
    .eq("workspace_id", workspace.id)
    .order("last_activity_at", { ascending: false });

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load contacts: {error.message}
      </p>
    );
  }

  const names = await profileNames(
    supabase,
    (contacts ?? []).map((contact) => contact.owner_id),
  );

  const rows: ContactTableRow[] = (contacts ?? []).map((contact) => ({
    id: contact.id,
    name: contact.name,
    company: contact.company,
    status: contact.status,
    owner_name: contact.owner_id ? (names.get(contact.owner_id) ?? null) : null,
    last_activity_at: contact.last_activity_at,
  }));

  return (
    <ContactList
      contacts={rows}
      showOwner={isShared}
      workspaceName={workspace.name}
    />
  );
}
