import Link from "next/link";
import { requireWorkspace } from "@/lib/workspace";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace } = await requireWorkspace();

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4">
          <Link href="/contacts" className="font-semibold">
            Outreach Tracker
          </Link>

          <span className="text-sm text-muted-foreground">
            {workspace.name}
          </span>

          <nav className="flex items-center gap-4 text-sm">
            <Link href="/contacts" className="hover:underline">
              Contacts
            </Link>
            <Link href="/contacts/new" className="hover:underline">
              Add contact
            </Link>
          </nav>

          <form action={signOut} className="ms-auto">
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
