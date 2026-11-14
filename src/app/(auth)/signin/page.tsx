import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Sign in · Deepchain" };

export default async function SignIn() {
  if (await getCurrentUser()) redirect("/app");
  return <AuthForm mode="signin" />;
}
