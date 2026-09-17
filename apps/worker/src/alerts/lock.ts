import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";

/**
 * Prefix for alert evaluation concurrency locks in Redis.
 * Key format: alert:lock:{ruleId}
 */
const LOCK_KEY_PREFIX = "alert:lock:";

/**
 * Default lock TTL in milliseconds.
 * 10 seconds is well above the time needed to query ClickHouse and perform
 * a Postgres transaction, while short enough to automatically expire if a worker crashes.
 */
const DEFAULT_LOCK_TTL_MS = 10_000;

/**
 * Lua script for atomic ownership-safe lock release:
 * Checks if key exists and its value matches the owner token; if so, deletes the key.
 * Returns 1 if released, 0 if not owner or lock already expired.
 */
const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

export function getLockKey(ruleId: string): string {
  return `${LOCK_KEY_PREFIX}${ruleId}`;
}

export interface AcquiredLock {
  ruleId: string;
  token: string;
  release: () => Promise<boolean>;
}

/**
 * Attempts to acquire an exclusive, distributed evaluation lock for an alert rule.
 * Uses atomic SET key token PX ttlMs NX.
 *
 * @param redis Redis client instance
 * @param ruleId ID of the alert rule
 * @param ttlMs Lock time-to-live in milliseconds
 * @returns AcquiredLock object if acquired, or null if lock is currently held by another worker
 */
export async function acquireAlertLock(
  redis: Redis,
  ruleId: string,
  ttlMs = DEFAULT_LOCK_TTL_MS
): Promise<AcquiredLock | null> {
  const token = randomUUID();
  const key = getLockKey(ruleId);

  const result = await redis.set(key, token, "PX", ttlMs, "NX");
  if (result !== "OK") {
    return null;
  }

  let released = false;
  const release = async (): Promise<boolean> => {
    if (released) return true;
    const res = await releaseAlertLock(redis, ruleId, token);
    released = true;
    return res;
  };

  return {
    ruleId,
    token,
    release,
  };
}

/**
 * Releases a lock safely using atomic Lua script to verify token ownership.
 * Prevents a slow worker from deleting a lock that has expired and was re-acquired by another worker.
 */
export async function releaseAlertLock(
  redis: Redis,
  ruleId: string,
  token: string
): Promise<boolean> {
  const key = getLockKey(ruleId);
  try {
    const res = await redis.eval(RELEASE_LOCK_LUA, 1, key, token);
    return res === 1;
  } catch {
    return false;
  }
}
