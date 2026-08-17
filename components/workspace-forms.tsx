"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTeamWorkspace, renameWorkspace } from "@/lib/actions/workspace";
import { joinWithCode } from "@/lib/actions/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await createTeamWorkspace(name);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setName("");
          router.push("/contacts");
          router.refresh();
        });
      }}
      className="space-y-3"
    >
      <div className="space-y-2">
        <Label htmlFor="workspace_name">Workspace name</Label>
        <Input
          id="workspace_name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ops Team"
          required
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="sm" disabled={pending || !name.trim()}>
        {pending ? "Creating…" : "Create workspace"}
      </Button>
    </form>
  );
}

export function JoinWorkspaceForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await joinWithCode(code);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setCode("");
          router.push("/contacts");
          router.refresh();
        });
      }}
      className="space-y-3"
    >
      <div className="space-y-2">
        <Label htmlFor="invite_code">Invite code</Label>
        <Input
          id="invite_code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="abcd234xyz"
          className="font-mono tracking-widest"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="sm" disabled={pending || !code.trim()}>
        {pending ? "Joining…" : "Join workspace"}
      </Button>
    </form>
  );
}

export function RenameWorkspaceForm({
  workspaceId,
  currentName,
}: {
  workspaceId: string;
  currentName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const result = await renameWorkspace(workspaceId, name);
          if (!result.ok) {
            setError(result.message);
            return;
          }
          setSaved(true);
          router.refresh();
        });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="flex-1 space-y-2">
        <Label htmlFor="rename">Workspace name</Label>
        <Input
          id="rename"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Saving…" : saved ? "Saved" : "Rename"}
      </Button>

      {error && (
        <p className="w-full text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export function JoinInviteButton({ code }: { code: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await joinWithCode(code);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.push("/contacts");
            router.refresh();
          });
        }}
      >
        {pending ? "Joining…" : "Join workspace"}
      </Button>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
