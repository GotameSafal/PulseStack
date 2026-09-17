import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { IngestBatchPayloadSchema } from "@pulsestack/shared";

/** Redis stream key for all inbound telemetry events */
const TELEMETRY_STREAM = "telemetry:stream";

const ingestRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.post(
    "/ingest",
    {
      schema: {
        body: IngestBatchPayloadSchema,
        response: {
          202: z.object({ accepted: z.number().int().nonnegative() }),
        },
      },
      preHandler: [fastify.authenticateApiKey, fastify.checkRateLimit],
    },
    async (request, reply) => {
      const { events } = request.body;
      const { projectId } = request.apiKeyContext;

      // Write each event to the Redis stream as a single XADD call per event.
      // Fields: projectId (for worker routing) + data (JSON-serialised event).
      for (const event of events) {
        await fastify.redis.xadd(
          TELEMETRY_STREAM,
          "*", // auto-generate stream ID
          "projectId", projectId,
          "data", JSON.stringify(event)
        );
      }

      reply.status(202);
      return { accepted: events.length };
    }
  );
};

export default ingestRoutes;
