import Link from "next/link";
import { ContactTable, type ContactTableRow } from "@/components/contact-table";
import { buttonVariants } from "@/components/ui/button";
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
    owner_name: contact.owner_id
      ? (names.get(contact.owner_id) ?? null)
      : null,
    last_activity_at: contact.last_activity_at,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "person" : "people"} in{" "}
            {workspace.name}
          </p>
        </div>

        <Link href="/contacts/new" className={buttonVariants()}>
          Add contact
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">No contacts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the first person you want to reach out to.
          </p>
          <Link
            href="/contacts/new"
            className={`${buttonVariants()} mt-4`}
          >
            Add contact
          </Link>
        </div>
      ) : (
        <ContactTable contacts={rows} showOwner={isShared} />
      )}
    </div>
  );
}
