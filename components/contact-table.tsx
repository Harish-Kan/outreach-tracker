"use client";

import Link from "next/link";
import { StatusBadge, statusLabel } from "@/components/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { relativeDays } from "@/lib/format";
import { nextStatus } from "@/lib/pipeline";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ContactStatus } from "@/types/database";

export type ContactTableRow = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  status: ContactStatus;
  owner_name: string | null;
  is_important: boolean;
  is_flagged: boolean;
  last_activity_at: string;
  created_at: string;
};

export function ContactTable({
  contacts,
  showOwner,
  selectable = false,
  selectedIds,
  onToggle,
  onToggleAll,
  onToggleImportant,
  pendingImportantId,
  onToggleFlagged,
  pendingFlaggedId,
  onAdvanceStatus,
  pendingStatusId,
}: {
  contacts: ContactTableRow[];
  /** Hidden in personal workspaces, where every contact is yours. */
  showOwner: boolean;
  /** Selection is opt-in so the table stays usable from server components. */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  onToggleImportant?: (id: string, important: boolean) => void;
  pendingImportantId?: string | null;
  onToggleFlagged?: (id: string, flagged: boolean) => void;
  pendingFlaggedId?: string | null;
  /** Advances the badge in place. Omitted while selecting, where a click means
      "pick this row" instead. */
  onAdvanceStatus?: (id: string, status: ContactStatus) => void;
  pendingStatusId?: string | null;
}) {
  const selected = selectedIds ?? new Set<string>();
  const allSelected = contacts.length > 0 && selected.size === contacts.length;
  // Both markers share one narrow column so the table does not grow a second
  // sliver of a header for what is really one group of controls.
  const showMarkers = Boolean(onToggleImportant || onToggleFlagged);

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => onToggleAll?.(checked === true)}
                  aria-label="Select all contacts"
                />
              </TableHead>
            )}
            {showMarkers && (
              <TableHead className="w-16">
                <span className="sr-only">Important and flagged</span>
              </TableHead>
            )}
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            {showOwner && <TableHead>Owner</TableHead>}
            <TableHead className="text-right">Last activity</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {contacts.map((contact) => {
            const isSelected = selected.has(contact.id);

            // One background wins outright rather than layering two tints:
            // equal-specificity Tailwind utilities resolve by stylesheet order,
            // not by the order they appear in this string, so combining them
            // would be a coin flip. Selection is the more urgent state.
            const tint = isSelected
              ? "bg-muted/50"
              : contact.is_flagged
                ? "bg-rose-50/70 dark:bg-rose-950/25"
                : "";

            // The stripe is what actually catches the eye mid-scroll; the tint
            // alone is too soft to register in peripheral vision.
            const stripe = contact.is_flagged
              ? "[&>td:first-child]:border-l-2 [&>td:first-child]:border-l-rose-500"
              : "";

            return (
              <TableRow
                key={contact.id}
                className={`${tint} ${stripe}`.trim() || undefined}
              >
                {selectable && (
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggle?.(contact.id)}
                      aria-label={`Select ${contact.name}`}
                    />
                  </TableCell>
                )}

                {showMarkers && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {onToggleImportant && (
                        <button
                          type="button"
                          disabled={pendingImportantId === contact.id}
                          onClick={() =>
                            onToggleImportant(contact.id, !contact.is_important)
                          }
                          aria-pressed={contact.is_important}
                          aria-label={
                            contact.is_important
                              ? `Remove important from ${contact.name}`
                              : `Mark ${contact.name} important`
                          }
                          title={
                            contact.is_important
                              ? "Important — pinned to the top"
                              : "Mark as important"
                          }
                          className="text-muted-foreground transition-colors hover:text-amber-500 disabled:opacity-50"
                        >
                          <StarIcon filled={contact.is_important} />
                        </button>
                      )}

                      {onToggleFlagged && (
                        <button
                          type="button"
                          disabled={pendingFlaggedId === contact.id}
                          onClick={() =>
                            onToggleFlagged(contact.id, !contact.is_flagged)
                          }
                          aria-pressed={contact.is_flagged}
                          aria-label={
                            contact.is_flagged
                              ? `Remove flag from ${contact.name}`
                              : `Flag ${contact.name}`
                          }
                          title={
                            contact.is_flagged
                              ? "Flagged — highlighted, but not reordered"
                              : "Flag to make this row stand out"
                          }
                          className="text-muted-foreground transition-colors hover:text-rose-500 disabled:opacity-50"
                        >
                          <FlagIcon filled={contact.is_flagged} />
                        </button>
                      )}
                    </div>
                  </TableCell>
                )}

                <TableCell className="font-medium">
                  {/* While selecting, the whole row is about picking, not
                      navigating — a link here just loses the selection. */}
                  {selectable ? (
                    <button
                      type="button"
                      onClick={() => onToggle?.(contact.id)}
                      className="text-left"
                    >
                      {contact.name}
                    </button>
                  ) : (
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {contact.name}
                    </Link>
                  )}
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {contact.company ?? "—"}
                </TableCell>
                <TableCell>
                  <AdvanceableStatus
                    contact={contact}
                    onAdvance={onAdvanceStatus}
                    pending={pendingStatusId === contact.id}
                  />
                </TableCell>
                {showOwner && (
                  <TableCell className="text-muted-foreground">
                    {contact.owner_name ?? "Unclaimed"}
                  </TableCell>
                )}
                <TableCell className="text-right text-muted-foreground">
                  {relativeDays(contact.last_activity_at)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * The status badge, clickable when there is an obvious next step.
 *
 * Terminal statuses render as a plain badge: offering a click that does
 * nothing is worse than offering no click at all.
 */
function AdvanceableStatus({
  contact,
  onAdvance,
  pending,
}: {
  contact: ContactTableRow;
  onAdvance?: (id: string, status: ContactStatus) => void;
  pending: boolean;
}) {
  const next = nextStatus(contact.status);

  if (!onAdvance || !next) return <StatusBadge status={contact.status} />;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => onAdvance(contact.id, next)}
      title={`Click to mark ${statusLabel(next).toLowerCase()}`}
      aria-label={`Move ${contact.name} to ${statusLabel(next)}`}
      className="rounded-full transition-opacity hover:opacity-65 disabled:opacity-40"
    >
      <StatusBadge status={contact.status} />
    </button>
  );
}

export function FlagIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-4 ${filled ? "fill-rose-400 text-rose-500" : "fill-none"}`}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
    </svg>
  );
}

export function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-4 ${filled ? "fill-amber-400 text-amber-500" : "fill-none"}`}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9z" />
    </svg>
  );
}
