import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { relativeDays } from "@/lib/format";
import { profileNames } from "@/lib/profiles";
import { requireWorkspace } from "@/lib/workspace";
import type { ContactStatus } from "@/types/database";

type TeamContact = {
  id: string;
  name: string;
  company: string | null;
  status: ContactStatus;
  added_by: string | null;
  last_activity_at: string;
};

/**
 * Answers "who reached out to who" at a glance — the question the whole app
 * exists to stop being asked too late.
 */
export default async function TeamPage() {
  const { supabase, workspace, isShared, userId } = await requireWorkspace();

  // Nothing to compare in a workspace of one.
  if (!isShared) redirect("/contacts");

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, company, status, owner_id, created_by, last_activity_at")
    .eq("workspace_id", workspace.id)
    .order("last_activity_at", { ascending: false });

  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("workspace_id", workspace.id);

  const names = await profileNames(supabase, [
    ...(memberships ?? []).map((m) => m.user_id),
    ...(contacts ?? []).flatMap((c) => [c.owner_id, c.created_by]),
  ]);

  // One bucket per member, plus a bucket for contacts nobody has claimed.
  const buckets = new Map<string, TeamContact[]>();
  for (const membership of memberships ?? []) {
    buckets.set(membership.user_id, []);
  }
  const unclaimed: TeamContact[] = [];

  for (const contact of contacts ?? []) {
    const entry: TeamContact = {
      id: contact.id,
      name: contact.name,
      company: contact.company,
      status: contact.status,
      // Only worth surfacing when it differs from the owner.
      added_by:
        contact.created_by && contact.created_by !== contact.owner_id
          ? (names.get(contact.created_by) ?? null)
          : null,
      last_activity_at: contact.last_activity_at,
    };

    if (!contact.owner_id) {
      unclaimed.push(entry);
      continue;
    }

    const bucket = buckets.get(contact.owner_id);
    if (bucket) bucket.push(entry);
    else buckets.set(contact.owner_id, [entry]);
  }

  const groups = [...buckets.entries()]
    .map(([ownerId, items]) => ({
      key: ownerId,
      title: ownerId === userId ? "You" : (names.get(ownerId) ?? "Unknown"),
      items,
    }))
    .sort((a, b) => b.items.length - a.items.length);

  if (unclaimed.length) {
    groups.push({ key: "unclaimed", title: "Unclaimed", items: unclaimed });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground">
          Every contact in {workspace.name}, grouped by who owns them.
        </p>
      </div>

      {groups.map((group) => (
        <section key={group.key} className="space-y-3">
          <h2 className="flex items-baseline gap-2 text-lg font-semibold">
            {group.title}
            <span className="text-sm font-normal text-muted-foreground">
              {group.items.length}{" "}
              {group.items.length === 1 ? "contact" : "contacts"}
            </span>
          </h2>

          {group.items.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Nothing yet.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {group.items.map((contact) => (
                <li
                  key={contact.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4"
                >
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {contact.name}
                  </Link>

                  {contact.company && (
                    <span className="text-sm text-muted-foreground">
                      {contact.company}
                    </span>
                  )}

                  <StatusBadge status={contact.status} />

                  {contact.added_by && (
                    <span className="text-sm text-muted-foreground">
                      added by {contact.added_by}
                    </span>
                  )}

                  <span className="ms-auto text-sm text-muted-foreground">
                    {relativeDays(contact.last_activity_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
