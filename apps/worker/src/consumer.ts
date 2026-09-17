import { Redis } from "ioredis";
import { TelemetryEventSchema, TelemetryEvent } from "@pulsestack/shared";
import { WorkerConfig } from "./config.js";
import { mapTelemetryEvent, MappedRow } from "./mapper.js";
import { BatchFlusher } from "./flusher.js";

export interface StreamMessageRaw {
  id: string;
  fields: Record<string, string>;
}

export interface IngestionConsumerOptions {
  config: WorkerConfig;
  redis: Redis;
  flusher: BatchFlusher;
}

export class IngestionConsumer {
  private config: WorkerConfig;
  private redis: Redis;
  private flusher: BatchFlusher;
  private isRunning: boolean = false;

  constructor(options: IngestionConsumerOptions) {
    this.config = options.config;
    this.redis = options.redis;
    this.flusher = options.flusher;
  }

  /**
   * Initializes the Redis Consumer Group idempotently.
   * If the group already exists (BUSYGROUP), the error is gracefully ignored.
   */
  async initConsumerGroup(): Promise<void> {
    try {
      // XGROUP CREATE stream key group name $ MKSTREAM
      await this.redis.xgroup(
        "CREATE",
        this.config.streamKey,
        this.config.consumerGroup,
        "$",
        "MKSTREAM"
      );
    } catch (err: any) {
      if (err.message && err.message.includes("BUSYGROUP")) {
        // Group already exists, ignore
        return;
      }
      throw err;
    }
  }

  /**
   * Converts raw ioredis stream entries [ [id, [k1, v1, k2, v2]], ... ] into StreamMessageRaw objects
   */
  static parseStreamEntries(entries: any[]): StreamMessageRaw[] {
    if (!Array.isArray(entries)) return [];
    return entries.map(([id, fieldPairs]: [string, string[]]) => {
      const fields: Record<string, string> = {};
      if (Array.isArray(fieldPairs)) {
        for (let i = 0; i < fieldPairs.length; i += 2) {
          fields[fieldPairs[i]!] = fieldPairs[i + 1]!;
        }
      }
      return { id, fields };
    });
  }

  /**
   * Routes a message directly to DLQ and acknowledges it from the main stream.
   */
  async sendToDlq(
    messageId: string,
    reason: string,
    rawFields: Record<string, string>
  ): Promise<void> {
    try {
      await this.redis.xadd(
        this.config.dlqKey,
        "*",
        "streamId",
        messageId,
        "reason",
        reason,
        "projectId",
        rawFields.projectId ?? "",
        "data",
        rawFields.data ?? "",
        "failedAt",
        new Date().toISOString()
      );
      // XACK the message to remove it from PEL
      await this.redis.xack(
        this.config.streamKey,
        this.config.consumerGroup,
        messageId
      );
    } catch (dlqErr) {
      console.error(`Failed to send message ${messageId} to DLQ:`, dlqErr);
    }
  }

  /**
   * Queries XPENDING for a set of message IDs to get their durable delivery count.
   * Returns a Map of messageId -> deliveryCount.
   */
  async getDeliveryCounts(messageIds: string[]): Promise<Map<string, number>> {
    const deliveryMap = new Map<string, number>();
    if (messageIds.length === 0) return deliveryMap;

    try {
      // Find range bounds
      const sortedIds = [...messageIds].sort();
      const minId = sortedIds[0]!;
      const maxId = sortedIds[sortedIds.length - 1]!;

      // XPENDING <key> <group> <start> <end> <count>
      const pendingEntries = (await this.redis.xpending(
        this.config.streamKey,
        this.config.consumerGroup,
        minId,
        maxId,
        messageIds.length * 2
      )) as any[];

      if (Array.isArray(pendingEntries)) {
        for (const entry of pendingEntries) {
          // Entry format: [id, consumer, idleTime, deliveryCount]
          if (Array.isArray(entry) && entry.length >= 4) {
            const id = entry[0];
            const deliveryCount = Number(entry[3]);
            deliveryMap.set(id, deliveryCount);
          }
        }
      }
    } catch (err) {
      console.error("Error querying XPENDING for delivery counts:", err);
    }

    return deliveryMap;
  }

  /**
   * Processes a single batch of messages.
   * 1. Check pending delivery counts via XPENDING for durable retry limit.
   * 2. Parse and validate messages. Invalid/malformed messages go straight to DLQ and XACKed.
   * 3. Flush valid rows to ClickHouse.
   * 4. XACK successfully persisted messages.
   * 5. For failed ClickHouse writes: if delivery count >= MAX_RETRIES, route to DLQ + XACK; otherwise leave un-ACKed in PEL.
   */
  async processBatch(messages: StreamMessageRaw[]): Promise<{
    processed: number;
    acked: number;
    dlqed: number;
    failedRetry: number;
  }> {
    if (messages.length === 0) {
      return { processed: 0, acked: 0, dlqed: 0, failedRetry: 0 };
    }

    const messageIds = messages.map((m) => m.id);
    const deliveryCounts = await this.getDeliveryCounts(messageIds);

    const validItems: Array<{
      messageId: string;
      mappedRow: MappedRow;
      raw: StreamMessageRaw;
    }> = [];

    let dlqed = 0;

    for (const msg of messages) {
      const deliveryCount = deliveryCounts.get(msg.id) ?? 1;

      // Check durable retry count from Redis Consumer Group
      if (deliveryCount > this.config.maxRetries) {
        await this.sendToDlq(
          msg.id,
          `Exceeded max retries (${deliveryCount} > ${this.config.maxRetries})`,
          msg.fields
        );
        dlqed++;
        continue;
      }

      // Check projectId existence
      const projectId = msg.fields.projectId;
      if (!projectId) {
        await this.sendToDlq(msg.id, "Missing projectId in stream entry", msg.fields);
        dlqed++;
        continue;
      }

      // Check and parse JSON data
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(msg.fields.data ?? "");
      } catch (jsonErr: any) {
        await this.sendToDlq(
          msg.id,
          `Malformed JSON in data field: ${jsonErr.message}`,
          msg.fields
        );
        dlqed++;
        continue;
      }

      // Validate against TelemetryEventSchema
      const parseResult = TelemetryEventSchema.safeParse(parsedData);
      if (!parseResult.success) {
        await this.sendToDlq(
          msg.id,
          `Telemetry validation error: ${parseResult.error.message}`,
          msg.fields
        );
        dlqed++;
        continue;
      }

      // Map to ClickHouse row
      try {
        const mappedRow = mapTelemetryEvent(parseResult.data, projectId);
        validItems.push({ messageId: msg.id, mappedRow, raw: msg });
      } catch (mapErr: any) {
        await this.sendToDlq(
          msg.id,
          `Mapping error: ${mapErr.message}`,
          msg.fields
        );
        dlqed++;
        continue;
      }
    }

    // Flush valid items to ClickHouse
    let acked = 0;
    let failedRetry = 0;

    if (validItems.length > 0) {
      const flushResult = await this.flusher.flush(
        validItems.map((item) => ({
          messageId: item.messageId,
          mappedRow: item.mappedRow,
        }))
      );

      // XACK successful messages
      if (flushResult.successfulIds.length > 0) {
        await this.redis.xack(
          this.config.streamKey,
          this.config.consumerGroup,
          ...flushResult.successfulIds
        );
        acked += flushResult.successfulIds.length;
      }

      // Handle failed ClickHouse writes
      if (flushResult.failedIds.length > 0) {
        for (const failedId of flushResult.failedIds) {
          const item = validItems.find((v) => v.messageId === failedId);
          const deliveryCount = deliveryCounts.get(failedId) ?? 1;

          if (deliveryCount >= this.config.maxRetries) {
            // Exhausted retries -> DLQ + XACK
            await this.sendToDlq(
              failedId,
              `ClickHouse flush failed after ${deliveryCount} deliveries: ${flushResult.error?.message || "Unknown error"}`,
              item?.raw.fields ?? {}
            );
            dlqed++;
          } else {
            // Keep in PEL for re-delivery on restart / pending sweep
            failedRetry++;
          }
        }
      }
    }

    return {
      processed: messages.length,
      acked,
      dlqed,
      failedRetry,
    };
  }

  /**
   * Reads a micro-batch from the stream using XREADGROUP.
   * If ID is '>', reads new messages.
   * If ID is '0', reads pending messages for this consumer.
   */
  async readBatch(id: string = ">"): Promise<StreamMessageRaw[]> {
    // XREADGROUP GROUP <group> <consumer> COUNT <count> BLOCK <blockMs> STREAMS <streamKey> <id>
    const args = [
      "GROUP",
      this.config.consumerGroup,
      this.config.consumerName,
      "COUNT",
      this.config.batchSize,
    ];

    // Only block when reading new messages (id === '>')
    if (id === ">" && this.config.blockMs > 0) {
      args.push("BLOCK", this.config.blockMs);
    }

    args.push("STREAMS", this.config.streamKey, id);

    const result = (await (this.redis as any).xreadgroup(...args)) as any[];

    if (!result || !Array.isArray(result) || result.length === 0) {
      return [];
    }

    // result format: [ [streamName, [ [id, [k1, v1, ...]], ... ]] ]
    const streamData = result[0];
    if (!streamData || !Array.isArray(streamData) || streamData.length < 2) {
      return [];
    }

    const entries = streamData[1];
    return IngestionConsumer.parseStreamEntries(entries);
  }

  /**
   * Main consumer loop.
   */
  async start(): Promise<void> {
    await this.initConsumerGroup();
    this.isRunning = true;

    // 1. First recover pending messages assigned to this consumer on startup
    try {
      let pendingMessages = await this.readBatch("0");
      while (pendingMessages.length > 0 && this.isRunning) {
        await this.processBatch(pendingMessages);
        pendingMessages = await this.readBatch("0");
      }
    } catch (err) {
      console.error("Error processing pending messages on startup:", err);
    }

    // 2. Main loop reading new messages
    while (this.isRunning) {
      try {
        const messages = await this.readBatch(">");
        if (messages.length > 0) {
          await this.processBatch(messages);
        }
      } catch (err: any) {
        if (!this.isRunning) break;
        console.error("Error in consumer loop:", err);
        // Small backoff on unexpected Redis connection/polling errors
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  stop(): void {
    this.isRunning = false;
  }
}
