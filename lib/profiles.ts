import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolves owner/actor ids to display names in one round trip.
 *
 * Done as a separate query rather than a PostgREST embed so the join does not
 * depend on relationship metadata in the generated types.
 */
export async function profileNames(
  supabase: SupabaseServerClient,
  ids: (string | null)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", unique);

  return new Map(
    (data ?? []).map((profile) => [
      profile.id,
      profile.full_name ?? profile.email ?? "Unknown",
    ]),
  );
}
