"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActiveWorkspace } from "@/lib/actions/workspace";

export function WorkspaceSwitcher({
  options,
  activeId,
}: {
  options: { id: string; name: string }[];
  activeId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // A plain select: one workspace or twenty, it behaves the same and needs no
  // keyboard handling of its own.
  return (
    <select
      aria-label="Active workspace"
      value={activeId}
      disabled={pending || options.length < 2}
      onChange={(event) => {
        const next = event.target.value;
        startTransition(async () => {
          await setActiveWorkspace(next);
          router.refresh();
        });
      }}
      className="rounded-md border bg-background px-2 py-1 text-sm disabled:opacity-70"
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
}
