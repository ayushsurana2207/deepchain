import Link from "next/link";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser, signupOpen } from "@/lib/auth";

export const metadata = { title: "Create account · Deepchain" };

export default async function SignUp() {
  if (await getCurrentUser()) redirect("/app");
  if (!signupOpen())
    return (
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Sign-up is invite-only for now</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          If you were given a demo login, sign in with it. Otherwise, drop us a note and we&apos;ll set you up.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/signin" className="inline-flex h-11 items-center rounded-md bg-ink px-5 font-medium text-paper hover:bg-ink-2">
            Sign in
          </Link>
          <Link href="/#contact" className="inline-flex h-11 items-center rounded-md border border-line-strong px-5 font-medium hover:border-ink">
            Contact us
          </Link>
        </div>
      </div>
    );
  return <AuthForm mode="signup" />;
}
