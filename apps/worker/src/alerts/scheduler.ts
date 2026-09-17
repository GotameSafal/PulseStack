import type { ClickHouseClient } from "@pulsestack/clickhouse";
import type { Redis } from "ioredis";
import { evaluateAllRules, type EvaluatorContext } from "./evaluator.js";

export interface SchedulerOptions {
  intervalMs?: number;
  db: any;
  clickhouse: ClickHouseClient;
  redis: Redis;
  clickhouseDb?: string;
}

export class AlertEvaluationScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private isEvaluating = false;
  private readonly intervalMs: number;
  private readonly context: EvaluatorContext;

  constructor(options: SchedulerOptions) {
    this.intervalMs = options.intervalMs || 60_000;
    this.context = {
      db: options.db,
      clickhouse: options.clickhouse,
      redis: options.redis,
      clickhouseDb: options.clickhouseDb,
    };
  }

  public start(): void {
    if (this.running) return;
    this.running = true;

    console.log(
      `[evaluator] Alert evaluation scheduler started (interval: ${this.intervalMs / 1000}s)`
    );

    // Initial evaluation immediately on startup
    void this.tick();

    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  public async tick(): Promise<void> {
    if (this.isEvaluating) {
      console.warn("[evaluator] Skipping tick: previous evaluation still in progress");
      return;
    }

    this.isEvaluating = true;
    try {
      const results = await evaluateAllRules(this.context);
      const triggered = results.filter((r) => r.incidentAction === "created").length;
      const resolved = results.filter((r) => r.incidentAction === "resolved").length;
      if (triggered > 0 || resolved > 0) {
        console.log(
          `[evaluator] Evaluation finished: ${results.length} rules checked, ${triggered} triggered, ${resolved} resolved.`
        );
      }
    } catch (err) {
      console.error("[evaluator] Unhandled error during evaluation tick:", err);
    } finally {
      this.isEvaluating = false;
    }
  }

  public stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[evaluator] Alert evaluation scheduler stopped");
  }
}
