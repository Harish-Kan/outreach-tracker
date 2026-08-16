"use server";

import { revalidatePath } from "next/cache";
import { noteSchema } from "@/lib/schemas/contact";
import { requireWorkspace } from "@/lib/workspace";

export async function addNote(input: unknown) {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "Write something first" };
  }

  const { supabase } = await requireWorkspace();

  const { error } = await supabase.rpc("log_contact_note", {
    p_contact_id: parsed.data.contact_id,
    p_note: parsed.data.note,
  });

  if (error) return { ok: false as const, message: error.message };

  revalidatePath(`/contacts/${parsed.data.contact_id}`);
  return { ok: true as const };
}
