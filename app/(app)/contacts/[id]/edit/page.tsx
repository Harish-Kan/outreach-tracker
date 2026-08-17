import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact-form";
import { requireWorkspace } from "@/lib/workspace";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace } = await requireWorkspace();

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, linkedin_url, email, company, title, notes")
    .eq("workspace_id", workspace.id)
    .eq("id", id)
    .maybeSingle();

  if (!contact) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/contacts/${contact.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to {contact.name}
        </Link>

        <h1 className="mt-3 text-2xl font-semibold">Edit contact</h1>
        <p className="text-sm text-muted-foreground">
          Status and ownership are changed from the contact page, so those
          changes keep their place in the timeline.
        </p>
      </div>

      <ContactForm contact={contact} />
    </div>
  );
}
