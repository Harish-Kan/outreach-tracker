import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { signOut } from "@/lib/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, options, isShared } = await requireWorkspace();

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
          <Link href="/contacts" className="font-semibold">
            Outreach Tracker
          </Link>

          <WorkspaceSwitcher
            activeId={workspace.id}
            options={options.map((option) => ({
              id: option.workspace.id,
              name: option.workspace.name,
            }))}
          />

          <nav className="flex items-center gap-4 text-sm">
            <Link href="/contacts" className="hover:underline">
              Contacts
            </Link>
            <Link href="/contacts/new" className="hover:underline">
              Add contact
            </Link>
            {/* Hidden until someone else is actually in the workspace —
                "who reached out to who" answers nothing on your own. */}
            {isShared && (
              <Link href="/team" className="hover:underline">
                Team
              </Link>
            )}
            <Link href="/settings/workspace" className="hover:underline">
              Settings
            </Link>
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
