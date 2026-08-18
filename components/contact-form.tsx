"use client";

import Link from "next/link";
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
  updateContact,
  type DuplicateMatch,
} from "@/lib/actions/contacts";
import { normalizeEmail } from "@/lib/email";
import { normalizeLinkedInUrl } from "@/lib/linkedin";
import { CompanyInput } from "@/components/company-input";
import { DuplicateNotice } from "@/components/duplicate-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export type ContactFormInitial = {
  id: string;
  name: string;
  linkedin_url: string | null;
  email: string | null;
  company: string | null;
  title: string | null;
  notes: string | null;
};

/**
 * Used for both adding and editing. In edit mode the contact is excluded from
 * its own duplicate check, otherwise saving without changing anything would
 * report the contact as a duplicate of itself.
 */
export function ContactForm({ contact }: { contact?: ContactFormInitial }) {
  const isEdit = contact !== undefined;
  const router = useRouter();
  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [checking, setChecking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Guards against out-of-order responses: a slow check for an old value must
  // not overwrite the result for what is currently in the fields.
  const inFlightFor = useRef<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: contact?.name ?? "",
      linkedin_url: contact?.linkedin_url ?? "",
      email: contact?.email ?? "",
      company: contact?.company ?? "",
      title: contact?.title ?? "",
      notes: contact?.notes ?? "",
      mark_as_reached_out: false,
    },
  });

  const markAsReachedOut = watch("mark_as_reached_out");
  const company = watch("company");

  /**
   * Runs on blur of either identifier and sends both, so filling in only the
   * email still catches a person already tracked by that address.
   */
  async function checkForDuplicate() {
    const { linkedin_url, email } = getValues();

    const linkedinKey = normalizeLinkedInUrl(linkedin_url ?? "");
    const emailKey = normalizeEmail(email ?? "");

    if (!linkedinKey && !emailKey) {
      inFlightFor.current = null;
      setDuplicate(null);
      return;
    }

    const requestKey = `${linkedinKey ?? ""}|${emailKey ?? ""}`;
    if (inFlightFor.current === requestKey) return;
    inFlightFor.current = requestKey;

    setChecking(true);
    try {
      const match = await lookupDuplicate({
        linkedin_url,
        email,
        exclude_contact_id: contact?.id,
      });
      if (inFlightFor.current === requestKey) setDuplicate(match);
    } catch {
      // A failed check must not block the form; the unique indexes still catch
      // the duplicate on submit.
      if (inFlightFor.current === requestKey) setDuplicate(null);
    } finally {
      if (inFlightFor.current === requestKey) setChecking(false);
    }
  }

  const onSubmit = handleSubmit((values) => {
    setFormError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateContact(contact.id, values)
        : await createContact(values);

      if (result.ok) {
        router.push(`/contacts/${result.contactId}`);
        router.refresh();
        return;
      }

      if (result.kind === "duplicate") {
        setDuplicate(result.match);
        return;
      }

      if (result.kind === "validation") {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.length) {
            setError(field as keyof ContactFormValues, { message: messages[0] });
          }
        }
        return;
      }

      setFormError(result.message);
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Field label="Name" error={errors.name?.message} required>
        <Input
          {...register("name")}
          placeholder="Chris Pop"
          autoComplete="off"
        />
      </Field>

      {/* The identifiers. Either one is enough, and both are what we check
          the workspace against before anyone wastes a message. */}
      <fieldset className="space-y-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">
          How do we identify them?
        </legend>

        <p className="text-sm text-muted-foreground">
          {checking
            ? "Checking whether anyone already has them…"
            : "At least one is required. We check both against the workspace before you save."}
        </p>

        <Field label="LinkedIn URL" error={errors.linkedin_url?.message}>
          <Input
            {...register("linkedin_url", { onBlur: checkForDuplicate })}
            placeholder="linkedin.com/in/christopherpop"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>

        <Field label="Email" error={errors.email?.message}>
          <Input
            {...register("email", { onBlur: checkForDuplicate })}
            type="email"
            placeholder="chris@company.com"
            autoComplete="off"
          />
        </Field>

        {duplicate && <DuplicateNotice match={duplicate} />}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" error={errors.company?.message}>
          <CompanyInput
            value={company}
            onChange={(next) => setValue("company", next)}
          />
        </Field>

        <Field label="Title" error={errors.title?.message}>
          <Input {...register("title")} autoComplete="off" />
        </Field>
      </div>

      <Field label="Notes" error={errors.notes?.message}>
        <Textarea {...register("notes")} rows={4} />
      </Field>

      {/* Only on create. Changing status later goes through the detail page so
          it always writes an interaction row. */}
      {!isEdit && (
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
      )}

      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || duplicate !== null}>
          {pending
            ? isEdit
              ? "Saving…"
              : "Adding…"
            : isEdit
              ? "Save changes"
              : "Add contact"}
        </Button>

        {isEdit && (
          <Link
            href={`/contacts/${contact.id}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            Cancel
          </Link>
        )}

        {duplicate && (
          <p className="text-sm text-muted-foreground">
            Clear the matching field to continue.
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
