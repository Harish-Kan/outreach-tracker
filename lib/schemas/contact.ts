import { z } from "zod";
import { normalizeLinkedInUrl } from "@/lib/linkedin";

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => (value ? value : null));

/**
 * Shared by the form and the server action, so the client cannot submit
 * anything the server would not have accepted anyway.
 */
export const contactSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().min(1, "Last name is required").max(100),
  linkedin_url: z
    .string()
    .trim()
    .min(1, "LinkedIn URL is required")
    .refine((value) => normalizeLinkedInUrl(value) !== null, {
      message: "Enter a LinkedIn profile URL, like linkedin.com/in/johnsmith",
    }),
  company: optionalText,
  title: optionalText,
  email: z
    .union([z.literal(""), z.email("Enter a valid email address")])
    .optional()
    .transform((value) => (value ? value : null)),
  notes: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .transform((value) => (value ? value : null)),
  mark_as_reached_out: z.boolean().default(false),
});

export type ContactInput = z.input<typeof contactSchema>;
export type ContactParsed = z.output<typeof contactSchema>;

/**
 * The same rules, minus the transforms to null.
 *
 * react-hook-form needs input and output to be the same shape, so the client
 * validates with this and the server re-parses with contactSchema above. The
 * validation messages come from one place either way.
 */
export const contactFormSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().min(1, "Last name is required").max(100),
  linkedin_url: z
    .string()
    .trim()
    .min(1, "LinkedIn URL is required")
    .refine((value) => normalizeLinkedInUrl(value) !== null, {
      message: "Enter a LinkedIn profile URL, like linkedin.com/in/johnsmith",
    }),
  company: z.string().trim().max(500),
  title: z.string().trim().max(500),
  email: z.union([z.literal(""), z.email("Enter a valid email address")]),
  notes: z.string().trim().max(5000),
  mark_as_reached_out: z.boolean(),
});

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
