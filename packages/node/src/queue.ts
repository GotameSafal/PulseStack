import { randomUUID } from "node:crypto";
import type { TelemetryEvent } from "./types.js";

export class BoundedQueue {
  private items: TelemetryEvent[] = [];
  private readonly maxSize: number;
  private readonly onDrop?: (droppedCount: number) => void;

  constructor(maxSize = 2000, onDrop?: (droppedCount: number) => void) {
    this.maxSize = Math.max(10, maxSize);
    this.onDrop = onDrop;
  }

  public push(event: TelemetryEvent): void {
    if (this.items.length >= this.maxSize) {
      // Buffer capacity reached: drop oldest 10% or at least 1 item to prevent unbounded memory growth
      const dropCount = Math.max(1, Math.floor(this.maxSize * 0.1));
      this.items.splice(0, dropCount);
      if (this.onDrop) {
        this.onDrop(dropCount);
      }
    }
    this.items.push(event);
  }

  public unshiftBatch(events: TelemetryEvent[]): void {
    if (events.length === 0) return;
    this.items.unshift(...events);
    if (this.items.length > this.maxSize) {
      const overflow = this.items.length - this.maxSize;
      this.items.splice(this.maxSize, overflow);
      if (this.onDrop) {
        this.onDrop(overflow);
      }
    }
  }

  public drain(count: number): TelemetryEvent[] {
    if (this.items.length === 0) return [];
    return this.items.splice(0, count);
  }

  public get length(): number {
    return this.items.length;
  }

  public clear(): void {
    this.items = [];
  }
}

export function generateEventId(): string {
  return randomUUID();
}

export function formatTimestamp(ts?: string | Date): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return ts;
}
