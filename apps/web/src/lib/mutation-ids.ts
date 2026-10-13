import { CLIENT_MUTATION_ID_HEADER } from '@flowbit/shared';

// Ids of mutations sent by this tab. Real-time events carrying one of them
// were already applied optimistically and are ignored (D-010).
const recent = new Map<string, number>();
const TTL_MS = 60_000;

function prune(now: number) {
  for (const [id, sentAt] of recent) if (now - sentAt > TTL_MS) recent.delete(id);
}

/** A fresh mutation id, plus the header that sends it. */
export function mutationHeaders() {
  const id = crypto.randomUUID();
  const now = Date.now();
  prune(now);
  recent.set(id, now);
  return { [CLIENT_MUTATION_ID_HEADER]: id };
}

export function isOwnMutation(id: string | null): boolean {
  return id !== null && recent.has(id);
}
