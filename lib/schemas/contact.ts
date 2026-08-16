import { z } from "zod";
import { normalizeEmail } from "@/lib/email";
import { normalizeLinkedInUrl } from "@/lib/linkedin";

export const IDENTIFIER_REQUIRED = "Add a LinkedIn URL or an email address";
export const LINKEDIN_INVALID =
  "Enter a LinkedIn profile URL, like linkedin.com/in/johnsmith";
export const EMAIL_INVALID = "Enter a valid email address";

/**
 * A contact needs at least one identifier. Both are optional individually, but
 * a row with neither cannot be deduplicated against anything, which is the one
 * thing this app exists to do. Mirrored by the contacts_requires_an_identifier
 * constraint in 0001_init.sql.
 */
function checkIdentifiers(
  data: { linkedin_url?: string; email?: string },
  ctx: z.RefinementCtx,
) {
  const linkedin = data.linkedin_url?.trim();
  const email = data.email?.trim();

  if (!linkedin && !email) {
    for (const path of ["linkedin_url", "email"] as const) {
      ctx.addIssue({ code: "custom", path: [path], message: IDENTIFIER_REQUIRED });
    }
    return;
  }

  if (linkedin && normalizeLinkedInUrl(linkedin) === null) {
    ctx.addIssue({
      code: "custom",
      path: ["linkedin_url"],
      message: LINKEDIN_INVALID,
    });
  }

  if (email && normalizeEmail(email) === null) {
    ctx.addIssue({ code: "custom", path: ["email"], message: EMAIL_INVALID });
  }
}

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value ? value : null));

/** Server-side. Empty strings become null so they hit the database as NULL. */
export const contactSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required").max(100),
    last_name: z.string().trim().min(1, "Last name is required").max(100),
    linkedin_url: z.string().trim().max(500).optional(),
    email: z.string().trim().max(320).optional(),
    company: optionalText,
    title: optionalText,
    notes: z
      .string()
      .trim()
      .max(5000)
      .optional()
      .transform((value) => (value ? value : null)),
    mark_as_reached_out: z.boolean().default(false),
  })
  .superRefine(checkIdentifiers);

export type ContactInput = z.input<typeof contactSchema>;
export type ContactParsed = z.output<typeof contactSchema>;

/**
 * The same rules, minus the transforms to null.
 *
 * react-hook-form needs input and output to be the same shape, so the client
 * validates with this and the server re-parses with contactSchema above. The
 * validation messages come from one place either way.
 */
export const contactFormSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required").max(100),
    last_name: z.string().trim().min(1, "Last name is required").max(100),
    linkedin_url: z.string().trim().max(500),
    email: z.string().trim().max(320),
    company: z.string().trim().max(500),
    title: z.string().trim().max(500),
    notes: z.string().trim().max(5000),
    mark_as_reached_out: z.boolean(),
  })
  .superRefine(checkIdentifiers);

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const statusTransitionSchema = z.object({
  contact_id: z.uuid(),
  status: z.enum([
    "added",
    "reached_out",
    "responded",
    "chat_booked",
    "chat_completed",
    "no_response",
    "not_interested",
  ]),
  note: z.string().trim().max(5000).optional(),
});

export const noteSchema = z.object({
  contact_id: z.uuid(),
  note: z.string().trim().min(1, "Write something first").max(5000),
});
