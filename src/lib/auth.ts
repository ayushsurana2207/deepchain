import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";

const DATA = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA, "users.json");
const COOKIE = "dc_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

type StoredUser = { id: string; email: string; name: string; salt: string; hash: string; createdAt: string };
export type User = { id: string; email: string; name: string };

async function readUsers(): Promise<StoredUser[]> {
  try {
    return JSON.parse(await fs.readFile(USERS_FILE, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

// shortcut: whole-file JSON rewrite with no locking; fine for a single-instance demo, move to a real DB before multi-user deploy.
async function writeUsers(users: StoredUser[]) {
  await fs.mkdir(DATA, { recursive: true });
  const tmp = `${USERS_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(users, null, 2), { mode: 0o600 });
  await fs.rename(tmp, USERS_FILE);
}

let cachedSecret: string | undefined;
async function secret(): Promise<string> {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (cachedSecret) return cachedSecret;
  // No AUTH_SECRET set: generate one per machine and keep it in data/ (gitignored).
  const file = path.join(DATA, ".auth-secret");
  try {
    cachedSecret = (await fs.readFile(file, "utf8")).trim();
  } catch {
    await fs.mkdir(DATA, { recursive: true });
    cachedSecret = randomBytes(32).toString("hex");
    await fs.writeFile(file, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 64);
const publicUser = (u: StoredUser): User => ({ id: u.id, email: u.email, name: u.name });

export async function createUser(name: string, email: string, password: string): Promise<User | "exists"> {
  const users = await readUsers();
  const normalized = email.trim().toLowerCase();
  if (users.some((u) => u.email === normalized)) return "exists";
  const salt = randomBytes(16).toString("hex");
  const user: StoredUser = {
    id: randomUUID(),
    email: normalized,
    name: name.trim(),
    salt,
    hash: hashPassword(password, salt).toString("hex"),
    createdAt: new Date().toISOString(),
  };
  await writeUsers([...users, user]);
  return publicUser(user);
}

export const signupOpen = () => process.env.ALLOW_SIGNUP === "true";
export const demoAvailable = () => !!(process.env.DEMO_EMAIL && process.env.DEMO_PASSWORD);

/** Shared demo login for judges: created on first sign-in from DEMO_EMAIL / DEMO_PASSWORD env vars. */
async function ensureDemoUser(email: string, password: string) {
  const demoEmail = process.env.DEMO_EMAIL?.trim().toLowerCase();
  const demoPass = process.env.DEMO_PASSWORD;
  if (!demoEmail || !demoPass || email.trim().toLowerCase() !== demoEmail) return;
  const a = Buffer.from(password), b = Buffer.from(demoPass);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return;
  if (!(await readUsers()).some((u) => u.email === demoEmail)) await createUser("Demo", demoEmail, demoPass);
}

export async function verifyLogin(email: string, password: string): Promise<User | null> {
  await ensureDemoUser(email, password);
  const user = (await readUsers()).find((u) => u.email === email.trim().toLowerCase());
  if (!user) {
    hashPassword(password, "0".repeat(32)); // same work as a real check, so timing doesn't reveal which emails exist
    return null;
  }
  return timingSafeEqual(hashPassword(password, user.salt), Buffer.from(user.hash, "hex")) ? publicUser(user) : null;
}

async function sign(value: string) {
  return createHmac("sha256", await secret()).update(value).digest("base64url");
}

export async function startSession(userId: string) {
  const value = `${userId}.${Date.now() + MAX_AGE * 1000}`;
  (await cookies()).set(COOKIE, `${value}.${await sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, exp, sig] = raw.split(".");
  if (!id || !exp || !sig) return null;
  const expected = Buffer.from(await sign(`${id}.${exp}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (Number(exp) < Date.now()) return null;
  const user = (await readUsers()).find((u) => u.id === id);
  return user ? publicUser(user) : null;
}
