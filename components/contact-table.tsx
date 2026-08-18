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
  status: ContactStatus;
  owner_name: string | null;
  last_activity_at: string;
};

export function ContactTable({
  contacts,
  showOwner,
  selectable = false,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  contacts: ContactTableRow[];
  /** Hidden in personal workspaces, where every contact is yours. */
  showOwner: boolean;
  /** Selection is opt-in so the table stays usable from server components. */
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
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
                data-state={isSelected ? "selected" : undefined}
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
