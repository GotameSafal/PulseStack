import { describe, it, expect, vi } from "vitest";
import { BatchFlusher } from "../src/flusher.js";
import { MappedRow } from "../src/mapper.js";

describe("BatchFlusher", () => {
  it("groups multiple rows for the same table into a single insert call", async () => {
    const insertMock = vi.fn().mockResolvedValue({ query_id: "qid" });
    const mockClient = { insert: insertMock } as any;

    const flusher = new BatchFlusher({ clickhouseClient: mockClient });

    const items: Array<{ messageId: string; mappedRow: MappedRow }> = [
      {
        messageId: "1-0",
        mappedRow: { table: "http_requests", row: { id: "req-1", path: "/a" } },
      },
      {
        messageId: "2-0",
        mappedRow: { table: "http_requests", row: { id: "req-2", path: "/b" } },
      },
    ];

    const result = await flusher.flush(items);

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith({
      table: "http_requests",
      values: [
        { id: "req-1", path: "/a" },
        { id: "req-2", path: "/b" },
      ],
      format: "JSONEachRow",
    });

    expect(result.successfulIds).toEqual(["1-0", "2-0"]);
    expect(result.failedIds).toEqual([]);
    expect(result.error).toBeUndefined();
  });

  it("groups rows of different tables into distinct insert calls per table", async () => {
    const insertMock = vi.fn().mockResolvedValue({ query_id: "qid" });
    const mockClient = { insert: insertMock } as any;

    const flusher = new BatchFlusher({ clickhouseClient: mockClient });

    const items: Array<{ messageId: string; mappedRow: MappedRow }> = [
      {
        messageId: "1-0",
        mappedRow: { table: "http_requests", row: { id: "req-1" } },
      },
      {
        messageId: "2-0",
        mappedRow: { table: "errors", row: { id: "err-1" } },
      },
      {
        messageId: "3-0",
        mappedRow: { table: "http_requests", row: { id: "req-2" } },
      },
    ];

    const result = await flusher.flush(items);

    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(result.successfulIds).toEqual(["1-0", "3-0", "2-0"]);
    expect(result.failedIds).toEqual([]);
  });

  it("isolates failure to only the table that failed", async () => {
    const insertMock = vi.fn().mockImplementation(async ({ table }) => {
      if (table === "errors") {
        throw new Error("ClickHouse schema error for errors table");
      }
      return { query_id: "qid" };
    });
    const mockClient = { insert: insertMock } as any;

    const flusher = new BatchFlusher({ clickhouseClient: mockClient });

    const items: Array<{ messageId: string; mappedRow: MappedRow }> = [
      {
        messageId: "http-1",
        mappedRow: { table: "http_requests", row: { id: "req-1" } },
      },
      {
        messageId: "err-1",
        mappedRow: { table: "errors", row: { id: "err-1" } },
      },
    ];

    const result = await flusher.flush(items);

    expect(result.successfulIds).toEqual(["http-1"]);
    expect(result.failedIds).toEqual(["err-1"]);
    expect(result.error?.message).toContain("ClickHouse schema error for errors table");
  });

  it("returns empty arrays when items is empty", async () => {
    const insertMock = vi.fn();
    const mockClient = { insert: insertMock } as any;

    const flusher = new BatchFlusher({ clickhouseClient: mockClient });
    const result = await flusher.flush([]);

    expect(insertMock).not.toHaveBeenCalled();
    expect(result.successfulIds).toEqual([]);
    expect(result.failedIds).toEqual([]);
  });
});
