"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createNote, deleteNote, updateNote } from "@/lib/actions/notes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { relativeDays } from "@/lib/format";
import type { NoteVisibility } from "@/types/database";

export type NoteRow = {
  id: string;
  body: string;
  visibility: NoteVisibility;
  author_name: string | null;
  is_mine: boolean;
  created_at: string;
};

const MAX_BODY = 2000;

export function NotesPanel({ notes }: { notes: NoteRow[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  // Private is the default. The cost of a note nobody else sees is an unread
  // reminder; the cost of the reverse is a thought you meant to keep to
  // yourself showing up on a teammate's screen.
  const [visibility, setVisibility] = useState<NoteVisibility>("private");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await createNote(body, visibility);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  function saveEdit(note: NoteRow, nextVisibility: NoteVisibility) {
    setError(null);
    startTransition(async () => {
      const result = await updateNote(
        note.id,
        editing === note.id ? draft : note.body,
        nextVisibility,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteNote(id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <aside className="space-y-4">
      <div>
        <h2 className="font-medium">Notes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reminders for the workspace. Private notes stay yours.
        </p>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Ask the recruiter about the new grad track…"
          rows={3}
          maxLength={MAX_BODY}
          aria-label="New note"
          className="resize-none"
        />

        <div className="flex items-center gap-2">
          <VisibilityPicker value={visibility} onChange={setVisibility} />
          <Button
            size="sm"
            className="ms-auto"
            disabled={pending || body.trim() === ""}
            onClick={save}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No notes yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border p-3 text-sm">
              {editing === note.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={3}
                    maxLength={MAX_BODY}
                    aria-label="Edit note"
                    className="resize-none"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="xs"
                      disabled={pending || draft.trim() === ""}
                      onClick={() => saveEdit(note, note.visibility)}
                    >
                      Save
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => setEditing(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap break-words">{note.body}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <VisibilityBadge visibility={note.visibility} />
                    <span>
                      {note.is_mine ? "you" : (note.author_name ?? "someone")}
                    </span>
                    <span>·</span>
                    <span>{relativeDays(note.created_at)}</span>

                    {/* Author only. RLS refuses everyone else anyway, so
                        offering the buttons would just mislead. */}
                    {note.is_mine && (
                      <span className="ms-auto flex items-center gap-1">
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            saveEdit(
                              note,
                              note.visibility === "private"
                                ? "public"
                                : "private",
                            )
                          }
                        >
                          Make{" "}
                          {note.visibility === "private" ? "public" : "private"}
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => {
                            setEditing(note.id);
                            setDraft(note.body);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          className="hover:text-destructive"
                          disabled={pending}
                          onClick={() => remove(note.id)}
                        >
                          Delete
                        </Button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function VisibilityPicker({
  value,
  onChange,
}: {
  value: NoteVisibility;
  onChange: (next: NoteVisibility) => void;
}) {
  return (
    <div
      className="inline-flex rounded-md border p-0.5"
      role="radiogroup"
      aria-label="Who can see this note"
    >
      {(["private", "public"] as const).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={`rounded px-2 py-1 text-xs capitalize transition-colors ${
            value === option
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function VisibilityBadge({ visibility }: { visibility: NoteVisibility }) {
  const isPrivate = visibility === "private";
  return (
    <span
      className={`rounded-full border px-1.5 py-0.5 ${
        isPrivate
          ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
          : "text-muted-foreground"
      }`}
    >
      {isPrivate ? "Private" : "Public"}
    </span>
  );
}
