import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactActions } from "@/components/contact-actions";
import {
  InteractionTimeline,
  type TimelineEntry,
} from "@/components/interaction-timeline";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { NEXT_STATUSES } from "@/lib/pipeline";
import { profileNames } from "@/lib/profiles";
import { requireWorkspace } from "@/lib/workspace";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, workspace, userId } = await requireWorkspace();

  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspace.id)
    .eq("id", id)
    .maybeSingle();

  if (!contact) notFound();

  const { data: interactions } = await supabase
    .from("interactions")
    .select("id, type, note, occurred_at, user_id")
    .eq("contact_id", contact.id)
    .order("occurred_at", { ascending: false });

  const names = await profileNames(supabase, [
    contact.owner_id,
    contact.created_by,
    ...(interactions ?? []).map((entry) => entry.user_id),
  ]);

  const ownerName = contact.owner_id
    ? (names.get(contact.owner_id) ?? null)
    : null;
  const addedByName = names.get(contact.created_by) ?? null;

  const entries: TimelineEntry[] = (interactions ?? []).map((entry) => ({
    id: entry.id,
    type: entry.type,
    note: entry.note,
    occurred_at: entry.occurred_at,
    actor_name: names.get(entry.user_id) ?? null,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/contacts"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← All contacts
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{contact.name}</h1>
          <StatusBadge status={contact.status} />
          <Link
            href={`/contacts/${contact.id}/edit`}
            className="ms-auto text-sm text-muted-foreground hover:underline"
          >
            Edit details
          </Link>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          {[contact.title, contact.company].filter(Boolean).join(" at ") ||
            "No role recorded"}
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Timeline</h2>
            <InteractionTimeline entries={entries} />
          </section>
        </div>

        <aside className="space-y-6">
          <dl className="space-y-3 rounded-lg border p-4 text-sm">
            <Detail label="Owner">{ownerName ?? "Unclaimed"}</Detail>
            <Detail label="Added by">{addedByName ?? "Unknown"}</Detail>
            {contact.linkedin_url_normalized && (
              <Detail label="LinkedIn">
                <a
                  href={`https://${contact.linkedin_url_normalized}`}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all underline underline-offset-4"
                >
                  {contact.linkedin_url_normalized}
                </a>
              </Detail>
            )}
            {contact.email && (
              <Detail label="Email">
                <span className="break-all">{contact.email}</span>
              </Detail>
            )}
            <Detail label="Added">{formatDate(contact.created_at)}</Detail>
          </dl>

          {contact.notes && (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium">Notes</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {contact.notes}
              </p>
            </div>
          )}

          <ContactActions
            contactId={contact.id}
            nextStatuses={NEXT_STATUSES[contact.status]}
            isOwner={contact.owner_id === userId}
            ownerName={ownerName}
          />
        </aside>
      </div>
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
