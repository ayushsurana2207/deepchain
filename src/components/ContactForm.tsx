"use client";

import { useActionState } from "react";
import { contactAction, type ContactState } from "@/app/contact-action";
import { INTERESTS } from "@/lib/interests";

const field =
  "w-full rounded-md border border-line-strong bg-card px-3 text-[15px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-ink focus:ring-2 focus:ring-amber/40";

export default function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(contactAction, {});

  if (state.ok)
    return (
      <div role="status" className="flex flex-col items-start gap-2 rounded-lg border border-amber-line bg-amber-tint p-6">
        <span className="font-mono text-xs tracking-[0.08em] text-amber-ink">MESSAGE RECEIVED</span>
        <p className="text-lg font-semibold">Thanks, we&apos;ll be in touch.</p>
        <p className="text-sm text-muted">We&apos;ll reply to the email address you gave us.</p>
      </div>
    );

  const v = state.values;
  return (
    // key remounts the form after an error so every field (incl. the select, which React's form reset clears) shows the submitted values
    <form key={JSON.stringify(v ?? {})} action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="c-name" className="text-sm font-medium">Name</label>
        <input id="c-name" name="name" required maxLength={80} autoComplete="name" defaultValue={v?.name} className={`${field} h-11`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="c-email" className="text-sm font-medium">Work email</label>
        <input id="c-email" name="email" type="email" required maxLength={254} autoComplete="email" defaultValue={v?.email} className={`${field} h-11`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="c-company" className="text-sm font-medium">
          Company <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="c-company" name="company" maxLength={120} autoComplete="organization" defaultValue={v?.company} className={`${field} h-11`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="c-interest" className="text-sm font-medium">I&apos;m interested in</label>
        <select id="c-interest" name="interest" required defaultValue={v?.interest ?? ""} className={`${field} h-11`}>
          <option value="" disabled>Choose one…</option>
          {INTERESTS.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor="c-message" className="text-sm font-medium">How can we help?</label>
        <textarea
          id="c-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          defaultValue={v?.message}
          placeholder="e.g. We want to map single-source suppliers behind our HBM and substrate exposure."
          className={`${field} py-2.5`}
        />
      </div>
      {/* Honeypot, hidden from people and assistive tech */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {state.error && (
        <p role="alert" className="rounded-md border border-risk-line bg-risk-tint px-3 py-2 text-sm text-risk-ink sm:col-span-2">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-ink px-5 font-medium text-paper transition-colors hover:bg-ink-2 disabled:cursor-wait disabled:opacity-80"
        >
          {pending && <span aria-hidden="true" className="pulse h-1.5 w-1.5 rounded-full bg-amber" />}
          {pending ? "Sending…" : "Send message"}
        </button>
        <span className="text-xs text-muted">We only use your details to reply to you.</span>
      </div>
    </form>
  );
}
