import { eq, and, alertRules, incidents } from "@pulsestack/database";
import type { AlertRule, Database } from "@pulsestack/database";
import type { ClickHouseClient } from "@pulsestack/clickhouse";
import { evaluateAlertRuleMetric } from "@pulsestack/clickhouse";
import type { Redis } from "ioredis";
import type { AlertCondition, AlertMetric } from "@pulsestack/shared";
import { isCooldownActive, setCooldown, clearCooldown } from "./cooldown.js";
import { acquireAlertLock } from "./lock.js";

export interface EvaluatorContext {
  db: Database | any;
  clickhouse: ClickHouseClient;
  redis: Redis;
  clickhouseDb?: string;
  now?: Date | string;
  /** Lock time-to-live in milliseconds (default 10,000ms) */
  lockTtlMs?: number;
}

export interface RuleEvaluationResult {
  ruleId: string;
  projectId: string;
  metric: AlertMetric;
  currentValue: number;
  threshold: number;
  condition: AlertCondition;
  violated: boolean;
  incidentAction:
    | "created"
    | "resolved"
    | "cooldown_suppressed"
    | "already_open"
    | "lock_skipped"
    | "none";
  incidentId?: string;
}

/**
 * Checks if an error represents a PostgreSQL unique constraint violation (error code 23505).
 */
export function isUniqueConstraintViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as Record<string, unknown>;
  return anyErr.code === "23505" || String(anyErr.message || "").includes("duplicate key");
}

/**
 * Evaluates whether a metric value violates a threshold according to the condition operator.
 */
export function isConditionViolated(
  value: number,
  condition: AlertCondition,
  threshold: number
): boolean {
  switch (condition) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    default:
      return false;
  }
}

/**
 * Formats a clear incident title.
 */
export function formatIncidentTitle(rule: AlertRule, currentValue: number): string {
  return `${rule.name}: ${rule.metric} ${rule.condition} ${rule.threshold} (current: ${currentValue})`;
}

/**
 * Evaluates a single alert rule with distributed locking and PostgreSQL unique constraint defense:
 *
 * 1. Acquire alert lock (alert:lock:{ruleId}) atomically via Redis SET NX.
 *    If lock is currently held by another worker, skip evaluation for this tick (lock_skipped).
 * 2. Query ClickHouse for metric over [now - windowMinutes, now].
 * 3. Check condition violation against threshold.
 * 4. If violated:
 *    - Check for an existing 'open' incident in PostgreSQL.
 *    - If open incident exists -> already_open.
 *    - If in Redis cooldown -> cooldown_suppressed.
 *    - Otherwise, attempt INSERT INTO incidents:
 *      * If unique constraint violation (23505) occurs (racing worker), catch gracefully and treat as already_open.
 *      * On success, set Redis cooldown lock.
 * 5. If healthy (not violated):
 *    - Check if an 'open' incident exists.
 *    - If exists -> resolve incident ('resolved', resolvedAt = now) and clear Redis cooldown.
 * 6. Always release the alert lock safely (verifying lock token ownership via Lua script).
 */
export async function evaluateRule(
  rule: AlertRule,
  ctx: EvaluatorContext
): Promise<RuleEvaluationResult> {
  // Step 1: Acquire exclusive distributed lock for this alert rule
  const lock = await acquireAlertLock(ctx.redis, rule.id, ctx.lockTtlMs);
  if (!lock) {
    return {
      ruleId: rule.id,
      projectId: rule.projectId,
      metric: rule.metric as AlertMetric,
      currentValue: 0,
      threshold: rule.threshold,
      condition: rule.condition as AlertCondition,
      violated: false,
      incidentAction: "lock_skipped",
    };
  }

  try {
    // Step 2: Query ClickHouse
    const queryResult = await evaluateAlertRuleMetric(ctx.clickhouse, {
      projectId: rule.projectId,
      metric: rule.metric as AlertMetric,
      windowMinutes: rule.windowMinutes,
      database: ctx.clickhouseDb,
      now: ctx.now,
    });

    const currentValue = queryResult.value;
    const violated = isConditionViolated(
      currentValue,
      rule.condition as AlertCondition,
      rule.threshold
    );

    // Step 3: Check current incident state in PostgreSQL
    const [existingOpenIncident] = await ctx.db
      .select()
      .from(incidents)
      .where(and(eq(incidents.alertRuleId, rule.id), eq(incidents.status, "open")))
      .limit(1);

    if (violated) {
      if (existingOpenIncident) {
        return {
          ruleId: rule.id,
          projectId: rule.projectId,
          metric: rule.metric as AlertMetric,
          currentValue,
          threshold: rule.threshold,
          condition: rule.condition as AlertCondition,
          violated: true,
          incidentAction: "already_open",
          incidentId: existingOpenIncident.id,
        };
      }

      const inCooldown = await isCooldownActive(ctx.redis, rule.id);
      if (inCooldown) {
        return {
          ruleId: rule.id,
          projectId: rule.projectId,
          metric: rule.metric as AlertMetric,
          currentValue,
          threshold: rule.threshold,
          condition: rule.condition as AlertCondition,
          violated: true,
          incidentAction: "cooldown_suppressed",
        };
      }

      try {
        const [created] = await ctx.db
          .insert(incidents)
          .values({
            projectId: rule.projectId,
            alertRuleId: rule.id,
            status: "open",
            title: formatIncidentTitle(rule, currentValue),
            triggerValue: currentValue,
            notes: `Automatically triggered by alert evaluation. Sample count: ${queryResult.sampleCount} in ${rule.windowMinutes}m window.`,
            openedAt: ctx.now ? (typeof ctx.now === "string" ? new Date(ctx.now) : ctx.now) : new Date(),
          })
          .returning();

        await setCooldown(ctx.redis, rule.id, rule.cooldownMinutes);

        return {
          ruleId: rule.id,
          projectId: rule.projectId,
          metric: rule.metric as AlertMetric,
          currentValue,
          threshold: rule.threshold,
          condition: rule.condition as AlertCondition,
          violated: true,
          incidentAction: "created",
          incidentId: created?.id,
        };
      } catch (insertErr) {
        // Handle PostgreSQL unique constraint violation (23505)
        // Another concurrent worker committed an open incident before us
        if (isUniqueConstraintViolation(insertErr)) {
          // Look up the racing open incident if possible
          const [openRow] = await ctx.db
            .select()
            .from(incidents)
            .where(and(eq(incidents.alertRuleId, rule.id), eq(incidents.status, "open")))
            .limit(1);

          return {
            ruleId: rule.id,
            projectId: rule.projectId,
            metric: rule.metric as AlertMetric,
            currentValue,
            threshold: rule.threshold,
            condition: rule.condition as AlertCondition,
            violated: true,
            incidentAction: "already_open",
            incidentId: openRow?.id,
          };
        }
        throw insertErr;
      }
    }

    // Healthy condition: Auto-resolve if currently open
    if (existingOpenIncident) {
      const resolvedAt = ctx.now ? (typeof ctx.now === "string" ? new Date(ctx.now) : ctx.now) : new Date();
      await ctx.db
        .update(incidents)
        .set({
          status: "resolved",
          resolvedAt,
          notes: existingOpenIncident.notes
            ? `${existingOpenIncident.notes}\nAuto-resolved: metric returned to normal (${currentValue}).`
            : `Auto-resolved: metric returned to normal (${currentValue}).`,
        })
        .where(eq(incidents.id, existingOpenIncident.id));

      await clearCooldown(ctx.redis, rule.id);

      return {
        ruleId: rule.id,
        projectId: rule.projectId,
        metric: rule.metric as AlertMetric,
        currentValue,
        threshold: rule.threshold,
        condition: rule.condition as AlertCondition,
        violated: false,
        incidentAction: "resolved",
        incidentId: existingOpenIncident.id,
      };
    }

    return {
      ruleId: rule.id,
      projectId: rule.projectId,
      metric: rule.metric as AlertMetric,
      currentValue,
      threshold: rule.threshold,
      condition: rule.condition as AlertCondition,
      violated: false,
      incidentAction: "none",
    };
  } finally {
    // Ownership-safe lock release
    await lock.release();
  }
}

/**
 * Reads all enabled alert rules from the database and evaluates them.
 * Errors on individual rules are caught so one failing rule does not stop others.
 */
export async function evaluateAllRules(
  ctx: EvaluatorContext
): Promise<RuleEvaluationResult[]> {
  const activeRules: AlertRule[] = await ctx.db
    .select()
    .from(alertRules)
    .where(eq(alertRules.enabled, true));

  const results: RuleEvaluationResult[] = [];

  for (const rule of activeRules) {
    try {
      const res = await evaluateRule(rule, ctx);
      results.push(res);
    } catch (err) {
      console.error(`[evaluator] Error evaluating alert rule ${rule.id} (${rule.name}):`, err);
    }
  }

  return results;
}
