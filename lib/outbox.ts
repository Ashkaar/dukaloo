import Dexie, { type EntityTable } from "dexie";
import { shopBase, withBase } from "./shopBase";

// Things recorded while offline, waiting to be sent (client only).
//
// Kept in IndexedDB (via Dexie), per shop on this device. Every item
// carries the clientId of what it records, so sending it twice never
// records it twice: the server answers the second time with the first.
// Items go in the order they were made. An item the server refuses for
// good (4xx other than sign-in) is kept with its error for the owner to see,
// and the queue moves on; a network error stops the run until next time.

export type OutboxKind = "sale" | "expense";

export interface OutboxItem {
  id?: number;
  base: string;
  kind: OutboxKind;
  url: string;
  body: unknown;
  createdAt: number;
  attempts: number;
  error: string;
}

class OutboxDb extends Dexie {
  items!: EntityTable<OutboxItem, "id">;
  constructor() {
    super("dukaloo-outbox");
    this.version(1).stores({ items: "++id, base, createdAt" });
  }
}

let db: OutboxDb | null = null;
const open = () => (db ??= new OutboxDb());

const listeners = new Set<() => void>();
export function onOutboxChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const changed = () => listeners.forEach((fn) => fn());

export async function enqueue(kind: OutboxKind, url: string, body: unknown): Promise<void> {
  await open().items.add({ base: shopBase(), kind, url, body, createdAt: Date.now(), attempts: 0, error: "" });
  changed();
}

export async function pending(base = shopBase()): Promise<OutboxItem[]> {
  try {
    return await open().items.where("base").equals(base).sortBy("createdAt");
  } catch {
    return [];
  }
}

// A network failure, as opposed to an answer from the server.
export const isNetworkError = (err: unknown) => err instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);

let running: Promise<{ sent: number; left: number }> | null = null;

// Sends what is waiting for this shop, oldest first.
export function flush(): Promise<{ sent: number; left: number }> {
  running ??= (async () => {
    let sent = 0;
    try {
      for (const item of await pending()) {
        if (item.error) continue;
        let response: Response;
        try {
          response = await fetch(withBase(item.url), {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.body),
          });
        } catch {
          break; // Still offline.
        }
        if (response.ok) {
          await open().items.delete(item.id!);
          sent++;
        } else if (response.status === 401 || response.status >= 500 || response.status === 429) {
          // Signed out or a server problem: try again later, in order.
          await open().items.update(item.id!, { attempts: item.attempts + 1 });
          break;
        } else {
          const data: unknown = await response.json().catch(() => null);
          const message = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : String(response.status);
          await open().items.update(item.id!, { attempts: item.attempts + 1, error: message });
        }
        changed();
      }
    } finally {
      running = null;
      changed();
    }
    return { sent, left: (await pending()).length };
  })();
  return running;
}

// Drops an item the server refused (after the owner has seen it).
export async function discard(id: number): Promise<void> {
  await open().items.delete(id);
  changed();
}
