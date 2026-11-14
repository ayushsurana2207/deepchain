import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "contacts.json");

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  company: string;
  interest: string;
  message: string;
  createdAt: string;
};

// shortcut: JSON file, read-modify-write without locking; fine for a demo's contact volume, move to a DB or email/CRM hook for real traffic.
export async function saveContact(m: Omit<ContactMessage, "id" | "createdAt">) {
  let all: ContactMessage[] = [];
  try {
    all = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  all.push({ ...m, id: randomUUID(), createdAt: new Date().toISOString() });
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(all, null, 2), { mode: 0o600 });
  await fs.rename(tmp, FILE);
}
