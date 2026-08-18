/**
 * Shown the instant a link is clicked, while the server renders the real page.
 *
 * Without this Next keeps the previous page on screen until the new one is
 * ready, so a 400ms navigation reads as a frozen click. It also gives Link
 * something to prefetch, so the shell appears immediately.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy>
      <span className="sr-only">Loading…</span>

      <div className="space-y-2">
        <div className="h-7 w-40 rounded bg-muted" />
        <div className="h-4 w-56 rounded bg-muted" />
      </div>

      <div className="space-y-px overflow-hidden rounded-lg border">
        <div className="h-11 bg-muted/60" />
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="flex h-14 items-center gap-4 px-4">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-5 w-20 rounded-full bg-muted" />
            <div className="ms-auto h-4 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
