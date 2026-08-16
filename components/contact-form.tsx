"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  contactFormSchema,
  type ContactFormValues,
} from "@/lib/schemas/contact";
import {
  createContact,
  lookupDuplicate,
  type DuplicateMatch,
} from "@/lib/actions/contacts";
import { normalizeLinkedInUrl } from "@/lib/linkedin";
import { DuplicateNotice } from "@/components/duplicate-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export function ContactForm() {
  const router = useRouter();
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [checking, setChecking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Guards against out-of-order responses: a slow check for an old URL must not
  // overwrite the result for the one currently in the field.
  const inFlightFor = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      linkedin_url: "",
      company: "",
      title: "",
      email: "",
      notes: "",
      mark_as_reached_out: false,
    },
  });

  const markAsReachedOut = watch("mark_as_reached_out");

  async function checkForDuplicate(rawUrl: string) {
    const normalized = normalizeLinkedInUrl(rawUrl);

    if (!normalized) {
      inFlightFor.current = null;
      setDuplicate(null);
      return;
    }

    if (inFlightFor.current === normalized) return;
    inFlightFor.current = normalized;

    setChecking(true);
    try {
      const match = await lookupDuplicate(rawUrl);
      if (inFlightFor.current === normalized) setDuplicate(match);
    } catch {
      // A failed check must not block the form; the unique index still catches
      // the duplicate on submit.
      if (inFlightFor.current === normalized) setDuplicate(null);
    } finally {
      if (inFlightFor.current === normalized) setChecking(false);
    }
  }

  const onSubmit = handleSubmit((values) => {
    setFormError(null);

    startTransition(async () => {
      const result = await createContact(values);

      if (result.ok) {
        router.push(`/contacts/${result.contactId}`);
        return;
      }

      if (result.kind === "duplicate") {
        setDuplicate(result.match);
        return;
      }

      if (result.kind === "validation") {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.length) {
            setError(field as keyof ContactFormValues, {
              message: messages[0],
            });
          }
        }
        return;
      }

      setFormError(result.message);
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.first_name?.message} required>
          <Input {...register("first_name")} autoComplete="off" />
        </Field>

        <Field label="Last name" error={errors.last_name?.message} required>
          <Input {...register("last_name")} autoComplete="off" />
        </Field>
      </div>

      <Field
        label="LinkedIn URL"
        error={errors.linkedin_url?.message}
        required
        hint={
          checking
            ? "Checking whether anyone already has them…"
            : "We check this against the workspace before you submit."
        }
      >
        <Input
          {...register("linkedin_url", {
            onBlur: (event) => checkForDuplicate(event.target.value),
          })}
          placeholder="linkedin.com/in/johnsmith"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>

      {duplicate && <DuplicateNotice match={duplicate} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" error={errors.company?.message}>
          <Input {...register("company")} autoComplete="off" />
        </Field>

        <Field label="Title" error={errors.title?.message}>
          <Input {...register("title")} autoComplete="off" />
        </Field>
      </div>

      <Field label="Email" error={errors.email?.message}>
        <Input {...register("email")} type="email" autoComplete="off" />
      </Field>

      <Field label="Notes" error={errors.notes?.message}>
        <Textarea {...register("notes")} rows={4} />
      </Field>

      <label className="flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          checked={markAsReachedOut}
          onCheckedChange={(checked) =>
            setValue("mark_as_reached_out", checked === true)
          }
          className="mt-0.5"
        />
        <span className="text-sm">
          <span className="font-medium">I have already reached out</span>
          <span className="mt-1 block text-muted-foreground">
            Sets the status to Reached out, makes you the owner, and logs the
            first entry in their timeline.
          </span>
        </span>
      </label>

      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || duplicate !== null}>
          {pending ? "Adding…" : "Add contact"}
        </Button>

        {duplicate && (
          <p className="text-sm text-muted-foreground">
            Clear the LinkedIn URL to add someone else.
          </p>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
