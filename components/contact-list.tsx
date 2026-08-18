"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ContactTable, type ContactTableRow } from "@/components/contact-table";
import {
  deleteContacts,
  toggleFlagged,
  toggleImportant,
} from "@/lib/actions/contacts";
import { sortContacts, SORT_LABELS, type SortKey } from "@/lib/sorting";
import { statusLabel } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ContactStatus } from "@/types/database";

const STATUSES: ContactStatus[] = [
  "added",
  "reached_out",
  "responded",
  "chat_booked",
  "chat_completed",
  "no_response",
  "not_interested",
];

const selectClass = "rounded-md border bg-background px-2 py-1.5 text-sm";

/**
 * The contact list plus its toolbar.
 *
 * Filtering and sorting run in the browser over rows already fetched: the list
 * is small, and a server round trip per sort change would make the control feel
 * broken given every page here is server-rendered.
 */
export function ContactList({
  contacts,
  showOwner,
  workspaceName,
  canFlag = true,
}: {
  contacts: ContactTableRow[];
  showOwner: boolean;
  workspaceName: string;
  /** False until migration 0010 has been run; hides the button rather than
      offering one that can only fail. */
  canFlag?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ContactStatus | "all">("all");
  const [sort, setSort] = useState<SortKey>("activity");

  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingStar, setPendingStar] = useState<string | null>(null);
  const [pendingFlag, setPendingFlag] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = contacts.filter((contact) => {
      if (status !== "all" && contact.status !== status) return false;
      if (!needle) return true;

      const haystack = [
        contact.name,
        contact.company,
        contact.email,
        contact.owner_name,
      ];
      return haystack.some(
        (field) => field && field.toLowerCase().includes(needle),
      );
    });

    return sortContacts(filtered, sort);
  }, [contacts, query, status, sort]);

  const importantCount = contacts.filter((c) => c.is_important).length;
  const filtersActive = query !== "" || status !== "all" || sort !== "activity";

  function reset() {
    setSelecting(false);
    setConfirming(false);
    setSelected(new Set());
    setError(null);
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function star(id: string, important: boolean) {
    setPendingStar(id);
    setError(null);
    startTransition(async () => {
      const result = await toggleImportant(id, important);
      if (!result.ok) setError(result.message);
      setPendingStar(null);
      router.refresh();
    });
  }

  function flag(id: string, flagged: boolean) {
    setPendingFlag(id);
    setError(null);
    startTransition(async () => {
      const result = await toggleFlagged(id, flagged);
      if (!result.ok) setError(result.message);
      setPendingFlag(null);
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    setNotice(null);

    startTransition(async () => {
      const result = await deleteContacts([...selected]);

      if (!result.ok) {
        setError(result.message);
        setConfirming(false);
        return;
      }

      // Some rows can be refused by RLS while others succeed, so say what
      // actually happened rather than claiming they all went.
      setNotice(
        result.skipped > 0
          ? `Deleted ${result.deleted}. ${result.skipped} could not be deleted, because you can only delete contacts you own.`
          : `Deleted ${result.deleted} ${result.deleted === 1 ? "contact" : "contacts"}.`,
      );
      reset();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {contacts.length} {contacts.length === 1 ? "person" : "people"} in{" "}
            {workspaceName}
            {importantCount > 0 && ` · ${importantCount} important`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selecting ? (
            <>
              <span className="text-sm text-muted-foreground">
                {selected.size} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                disabled={pending || selected.size === 0}
                onClick={() => setConfirming(true)}
              >
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={reset}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              {contacts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNotice(null);
                    setSelecting(true);
                  }}
                >
                  Delete contacts
                </Button>
              )}
              <Link
                href="/contacts/new"
                className={buttonVariants({ size: "sm" })}
              >
                Add contact
              </Link>
            </>
          )}
        </div>
      </div>

      {contacts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, company, email or owner"
            className="max-w-xs"
            aria-label="Search contacts"
          />

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as ContactStatus | "all")
            }
            className={selectClass}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className={selectClass}
            aria-label="Sort contacts"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>

          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatus("all");
                setSort("activity");
              }}
            >
              Reset
            </Button>
          )}

          <span className="ms-auto text-sm text-muted-foreground">
            {visible.length} shown
          </span>
        </div>
      )}

      {confirming && (
        <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm">
            Delete {selected.size}{" "}
            {selected.size === 1 ? "contact" : "contacts"} and their entire
            timelines? This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={remove}
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      {contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">No contacts yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add the first person you want to reach out to.
          </p>
          <Link href="/contacts/new" className={`${buttonVariants()} mt-4`}>
            Add contact
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">Nothing matches</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search or status.
          </p>
        </div>
      ) : (
        <ContactTable
          contacts={visible}
          showOwner={showOwner}
          selectable={selecting}
          selectedIds={selected}
          onToggle={toggle}
          onToggleAll={(checked) =>
            setSelected(checked ? new Set(visible.map((c) => c.id)) : new Set())
          }
          onToggleImportant={star}
          pendingImportantId={pendingStar}
          onToggleFlagged={canFlag ? flag : undefined}
          pendingFlaggedId={pendingFlag}
        />
      )}
    </div>
  );
}
