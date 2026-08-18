import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/**
 * The front door.
 *
 * Signed-in visitors never see this — they are sent straight to their contacts,
 * which is what the root route did before this page existed. It is only here to
 * explain the product to somebody arriving for the first time.
 */
export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/contacts");

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      {/* Ambient wash behind the hero. Built from --primary via color-mix so it
          follows the theme instead of needing a second dark-mode definition. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem]"
        style={{
          background:
            "radial-gradient(64rem 34rem at 50% -18%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 72%)",
        }}
      />

      <header className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-5">
        <span className="font-semibold tracking-tight">Outreach Tracker</span>
        <div className="ms-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pb-20 pt-14 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            For teams doing outreach together
          </p>

          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Never reach out to the same person twice.
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-muted-foreground text-pretty">
            One shared list of every recruiter, alum and founder your team is
            talking to. The moment someone is already in it, the app says so —
            and tells you who has them and how far the conversation got.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className={`${buttonVariants({ size: "lg" })} h-11 px-6 text-sm`}
            >
              Create an account
            </Link>
            <Link
              href="/login"
              className={`${buttonVariants({ variant: "outline", size: "lg" })} h-11 px-6 text-sm`}
            >
              Sign in
            </Link>
          </div>

          <p className="mt-5 text-sm text-muted-foreground">
            Got an invite code from a teammate? Create an account first, then
            enter it under Workspace settings.
          </p>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-24">
          <div className="grid gap-10 rounded-2xl border bg-card/60 p-6 backdrop-blur sm:p-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-balance">
                The duplicate is caught before you send anything.
              </h2>
              <p className="mt-4 text-muted-foreground text-pretty">
                Contacts are matched on the LinkedIn profile or the email
                address, normalised first — so{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-[0.8em]">
                  /in/harish-kandavell
                </code>{" "}
                and{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-[0.8em]">
                  https://www.linkedin.com/in/harish-kandavell/
                </code>{" "}
                are understood to be the same person.
              </p>
            </div>

            <DuplicateMock />
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-24">
          <div className="grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
            <Feature
              title="Everyone sees the same list"
              body="Invite your team with a code. Every contact, note and reply is visible to all of you — no spreadsheet passed around, no version that is three days old."
            />
            <Feature
              title="Every person has an owner"
              body="Whoever added someone owns the conversation, and their stage is on the row. If they go quiet the contact can be handed over, and the timeline records it."
            />
            <Feature
              title="Nothing gets rewritten"
              body="Messages, replies and chats are appended, never edited. What actually happened stays readable months later, which is the part a spreadsheet always loses."
            />
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-6 text-sm text-muted-foreground">
          <span>Outreach Tracker</span>
          <Link href="/login" className="ms-auto hover:underline">
            Sign in
          </Link>
          <Link href="/signup" className="hover:underline">
            Create an account
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-card p-6">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">{body}</p>
    </div>
  );
}

/**
 * A still of the notice from the add-contact form.
 *
 * Deliberately built from the same colours and wording as the real
 * DuplicateNotice rather than an idealised mockup — a landing page that
 * promises a screen the product does not have is just a lie with nice kerning.
 */
function DuplicateMock() {
  return (
    <div className="rounded-xl border bg-background p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">
        LinkedIn profile
      </p>
      <div className="mt-1.5 truncate rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
        linkedin.com/in/harish-kandavell
      </div>

      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Already in this workspace — same LinkedIn profile
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-medium">Harish Kandavell</span>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
            Chat booked
          </span>
        </div>

        <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-200/80">
          Owned by Harish Kandavell.
        </p>

        <span className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
          Open their record →
        </span>
      </div>
    </div>
  );
}
