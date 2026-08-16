import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
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
  first_name: string;
  last_name: string;
  company: string | null;
  status: ContactStatus;
  owner_name: string | null;
  last_activity_at: string;
};

export function ContactTable({
  contacts,
  showOwner,
}: {
  contacts: ContactTableRow[];
  /** Hidden in personal workspaces, where every contact is yours. */
  showOwner: boolean;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            {showOwner && <TableHead>Owner</TableHead>}
            <TableHead className="text-right">Last activity</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell className="font-medium">
                <Link
                  href={`/contacts/${contact.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {contact.first_name} {contact.last_name}
                </Link>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
