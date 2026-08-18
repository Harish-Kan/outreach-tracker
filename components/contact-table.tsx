"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { relativeDays } from "@/lib/format";
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
}) {
  const selected = selectedIds ?? new Set<string>();
  const allSelected = contacts.length > 0 && selected.size === contacts.length;

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
            {onToggleImportant && (
              <TableHead className="w-10">
                <span className="sr-only">Important</span>
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

            return (
              <TableRow
                key={contact.id}
                className={isSelected ? "bg-muted/50" : undefined}
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

                {onToggleImportant && (
                  <TableCell>
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
                  <StatusBadge status={contact.status} />
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
