import { ContactForm } from "@/components/contact-form";
import { ContactTable, type ContactTableRow } from "@/components/contact-table";
import { DuplicateNotice } from "@/components/duplicate-notice";
import {
  InteractionTimeline,
  type TimelineEntry,
} from "@/components/interaction-timeline";
import { StatusBadge } from "@/components/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format";
import type { ContactStatus } from "@/types/database";

/**
 * A visual preview of every screen, rendered from the real components with
 * sample data and no database. Delete this route once Supabase is connected —
 * it exists so the UI can be reviewed before the schema is applied.
 */

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const SAMPLE_CONTACTS: ContactTableRow[] = [
  {
    id: "1",
    name: "Priya Raman",
    company: "Shopify",
    status: "chat_booked",
    owner_name: "You",
    email: "priya@example.com",
    is_important: true,
    created_at: daysAgo(40),
    last_activity_at: daysAgo(1),
  },
  {
    id: "2",
    name: "Daniel Okafor",
    company: "Stripe",
    status: "responded",
    owner_name: "Amara Chen",
    email: "daniel@example.com",
    is_important: false,
    created_at: daysAgo(30),
    last_activity_at: daysAgo(3),
  },
  {
    id: "3",
    name: "Sofia Marchetti",
    company: "Figma",
    status: "reached_out",
    owner_name: "You",
    email: "sofia@example.com",
    is_important: false,
    created_at: daysAgo(25),
    last_activity_at: daysAgo(16),
  },
  {
    id: "4",
    name: "Tom Bergeron",
    company: "RBC",
    status: "chat_completed",
    owner_name: "Amara Chen",
    email: "tom@example.com",
    is_important: false,
    created_at: daysAgo(60),
    last_activity_at: daysAgo(21),
  },
  {
    id: "5",
    name: "Wen Li",
    company: null,
    status: "added",
    owner_name: null,
    email: null,
    is_important: true,
    created_at: daysAgo(1),
    last_activity_at: daysAgo(0),
  },
  {
    id: "6",
    name: "Marcus Hale",
    company: "Wealthsimple",
    status: "no_response",
    owner_name: "You",
    email: "marcus@example.com",
    is_important: false,
    created_at: daysAgo(90),
    last_activity_at: daysAgo(34),
  },
];

const SAMPLE_TIMELINE: TimelineEntry[] = [
  {
    id: "t1",
    type: "chat_booked",
    note: "Coffee Thursday 10am at the Bay St location.",
    occurred_at: daysAgo(1),
    actor_name: "You",
  },
  {
    id: "t2",
    type: "replied",
    note: "Said yes, happy to chat about the ops team.",
    occurred_at: daysAgo(4),
    actor_name: "You",
  },
  {
    id: "t3",
    type: "follow_up_sent",
    note: null,
    occurred_at: daysAgo(9),
    actor_name: "You",
  },
  {
    id: "t4",
    type: "ownership_changed",
    note: "Took over from a previous owner",
    occurred_at: daysAgo(12),
    actor_name: "You",
  },
  {
    id: "t5",
    type: "reached_out",
    note: null,
    occurred_at: daysAgo(18),
    actor_name: "Amara Chen",
  },
];

const ALL_STATUSES: ContactStatus[] = [
  "added",
  "reached_out",
  "responded",
  "chat_booked",
  "chat_completed",
  "no_response",
  "not_interested",
];

export default function PreviewPage() {
  // Development only. This route needs no session, so in production it was an
  // unauthenticated page whose whole job was rendering internal UI to anyone who
  // guessed the path. It stays available locally, where it is genuinely useful.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-svh bg-background">
      <div className="fixed right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <header className="border-b bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Preview
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Outreach Tracker UI</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every screen below is the real component with sample data. No
            database is involved, so nothing here saves — this is for looking
            at, not clicking through.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-16 px-6 py-12">
        <Section
          title="The duplicate block"
          description="The point of the whole app. Appears the moment you tab out of either identifier if someone in the workspace already has that person — before you have filled in anything else. The heading names which field collided."
        >
          <div className="max-w-2xl space-y-4">
            <DuplicateNotice
              match={{
                id: "2",
                name: "Daniel Okafor",
                status: "responded",
                owner_name: "Amara Chen",
                is_mine: false,
                matched_on: "linkedin",
              }}
            />
            <DuplicateNotice
              match={{
                id: "4",
                name: "Tom Bergeron",
                status: "chat_completed",
                owner_name: null,
                is_mine: false,
                matched_on: "email",
              }}
            />
          </div>
        </Section>

        <Section
          title="Contact list"
          description="/contacts — sorted by last activity. The owner column is hidden automatically in personal workspaces."
        >
          <ContactTable contacts={SAMPLE_CONTACTS} showOwner />
        </Section>

        <Section
          title="Add contact"
          description="/contacts/new — the LinkedIn field checks the workspace on blur. Submitting will not work here; there is no database behind it."
        >
          <div className="max-w-2xl rounded-lg border p-6">
            <ContactForm />
          </div>
        </Section>

        <Section
          title="Contact detail"
          description="/contacts/[id] — append-only history, newest first, showing who did what."
        >
          <div className="grid gap-8 md:grid-cols-[1fr_300px]">
            <div>
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-semibold">Priya Raman</h3>
                <StatusBadge status="chat_booked" />
              </div>
              <p className="mb-6 text-sm text-muted-foreground">
                Senior Recruiter at Shopify
              </p>
              <h4 className="mb-4 text-sm font-medium">Timeline</h4>
              <InteractionTimeline entries={SAMPLE_TIMELINE} />
            </div>

            <aside>
              <dl className="space-y-3 rounded-lg border p-4 text-sm">
                <Detail label="Owner">You</Detail>
                <Detail label="LinkedIn">
                  <span className="break-all underline underline-offset-4">
                    linkedin.com/in/priyaraman
                  </span>
                </Detail>
                <Detail label="Email">priya@example.com</Detail>
                <Detail label="Added">{formatDate(daysAgo(18))}</Detail>
              </dl>
            </aside>
          </div>
        </Section>

        <Section
          title="Status badges"
          description="The full pipeline. Cool greys where nothing has happened, warming through to green at a completed chat, muted for the two closed states."
        >
          <div className="flex flex-wrap gap-3">
            {ALL_STATUSES.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
        </Section>

        <Section
          title="Empty state"
          description="What a brand new workspace looks like."
        >
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="font-medium">No contacts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add the first person you want to reach out to.
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
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
