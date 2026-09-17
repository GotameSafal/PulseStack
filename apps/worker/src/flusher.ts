import type { ClickHouseClient } from "@pulsestack/clickhouse";
import type { MappedRow } from "./mapper.js";

export interface FlushResult {
  successfulIds: string[];
  failedIds: string[];
  error?: Error;
}

export interface FlusherOptions {
  clickhouseClient: ClickHouseClient;
}

export class BatchFlusher {
  private client: ClickHouseClient;

  constructor(options: FlusherOptions) {
    this.client = options.clickhouseClient;
  }

  /**
   * Flushes an array of mapped rows to ClickHouse, grouping rows by table
   * so that only one bulk insert is performed per table per batch.
   *
   * If an insert into a table fails, only the message IDs belonging to that table
   * are recorded as failed.
   */
  async flush(items: Array<{ messageId: string; mappedRow: MappedRow }>): Promise<FlushResult> {
    if (items.length === 0) {
      return { successfulIds: [], failedIds: [] };
    }

    // Group items by table
    const tableGroups = new Map<string, Array<{ messageId: string; row: Record<string, unknown> }>>();

    for (const item of items) {
      const { table, row } = item.mappedRow;
      if (!tableGroups.has(table)) {
        tableGroups.set(table, []);
      }
      tableGroups.get(table)!.push({ messageId: item.messageId, row });
    }

    const successfulIds: string[] = [];
    const failedIds: string[] = [];
    let lastError: Error | undefined;

    for (const [table, group] of tableGroups.entries()) {
      const values = group.map((g) => g.row);
      const groupMessageIds = group.map((g) => g.messageId);

      try {
        await this.client.insert({
          table,
          values,
          format: "JSONEachRow",
        });
        successfulIds.push(...groupMessageIds);
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        failedIds.push(...groupMessageIds);
      }
    }

    return {
      successfulIds,
      failedIds,
      error: lastError,
    };
  }
}
