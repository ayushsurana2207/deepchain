"use server";

import { saveContact } from "@/lib/contacts";
import { INTERESTS } from "@/lib/interests";

export type ContactState = {
  ok?: boolean;
  error?: string;
  values?: { name: string; email: string; company: string; interest: string; message: string };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function contactAction(_: ContactState, fd: FormData): Promise<ContactState> {
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const values = { name: get("name"), email: get("email"), company: get("company"), interest: get("interest"), message: get("message") };

  // Honeypot: real users never see or fill this field.
  if (get("website")) return { ok: true };

  if (!values.name || values.name.length > 80) return { values, error: "Enter your name (up to 80 characters)." };
  if (!EMAIL_RE.test(values.email) || values.email.length > 254) return { values, error: "Enter a valid email address." };
  if (values.company.length > 120) return { values, error: "Company name is too long." };
  if (!INTERESTS.includes(values.interest)) return { values, error: "Choose what you're interested in." };
  if (values.message.length < 10 || values.message.length > 2000) return { values, error: "Message must be 10 to 2,000 characters." };

  await saveContact(values);
  return { ok: true };
}
