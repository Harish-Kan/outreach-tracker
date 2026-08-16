import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Renamed from middleware.ts in Next.js 16. Same functionality.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — those never need a
     * session refresh and running on them just burns latency.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
