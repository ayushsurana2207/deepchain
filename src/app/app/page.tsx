import { redirect } from "next/navigation";
import { signOutAction } from "@/app/(auth)/actions";
import Workbench from "@/components/workbench/Workbench";
import { getCurrentUser } from "@/lib/auth";
import { recentGraphs } from "@/lib/graphs";

export const metadata = { title: "Workbench · Deepchain" };

export default async function WorkbenchPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return <Workbench recent={await recentGraphs()} email={user.email} signOut={signOutAction} />;
}
