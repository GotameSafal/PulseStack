import type { Redis } from "ioredis";

/**
 * Prefix for alert cooldown keys in Redis.
 */
const COOLDOWN_KEY_PREFIX = "alert:cooldown:";

/**
 * Returns the Redis key for a given alert rule's cooldown lock.
 */
export function getCooldownKey(ruleId: string): string {
  return `${COOLDOWN_KEY_PREFIX}${ruleId}`;
}

/**
 * Checks if a rule is currently within its cooldown period.
 */
export async function isCooldownActive(
  redis: Redis,
  ruleId: string
): Promise<boolean> {
  const exists = await redis.exists(getCooldownKey(ruleId));
  return exists === 1;
}

/**
 * Sets a cooldown lock for an alert rule with an expiration (in seconds).
 * @param cooldownMinutes Duration of the cooldown in minutes (defaults to 15m if <= 0)
 */
export async function setCooldown(
  redis: Redis,
  ruleId: string,
  cooldownMinutes: number
): Promise<void> {
  const ttlSeconds = Math.max(1, Math.round(cooldownMinutes * 60));
  const key = getCooldownKey(ruleId);
  await redis.set(key, "1", "EX", ttlSeconds);
}

/**
 * Clears the cooldown lock for an alert rule (e.g. when the metric recovers / incident resolves).
 */
export async function clearCooldown(
  redis: Redis,
  ruleId: string
): Promise<void> {
  const key = getCooldownKey(ruleId);
  await redis.del(key);
}
