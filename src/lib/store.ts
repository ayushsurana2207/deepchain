import { promises as fs } from "node:fs";
import path from "node:path";

// Response cache in data/store.json so the demo survives bad Wi-Fi or rate limits.
const FILE = path.join(process.cwd(), "data", "store.json");

// First boot on a fresh disk (e.g. a new deploy): start from the searches shipped in seed/store.json.
const SEED = path.join(process.cwd(), "seed", "store.json");

async function readAll(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    try {
      return JSON.parse(await fs.readFile(SEED, "utf8"));
    } catch {
      return {};
    }
  }
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  return (await readAll())[key] as T | undefined;
}

// shortcut: read-modify-write of one JSON file, no locking; concurrent writes can drop an entry. Fine for one demo user; use SQLite if that changes.
export async function cachePut(key: string, value: unknown) {
  const all = await readAll();
  if (value === undefined) delete all[key];
  else all[key] = value;
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(all, null, 2));
  await fs.rename(tmp, FILE);
}

export async function cacheKeys(prefix: string): Promise<string[]> {
  return Object.keys(await readAll()).filter((k) => k.startsWith(prefix));
}
