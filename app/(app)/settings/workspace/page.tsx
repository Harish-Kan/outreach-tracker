import { headers } from "next/headers";
import { DeleteWorkspace } from "@/components/delete-workspace";
import { InviteManager, type InviteRow } from "@/components/invite-manager";
import { MemberList, type MemberRow } from "@/components/member-list";
import {
  CreateWorkspaceForm,
  JoinWorkspaceForm,
  RenameWorkspaceForm,
} from "@/components/workspace-forms";
import { profileNames } from "@/lib/profiles";
import { requireWorkspace } from "@/lib/workspace";

export default async function WorkspaceSettingsPage() {
  const { supabase, workspace, role, canAdminister, memberCount, options, userId } =
    await requireWorkspace();

  const { data: memberships } = await supabase
    .from("memberships")
    .select("id, user_id, role, joined_at")
    .eq("workspace_id", workspace.id)
    .order("joined_at", { ascending: true });

  const names = await profileNames(
    supabase,
    (memberships ?? []).map((membership) => membership.user_id),
  );

  // Only owners and admins can read invites at all, per RLS.
  let invites: InviteRow[] = [];
  if (canAdminister) {
    const { data } = await supabase
      .from("invites")
      .select("id, code, expires_at, max_uses, uses_count, revoked_at")
      .eq("workspace_id", workspace.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    invites = (data ?? []).map((invite) => ({
      id: invite.id,
      code: invite.code,
      expires_at: invite.expires_at,
      max_uses: invite.max_uses,
      uses_count: invite.uses_count,
    }));
  }

  const { count: contactCount } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Workspace settings</h1>
        <p className="text-sm text-muted-foreground">
          {workspace.name} · {memberCount}{" "}
          {memberCount === 1 ? "member" : "members"} · you are {role}
        </p>
      </div>

      {canAdminister && (
        <Section title="Name">
          <RenameWorkspaceForm
            workspaceId={workspace.id}
            currentName={workspace.name}
          />
        </Section>
      )}

      <Section
        title="Members"
        description="Everyone who can see the contacts in this workspace."
      >
        <MemberList
          currentUserId={userId}
          canRemove={canAdminister}
          members={(memberships ?? []).map<MemberRow>((membership) => ({
            id: membership.id,
            userId: membership.user_id,
            name: names.get(membership.user_id) ?? "Unknown",
            role: membership.role,
            joinedAt: membership.joined_at,
          }))}
        />
      </Section>

      {canAdminister ? (
        <Section
          title="Invite people"
          description="Share a code and they can join this workspace. Anyone who joins sees every contact in it."
        >
          <InviteManager invites={invites} origin={origin} />
        </Section>
      ) : (
        <Section title="Invite people">
          <p className="text-sm text-muted-foreground">
            Only owners and admins can create invite codes.
          </p>
        </Section>
      )}

      <Section
        title="Join another workspace"
        description="Got a code from someone else? You keep your own workspaces and can switch between them at the top of the page."
      >
        <div className="max-w-sm">
          <JoinWorkspaceForm />
        </div>
      </Section>

      <Section
        title="Create a new workspace"
        description="A separate space with its own contacts. Contacts never move between workspaces."
      >
        <div className="max-w-sm">
          <CreateWorkspaceForm />
        </div>
      </Section>

      {role === "owner" && (
        <Section
          title="Danger zone"
          description="Deleting a workspace removes its contacts and history for every member. There is no undo and no export."
        >
          <DeleteWorkspace
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            contactCount={contactCount ?? 0}
            memberCount={memberCount}
            isOnlyWorkspace={options.length < 2}
          />
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
