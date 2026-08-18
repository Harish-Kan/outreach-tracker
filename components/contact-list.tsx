"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ContactTable, type ContactTableRow } from "@/components/contact-table";
import { deleteContacts } from "@/lib/actions/contacts";
import { Button, buttonVariants } from "@/components/ui/button";

/**
 * The contact list plus its toolbar.
 *
 * Selection lives here rather than in the table so the Delete control can sit
 * beside "Add contact" while still driving the checkboxes below it.
 */
export function ContactList({
  contacts,
  showOwner,
  workspaceName,
}: {
  contacts: ContactTableRow[];
  showOwner: boolean;
  workspaceName: string;
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(contacts.map((c) => c.id)) : new Set());
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
          ? `Deleted ${result.deleted}. ${result.skipped} could not be deleted — you can only delete contacts you own.`
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
              <Button variant="ghost" size="sm" disabled={pending} onClick={reset}>
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
              <Link href="/contacts/new" className={buttonVariants({ size: "sm" })}>
                Add contact
              </Link>
            </>
          )}
        </div>
      </div>

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
      ) : (
        <ContactTable
          contacts={contacts}
          showOwner={showOwner}
          selectable={selecting}
          selectedIds={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
        />
      )}
    </div>
  );
}
