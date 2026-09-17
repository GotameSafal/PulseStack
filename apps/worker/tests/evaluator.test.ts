import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isConditionViolated,
  formatIncidentTitle,
  evaluateRule,
  evaluateAllRules,
  isUniqueConstraintViolation,
  type EvaluatorContext,
} from "../src/alerts/evaluator.js";
import {
  isCooldownActive,
  setCooldown,
  clearCooldown,
  getCooldownKey,
} from "../src/alerts/cooldown.js";
import {
  acquireAlertLock,
  releaseAlertLock,
  getLockKey,
} from "../src/alerts/lock.js";
import type { AlertRule } from "@pulsestack/database";

// Mock @pulsestack/clickhouse evaluateAlertRuleMetric
vi.mock("@pulsestack/clickhouse", () => ({
  evaluateAlertRuleMetric: vi.fn(),
  formatClickHouseDate: vi.fn((d) => (d instanceof Date ? d.toISOString() : d)),
}));

import { evaluateAlertRuleMetric } from "@pulsestack/clickhouse";

describe("Alert Evaluation, Cooldown & Distributed Locking", () => {
  let mockRedis: any;
  let redisStore: Map<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    redisStore = new Map();

    mockRedis = {
      exists: vi.fn().mockImplementation(async (key: string) => (redisStore.has(key) ? 1 : 0)),
      set: vi.fn().mockImplementation(async (key: string, val: string, ...opts: any[]) => {
        // Handle SET key val PX ttl NX
        if (opts.includes("NX") && redisStore.has(key)) {
          return null; // Key already exists, NX fails
        }
        redisStore.set(key, val);
        return "OK";
      }),
      del: vi.fn().mockImplementation(async (key: string) => {
        const deleted = redisStore.delete(key) ? 1 : 0;
        return deleted;
      }),
      get: vi.fn().mockImplementation(async (key: string) => redisStore.get(key) || null),
      eval: vi.fn().mockImplementation(async (_script: string, _numKeys: number, key: string, token: string) => {
        if (redisStore.get(key) === token) {
          redisStore.delete(key);
          return 1;
        }
        return 0;
      }),
    };
  });

  describe("Redis Distributed Lock (acquireAlertLock & releaseAlertLock)", () => {
    it("acquires lock atomically with NX and token", async () => {
      const lock = await acquireAlertLock(mockRedis, "rule-1", 5000);
      expect(lock).not.toBeNull();
      expect(lock?.ruleId).toBe("rule-1");
      expect(lock?.token).toBeDefined();

      const key = getLockKey("rule-1");
      expect(redisStore.get(key)).toBe(lock?.token);
      expect(mockRedis.set).toHaveBeenCalledWith(key, lock?.token, "PX", 5000, "NX");
    });

    it("prevents a second worker from acquiring the lock when already held", async () => {
      const lock1 = await acquireAlertLock(mockRedis, "rule-1", 5000);
      expect(lock1).not.toBeNull();

      // Second attempt while lock1 is held
      const lock2 = await acquireAlertLock(mockRedis, "rule-1", 5000);
      expect(lock2).toBeNull();
    });

    it("allows different rules to acquire locks concurrently without interference", async () => {
      const lockRule1 = await acquireAlertLock(mockRedis, "rule-1", 5000);
      const lockRule2 = await acquireAlertLock(mockRedis, "rule-2", 5000);

      expect(lockRule1).not.toBeNull();
      expect(lockRule2).not.toBeNull();
      expect(redisStore.get(getLockKey("rule-1"))).toBe(lockRule1?.token);
      expect(redisStore.get(getLockKey("rule-2"))).toBe(lockRule2?.token);
    });

    it("safely releases the lock only if the token matches (ownership-safe)", async () => {
      const lock = await acquireAlertLock(mockRedis, "rule-1", 5000);
      expect(lock).not.toBeNull();

      // Attempt release with wrong token
      const wrongTokenReleased = await releaseAlertLock(mockRedis, "rule-1", "wrong-token");
      expect(wrongTokenReleased).toBe(false);
      expect(redisStore.has(getLockKey("rule-1"))).toBe(true);

      // Attempt release with correct token
      const correctTokenReleased = await lock?.release();
      expect(correctTokenReleased).toBe(true);
      expect(redisStore.has(getLockKey("rule-1"))).toBe(false);
    });

    it("allows subsequent acquisition after lock is released or expired", async () => {
      const lock1 = await acquireAlertLock(mockRedis, "rule-1", 5000);
      await lock1?.release();

      const lock2 = await acquireAlertLock(mockRedis, "rule-1", 5000);
      expect(lock2).not.toBeNull();
    });
  });

  describe("Cooldown manager", () => {
    it("handles getCooldownKey, setCooldown, isCooldownActive, and clearCooldown", async () => {
      const key = getCooldownKey("rule-1");
      expect(key).toBe("alert:cooldown:rule-1");

      expect(await isCooldownActive(mockRedis, "rule-1")).toBe(false);

      await setCooldown(mockRedis, "rule-1", 15);
      expect(mockRedis.set).toHaveBeenCalledWith("alert:cooldown:rule-1", "1", "EX", 900);
      expect(await isCooldownActive(mockRedis, "rule-1")).toBe(true);

      await clearCooldown(mockRedis, "rule-1");
      expect(mockRedis.del).toHaveBeenCalledWith("alert:cooldown:rule-1");
      expect(await isCooldownActive(mockRedis, "rule-1")).toBe(false);
    });
  });

  describe("isConditionViolated", () => {
    it("evaluates 'gt' operator correctly", () => {
      expect(isConditionViolated(5.1, "gt", 5.0)).toBe(true);
      expect(isConditionViolated(5.0, "gt", 5.0)).toBe(false);
      expect(isConditionViolated(4.9, "gt", 5.0)).toBe(false);
    });

    it("evaluates 'gte' operator correctly", () => {
      expect(isConditionViolated(5.0, "gte", 5.0)).toBe(true);
      expect(isConditionViolated(5.1, "gte", 5.0)).toBe(true);
      expect(isConditionViolated(4.9, "gte", 5.0)).toBe(false);
    });

    it("evaluates 'lt' operator correctly", () => {
      expect(isConditionViolated(4.9, "lt", 5.0)).toBe(true);
      expect(isConditionViolated(5.0, "lt", 5.0)).toBe(false);
      expect(isConditionViolated(5.1, "lt", 5.0)).toBe(false);
    });

    it("evaluates 'lte' operator correctly", () => {
      expect(isConditionViolated(5.0, "lte", 5.0)).toBe(true);
      expect(isConditionViolated(4.9, "lte", 5.0)).toBe(true);
      expect(isConditionViolated(5.1, "lte", 5.0)).toBe(false);
    });

    it("returns false for unknown condition", () => {
      expect(isConditionViolated(10, "unknown" as any, 5)).toBe(false);
    });
  });

  describe("formatIncidentTitle", () => {
    it("formats human-readable summary title", () => {
      const mockRule = {
        name: "High Error Rate",
        metric: "error_rate",
        condition: "gt",
        threshold: 5.0,
      } as AlertRule;

      const title = formatIncidentTitle(mockRule, 8.42);
      expect(title).toBe("High Error Rate: error_rate gt 5 (current: 8.42)");
    });
  });

  describe("isUniqueConstraintViolation", () => {
    it("detects PostgreSQL code 23505 and message cues", () => {
      expect(isUniqueConstraintViolation({ code: "23505" })).toBe(true);
      expect(
        isUniqueConstraintViolation({
          message: 'duplicate key value violates unique constraint "incidents_one_open_per_rule_idx"',
        })
      ).toBe(true);
      expect(isUniqueConstraintViolation({ code: "42P01" })).toBe(false);
      expect(isUniqueConstraintViolation(null)).toBe(false);
      expect(isUniqueConstraintViolation("error")).toBe(false);
    });
  });

  describe("evaluateRule state transitions and concurrency correctness", () => {
    const mockRule: AlertRule = {
      id: "rule-1",
      projectId: "proj-1",
      name: "High Error Rate",
      description: null,
      metric: "error_rate",
      threshold: 5.0,
      condition: "gt",
      windowMinutes: 5,
      cooldownMinutes: 15,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    function createMockDb(options?: {
      openIncidents?: any[];
      onInsert?: (data: any) => Promise<any> | any;
    }) {
      const openIncidents = options?.openIncidents || [];
      const inserted: any[] = [];
      const updated: any[] = [];

      const db: any = {
        inserted,
        updated,
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => openIncidents,
            }),
          }),
        }),
        insert: () => ({
          values: (data: any) => ({
            returning: async () => {
              if (options?.onInsert) {
                return options.onInsert(data);
              }
              const item = { id: `inc-${inserted.length + 1}`, ...data };
              inserted.push(item);
              return [item];
            },
          }),
        }),
        update: () => ({
          set: (data: any) => ({
            where: async () => {
              updated.push(data);
              return [data];
            },
          }),
        }),
      };

      return db;
    }

    it("triggers a new incident, sets cooldown, and releases lock on breach", async () => {
      (evaluateAlertRuleMetric as any).mockResolvedValue({
        projectId: "proj-1",
        metric: "error_rate",
        value: 12.5,
        sampleCount: 100,
        from: "2026-09-17T12:00:00Z",
        to: "2026-09-17T12:05:00Z",
      });

      const mockDb = createMockDb();
      const ctx: EvaluatorContext = {
        db: mockDb,
        clickhouse: {} as any,
        redis: mockRedis,
      };

      const result = await evaluateRule(mockRule, ctx);

      expect(result.violated).toBe(true);
      expect(result.incidentAction).toBe("created");
      expect(result.incidentId).toBe("inc-1");
      expect(mockDb.inserted).toHaveLength(1);
      expect(mockDb.inserted[0].triggerValue).toBe(12.5);
      expect(mockDb.inserted[0].status).toBe("open");

      // Cooldown set
      expect(mockRedis.set).toHaveBeenCalledWith("alert:cooldown:rule-1", "1", "EX", 900);

      // Lock safely released in finally block
      expect(redisStore.has(getLockKey("rule-1"))).toBe(false);
    });

    it("skips evaluation if the alert rule lock is currently held by another worker", async () => {
      // Simulate another worker holding the lock
      redisStore.set(getLockKey("rule-1"), "other-worker-token");

      const mockDb = createMockDb();
      const ctx: EvaluatorContext = {
        db: mockDb,
        clickhouse: {} as any,
        redis: mockRedis,
      };

      const result = await evaluateRule(mockRule, ctx);

      expect(result.incidentAction).toBe("lock_skipped");
      expect(evaluateAlertRuleMetric).not.toHaveBeenCalled();
      expect(mockDb.inserted).toHaveLength(0);

      // Lock remains held by the original owner
      expect(redisStore.get(getLockKey("rule-1"))).toBe("other-worker-token");
    });

    it("two concurrent evaluations of the same rule: one creates incident, the second skips via lock", async () => {
      (evaluateAlertRuleMetric as any).mockResolvedValue({
        projectId: "proj-1",
        metric: "error_rate",
        value: 15.0,
        sampleCount: 100,
        from: "2026-09-17T12:00:00Z",
        to: "2026-09-17T12:05:00Z",
      });

      const mockDb = createMockDb();
      const ctx1: EvaluatorContext = {
        db: mockDb,
        clickhouse: {} as any,
        redis: mockRedis,
      };
      const ctx2: EvaluatorContext = {
        db: mockDb,
        clickhouse: {} as any,
        redis: mockRedis,
      };

      // Run both concurrently
      const [res1, res2] = await Promise.all([
        evaluateRule(mockRule, ctx1),
        evaluateRule(mockRule, ctx2),
      ]);

      const actions = [res1.incidentAction, res2.incidentAction];
      expect(actions).toContain("created");
      expect(actions).toContain("lock_skipped");
      expect(mockDb.inserted).toHaveLength(1);
    });

    it("handles PostgreSQL unique constraint violation (23505) gracefully if lock is bypassed", async () => {
      (evaluateAlertRuleMetric as any).mockResolvedValue({
        projectId: "proj-1",
        metric: "error_rate",
        value: 20.0,
        sampleCount: 50,
        from: "2026-09-17T12:00:00Z",
        to: "2026-09-17T12:05:00Z",
      });

      // Simulate a database unique constraint violation (e.g. 23505)
      const mockDb = createMockDb({
        openIncidents: [{ id: "inc-already-there", alertRuleId: "rule-1", status: "open" }],
        onInsert: () => {
          const err: any = new Error(
            'duplicate key value violates unique constraint "incidents_one_open_per_rule_idx"'
          );
          err.code = "23505";
          throw err;
        },
      });

      const ctx: EvaluatorContext = {
        db: mockDb,
        clickhouse: {} as any,
        redis: mockRedis,
      };

      const result = await evaluateRule(mockRule, ctx);

      // Must not throw, should gracefully return already_open
      expect(result.violated).toBe(true);
      expect(result.incidentAction).toBe("already_open");
      expect(result.incidentId).toBe("inc-already-there");

      // Lock safely released
      expect(redisStore.has(getLockKey("rule-1"))).toBe(false);
    });

    it("suppresses incident creation if currently in cooldown", async () => {
      (evaluateAlertRuleMetric as any).mockResolvedValue({
        projectId: "proj-1",
        metric: "error_rate",
        value: 12.5,
        sampleCount: 100,
        from: "2026-09-17T12:00:00Z",
        to: "2026-09-17T12:05:00Z",
      });

      // Put rule into cooldown
      redisStore.set("alert:cooldown:rule-1", "1");

      const mockDb = createMockDb();
      const ctx: EvaluatorContext = {
        db: mockDb,
        clickhouse: {} as any,
        redis: mockRedis,
      };

      const result = await evaluateRule(mockRule, ctx);

      expect(result.violated).toBe(true);
      expect(result.incidentAction).toBe("cooldown_suppressed");
      expect(mockDb.inserted).toHaveLength(0);

      // Lock released
      expect(redisStore.has(getLockKey("rule-1"))).toBe(false);
    });

    it("does not create a duplicate incident if an open incident already exists in DB", async () => {
      (evaluateAlertRuleMetric as any).mockResolvedValue({
        projectId: "proj-1",
        metric: "error_rate",
        value: 14.0,
        sampleCount: 80,
        from: "2026-09-17T12:00:00Z",
        to: "2026-09-17T12:05:00Z",
      });

      const existingIncident = {
        id: "inc-existing",
        alertRuleId: "rule-1",
        status: "open",
      };

      const mockDb = createMockDb({ openIncidents: [existingIncident] });
      const ctx: EvaluatorContext = {
        db: mockDb,
        clickhouse: {} as any,
        redis: mockRedis,
      };

      const result = await evaluateRule(mockRule, ctx);

      expect(result.violated).toBe(true);
      expect(result.incidentAction).toBe("already_open");
      expect(result.incidentId).toBe("inc-existing");
      expect(mockDb.inserted).toHaveLength(0);
    });

    it("auto-resolves open incident and clears cooldown when metric returns to healthy", async () => {
      (evaluateAlertRuleMetric as any).mockResolvedValue({
        projectId: "proj-1",
        metric: "error_rate",
        value: 1.2, // Below 5.0 threshold
        sampleCount: 120,
        from: "2026-09-17T12:00:00Z",
        to: "2026-09-17T12:05:00Z",
      });

      redisStore.set("alert:cooldown:rule-1", "1");

      const existingIncident = {
        id: "inc-to-resolve",
        alertRuleId: "rule-1",
        status: "open",
        notes: "Prior note",
      };

      const mockDb = createMockDb({ openIncidents: [existingIncident] });
      const ctx: EvaluatorContext = {
        db: mockDb,
        clickhouse: {} as any,
        redis: mockRedis,
      };

      const result = await evaluateRule(mockRule, ctx);

      expect(result.violated).toBe(false);
      expect(result.incidentAction).toBe("resolved");
      expect(result.incidentId).toBe("inc-to-resolve");
      expect(mockDb.updated).toHaveLength(1);
      expect(mockDb.updated[0].status).toBe("resolved");
      expect(mockDb.updated[0].resolvedAt).toBeDefined();

      // Cooldown cleared
      expect(mockRedis.del).toHaveBeenCalledWith("alert:cooldown:rule-1");
    });

    it("takes no action when metric is healthy and no open incident exists", async () => {
      (evaluateAlertRuleMetric as any).mockResolvedValue({
        projectId: "proj-1",
        metric: "error_rate",
        value: 0.5,
        sampleCount: 50,
        from: "2026-09-17T12:00:00Z",
        to: "2026-09-17T12:05:00Z",
      });

      const mockDb = createMockDb();
      const ctx: EvaluatorContext = {
        db: mockDb,
        clickhouse: {} as any,
        redis: mockRedis,
      };

      const result = await evaluateRule(mockRule, ctx);

      expect(result.violated).toBe(false);
      expect(result.incidentAction).toBe("none");
      expect(mockDb.inserted).toHaveLength(0);
      expect(mockDb.updated).toHaveLength(0);
    });
  });

  describe("evaluateAllRules", () => {
    it("fetches active rules and evaluates them with error isolation", async () => {
      const rules = [
        {
          id: "r-1",
          projectId: "p-1",
          name: "R1",
          metric: "error_rate",
          threshold: 5,
          condition: "gt",
          windowMinutes: 5,
          cooldownMinutes: 15,
          enabled: true,
        },
        {
          id: "r-2",
          projectId: "p-1",
          name: "R2",
          metric: "p95_latency_ms",
          threshold: 300,
          condition: "gt",
          windowMinutes: 5,
          cooldownMinutes: 15,
          enabled: true,
        },
      ];

      (evaluateAlertRuleMetric as any)
        .mockResolvedValueOnce({
          projectId: "p-1",
          metric: "error_rate",
          value: 1.0,
          sampleCount: 50,
        })
        .mockRejectedValueOnce(new Error("ClickHouse network failure"));

      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [],
              then: (fn: any) => Promise.resolve(rules).then(fn),
            }),
            then: (fn: any) => Promise.resolve(rules).then(fn),
          }),
        }),
      };

      const ctx: EvaluatorContext = {
        db: mockDb,
        clickhouse: {} as any,
        redis: mockRedis,
      };

      const spyErr = vi.spyOn(console, "error").mockImplementation(() => {});

      const results = await evaluateAllRules(ctx);

      expect(results).toHaveLength(1);
      expect(results[0]?.ruleId).toBe("r-1");
      expect(spyErr).toHaveBeenCalledWith(
        expect.stringContaining("Error evaluating alert rule r-2"),
        expect.any(Error)
      );

      spyErr.mockRestore();
    });
  });
});
