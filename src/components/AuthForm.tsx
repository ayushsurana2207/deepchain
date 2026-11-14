"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction, type AuthState } from "@/app/(auth)/actions";

const input =
  "h-11 w-full rounded-md border border-line-strong bg-card px-3 text-[15px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-ink focus:ring-2 focus:ring-amber/40";

export default function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const signup = mode === "signup";
  const [state, action, pending] = useActionState<AuthState, FormData>(signup ? signUpAction : signInAction, {});

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{signup ? "Create your account" : "Welcome back"}</h1>
      <p className="mt-2 text-sm text-muted">
        {signup ? "Trace your first supply chain in under a minute." : "Sign in to open your workbench."}
      </p>

      <form action={action} className="mt-8 flex flex-col gap-4">
        {signup && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">Name</label>
            <input id="name" name="name" autoComplete="name" required maxLength={80} defaultValue={state.name} className={input} />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">Work email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            defaultValue={state.email}
            placeholder="you@company.com"
            className={input}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? 8 : undefined}
            maxLength={128}
            className={input}
          />
          {signup && <span className="text-xs text-muted">At least 8 characters.</span>}
        </div>

        {state.error && (
          <p role="alert" className="rounded-md border border-risk-line bg-risk-tint px-3 py-2 text-sm text-risk-ink">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink font-medium text-paper transition-colors hover:bg-ink-2 disabled:cursor-wait disabled:opacity-80"
        >
          {pending && <span aria-hidden="true" className="pulse h-1.5 w-1.5 rounded-full bg-amber" />}
          {pending ? (signup ? "Creating account…" : "Signing in…") : signup ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        {signup ? "Already have an account? " : "New to Deepchain? "}
        <Link href={signup ? "/signin" : "/signup"} className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
