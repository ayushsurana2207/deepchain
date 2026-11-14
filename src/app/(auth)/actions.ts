"use server";

import { redirect } from "next/navigation";
import { createUser, endSession, signupOpen, startSession, verifyLogin } from "@/lib/auth";

export type AuthState = { error?: string; name?: string; email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");

export async function signUpAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const name = str(fd, "name").trim();
  const email = str(fd, "email").trim();
  const password = str(fd, "password");
  const back = { name, email };
  if (!signupOpen()) return { ...back, error: "Sign-up is closed right now. Use the demo login, or contact us for access." };

  if (!name || name.length > 80) return { ...back, error: "Enter your name (up to 80 characters)." };
  if (!EMAIL_RE.test(email) || email.length > 254) return { ...back, error: "Enter a valid email address." };
  if (password.length < 8 || password.length > 128) return { ...back, error: "Password must be 8 to 128 characters." };

  const user = await createUser(name, email, password);
  if (user === "exists") return { ...back, error: "An account with this email already exists. Sign in instead." };

  await startSession(user.id);
  redirect("/app");
}

export async function signInAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = str(fd, "email").trim();
  const password = str(fd, "password");
  if (!email || !password || password.length > 128) return { email, error: "Enter your email and password." };

  const user = await verifyLogin(email, password);
  if (!user) return { email, error: "Email or password is incorrect." };

  await startSession(user.id);
  redirect("/app");
}

/** One-click sign-in to the shared demo account (credentials stay on the server). */
export async function demoSignInAction() {
  const email = process.env.DEMO_EMAIL, password = process.env.DEMO_PASSWORD;
  const user = email && password ? await verifyLogin(email, password) : null;
  if (!user) redirect("/signin");
  await startSession(user.id);
  redirect("/app");
}

export async function signOutAction() {
  await endSession();
  redirect("/");
}
