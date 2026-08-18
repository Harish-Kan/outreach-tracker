"use server";

import { revalidatePath } from "next/cache";
import { clientKey, rateLimit, tooManyMessage } from "@/lib/rate-limit";
import { requireWorkspace } from "@/lib/workspace";
import type { NoteVisibility } from "@/types/database";

const MAX_BODY = 2000;
const WRITE_LIMIT = 60;
const MINUTE_MS = 60 * 1000;

/** Postgres: relation does not exist — migration 0011 has not been run. */
const UNDEFINED_TABLE = "42P01";
/** PostgREST: the table is not in the schema cache, same cause. */
const MISSING_TABLE = "PGRST205";

export type NoteResult = { ok: true } | { ok: false; message: string };

function missingTable(code?: string) {
  return code === UNDEFINED_TABLE || code === MISSING_TABLE;
}

function translate(code: string | undefined, fallback: string) {
  if (missingTable(code)) {
    return "Notes need migration 0011. Run supabase/apply_0011.sql.";
  }
  return fallback;
}

export async function createNote(
  body: string,
  visibility: NoteVisibility,
): Promise<NoteResult> {
  const text = body.trim();
  if (!text) return { ok: false, message: "Write something first" };
  if (text.length > MAX_BODY) {
    return { ok: false, message: `Notes are capped at ${MAX_BODY} characters` };
  }

  const { supabase, workspace, userId } = await requireWorkspace();

  const limit = rateLimit(
    `note:${await clientKey(userId)}`,
    WRITE_LIMIT,
    MINUTE_MS,
  );
  if (!limit.ok) return { ok: false, message: tooManyMessage(limit.retryAfter, "notes") };

  const { error } = await supabase.from("notes").insert({
    workspace_id: workspace.id,
    // Set explicitly and also pinned by the RLS check, so a note cannot be
    // filed under anyone else's name.
    author_id: userId,
    body: text,
    visibility,
  });

  if (error) return { ok: false, message: translate(error.code, error.message) };

  revalidatePath("/contacts");
  return { ok: true };
}

export async function updateNote(
  noteId: string,
  body: string,
  visibility: NoteVisibility,
): Promise<NoteResult> {
  const text = body.trim();
  if (!text) return { ok: false, message: "Write something first" };
  if (text.length > MAX_BODY) {
    return { ok: false, message: `Notes are capped at ${MAX_BODY} characters` };
  }

  const { supabase, workspace } = await requireWorkspace();

  const { data, error } = await supabase
    .from("notes")
    .update({ body: text, visibility })
    .eq("id", noteId)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return { ok: false, message: translate(error.code, error.message) };

  // RLS refuses a non-author's update silently: no error, no rows. Comparing
  // the count is the only way to tell "denied" from "done".
  if (!data?.length) {
    return { ok: false, message: "You can only edit your own notes." };
  }

  revalidatePath("/contacts");
  return { ok: true };
}

export async function deleteNote(noteId: string): Promise<NoteResult> {
  const { supabase, workspace } = await requireWorkspace();

  const { data, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("workspace_id", workspace.id)
    .select("id");

  if (error) return { ok: false, message: translate(error.code, error.message) };
  if (!data?.length) {
    return { ok: false, message: "You can only delete your own notes." };
  }

  revalidatePath("/contacts");
  return { ok: true };
}
