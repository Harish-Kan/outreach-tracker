"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeEmail } from "@/lib/email";
import { normalizeLinkedInUrl } from "@/lib/linkedin";
import { contactSchema, statusTransitionSchema } from "@/lib/schemas/contact";
import { requireWorkspace, type WorkspaceContext } from "@/lib/workspace";
import type { ContactStatus } from "@/types/database";

/** What we show when someone is already in the workspace. */
export type DuplicateMatch = {
  id: string;
  name: string;
  status: ContactStatus;
  owner_name: string | null;
  is_mine: boolean;
  /** Which identifier collided, so the notice can say why. */
  matched_on: "linkedin" | "email";
};

export type SaveContactResult =
  | { ok: true; contactId: string }
  | { ok: false; kind: "validation"; fieldErrors: Record<string, string[]> }
  | { ok: false; kind: "duplicate"; match: DuplicateMatch }
  | { ok: false; kind: "error"; message: string };

type IdentifierKeys = {
  linkedin: string | null;
  email: string | null;
};

const PG_UNIQUE_VIOLATION = "23505";
const CONTACT_COLUMNS = "id, name, status, owner_id";

async function findDuplicate(
  context: WorkspaceContext,
  keys: IdentifierKeys,
  /** Editing a contact must not match it against itself. */
  excludeContactId?: string,
): Promise<DuplicateMatch | null> {
  const { supabase, workspace, userId } = context;

  const query = (column: "linkedin_url_normalized" | "email_normalized", value: string) => {
    let q = supabase
      .from("contacts")
      .select(CONTACT_COLUMNS)
      .eq("workspace_id", workspace.id)
      .eq(column, value);

    if (excludeContactId) q = q.neq("id", excludeContactId);
    return q.maybeSingle();
  };

  let contact: {
    id: string;
    name: string;
    status: ContactStatus;
    owner_id: string | null;
  } | null = null;
  let matchedOn: "linkedin" | "email" = "linkedin";

  if (keys.linkedin) {
    const { data } = await query("linkedin_url_normalized", keys.linkedin);
    if (data) {
      contact = data;
      matchedOn = "linkedin";
    }
  }

  if (!contact && keys.email) {
    const { data } = await query("email_normalized", keys.email);
    if (data) {
      contact = data;
      matchedOn = "email";
    }
  }

  if (!contact) return null;

  let ownerName: string | null = null;
  if (contact.owner_id) {
    const { data: owner } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", contact.owner_id)
      .maybeSingle();
    ownerName = owner?.full_name ?? owner?.email ?? null;
  }

  return {
    id: contact.id,
    name: contact.name,
    status: contact.status,
    owner_name: ownerName,
    is_mine: contact.owner_id === userId,
    matched_on: matchedOn,
  };
}

function identifierKeys(linkedinRaw: string | null, emailRaw: string | null): IdentifierKeys {
  return {
    linkedin: linkedinRaw ? normalizeLinkedInUrl(linkedinRaw) : null,
    email: emailRaw ? normalizeEmail(emailRaw) : null,
  };
}

/**
 * The on-blur check from spec §8, covering both identifiers.
 *
 * Advisory only — two people can still blur the field at the same instant, so
 * the unique indexes remain the real authority and the save handles the
 * collision.
 */
export async function lookupDuplicate(input: {
  linkedin_url?: string;
  email?: string;
  exclude_contact_id?: string;
}): Promise<DuplicateMatch | null> {
  const keys = identifierKeys(input.linkedin_url ?? null, input.email ?? null);
  if (!keys.linkedin && !keys.email) return null;

  const context = await requireWorkspace();
  return findDuplicate(context, keys, input.exclude_contact_id);
}

export async function createContact(input: unknown): Promise<SaveContactResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "validation",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const linkedinRaw = parsed.data.linkedin_url?.trim() || null;
  const emailRaw = parsed.data.email?.trim() || null;
  const keys = identifierKeys(linkedinRaw, emailRaw);

  const context = await requireWorkspace();
  const { supabase, workspace } = context;

  const { data: contactId, error } = await supabase.rpc("create_contact", {
    p_workspace_id: workspace.id,
    p_name: parsed.data.name,
    p_linkedin_url: keys.linkedin ? linkedinRaw : null,
    p_linkedin_url_normalized: keys.linkedin,
    p_email: keys.email ? emailRaw : null,
    p_email_normalized: keys.email,
    p_company: parsed.data.company,
    p_title: parsed.data.title,
    p_notes: parsed.data.notes,
    p_mark_reached_out: parsed.data.mark_as_reached_out,
  });

  if (error) {
    // The hard block. Someone got here first — show them who.
    if (error.code === PG_UNIQUE_VIOLATION) {
      const match = await findDuplicate(context, keys);
      if (match) return { ok: false, kind: "duplicate", match };
    }
    return { ok: false, kind: "error", message: error.message };
  }

  revalidatePath("/contacts");
  revalidatePath("/");
  return { ok: true, contactId: contactId as string };
}

export async function updateContact(
  contactId: string,
  input: unknown,
): Promise<SaveContactResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      kind: "validation",
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    };
  }

  const linkedinRaw = parsed.data.linkedin_url?.trim() || null;
  const emailRaw = parsed.data.email?.trim() || null;
  const keys = identifierKeys(linkedinRaw, emailRaw);

  const context = await requireWorkspace();
  const { supabase } = context;

  const { error } = await supabase.rpc("update_contact", {
    p_contact_id: contactId,
    p_name: parsed.data.name,
    p_linkedin_url: keys.linkedin ? linkedinRaw : null,
    p_linkedin_url_normalized: keys.linkedin,
    p_email: keys.email ? emailRaw : null,
    p_email_normalized: keys.email,
    p_company: parsed.data.company,
    p_title: parsed.data.title,
    p_notes: parsed.data.notes,
  });

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      const match = await findDuplicate(context, keys, contactId);
      if (match) return { ok: false, kind: "duplicate", match };
    }
    return { ok: false, kind: "error", message: error.message };
  }

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  revalidatePath("/");
  return { ok: true, contactId };
}

export async function advanceStatus(input: unknown) {
  const parsed = statusTransitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Invalid status change" };
  }

  const { supabase } = await requireWorkspace();

  const { error } = await supabase.rpc("advance_contact_status", {
    p_contact_id: parsed.data.contact_id,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? null,
  });

  if (error) return { ok: false as const, message: error.message };

  revalidatePath(`/contacts/${parsed.data.contact_id}`);
  revalidatePath("/contacts");
  revalidatePath("/");
  return { ok: true as const };
}

export async function takeOwnership(contactId: string) {
  const { supabase } = await requireWorkspace();

  const { error } = await supabase.rpc("take_contact_ownership", {
    p_contact_id: contactId,
  });

  if (error) return { ok: false as const, message: error.message };

  revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  return { ok: true as const };
}
