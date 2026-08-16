import { ContactForm } from "@/components/contact-form";
import { requireWorkspace } from "@/lib/workspace";

export default async function NewContactPage() {
  const { workspace } = await requireWorkspace();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Add contact</h1>
        <p className="text-sm text-muted-foreground">
          Adding to {workspace.name}. Contacts cannot be moved between
          workspaces later.
        </p>
      </div>

      <ContactForm />
    </div>
  );
}
