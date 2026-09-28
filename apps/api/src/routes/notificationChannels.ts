import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  CreateNotificationChannelSchema,
  UpdateNotificationChannelSchema,
  NotificationChannelResponseSchema,
} from "@pulsestack/shared";
import { encryptSecret, maskUrl } from "@pulsestack/shared/dist/crypto.js";
import { notificationChannels } from "@pulsestack/database";

/**
 * Notification channel CRUD routes.
 * Scoped under /v1/projects/:projectId/channels
 */
const notificationChannelRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  // ---------------------------------------------------------------------------
  // GET /v1/projects/:projectId/channels — list all channels for a project
  // ---------------------------------------------------------------------------
  fastify.get(
    "/:projectId/channels",
    {
      schema: {
        params: z.object({ projectId: z.string().min(1) }),
        response: { 200: z.array(NotificationChannelResponseSchema) },
      },
      preHandler: [fastify.authorizeProjectAccess],
    },
    async (request) => {
      const { projectId } = request.params;
      const rows = await fastify.db
        .select()
        .from(notificationChannels)
        .where(eq(notificationChannels.projectId, projectId))
        .orderBy(notificationChannels.createdAt);

      return rows.map(mapChannel);
    }
  );

  // ---------------------------------------------------------------------------
  // POST /v1/projects/:projectId/channels — create a channel
  // ---------------------------------------------------------------------------
  fastify.post(
    "/:projectId/channels",
    {
      schema: {
        params: z.object({ projectId: z.string().min(1) }),
        body: CreateNotificationChannelSchema,
        response: { 201: NotificationChannelResponseSchema },
      },
      preHandler: [fastify.authorizeProjectAccess],
    },
    async (request, reply) => {
      const { projectId } = request.params;
      const body = request.body;

      const encryptedUrl = encryptSecret(body.destinationUrl);
      const encryptedSecret = body.signingSecret
        ? encryptSecret(body.signingSecret)
        : null;

      const [channel] = await fastify.db
        .insert(notificationChannels)
        .values({
          projectId,
          name: body.name,
          type: body.type,
          destinationUrl: encryptedUrl,
          signingSecret: encryptedSecret,
          enabled: body.enabled ?? true,
        })
        .returning();

      reply.status(201);
      return mapChannel(channel);
    }
  );

  // ---------------------------------------------------------------------------
  // PATCH /v1/projects/:projectId/channels/:channelId — update a channel
  // ---------------------------------------------------------------------------
  fastify.patch(
    "/:projectId/channels/:channelId",
    {
      schema: {
        params: z.object({
          projectId: z.string().min(1),
          channelId: z.string().min(1),
        }),
        body: UpdateNotificationChannelSchema,
        response: { 200: NotificationChannelResponseSchema },
      },
      preHandler: [fastify.authorizeProjectAccess],
    },
    async (request) => {
      const { projectId, channelId } = request.params;
      const body = request.body;

      const [existing] = await fastify.db
        .select()
        .from(notificationChannels)
        .where(
          and(
            eq(notificationChannels.id, channelId),
            eq(notificationChannels.projectId, projectId)
          )
        )
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Notification channel not found");
      }

      const updates: Partial<typeof existing> = {
        updatedAt: new Date(),
      };
      if (body.name !== undefined) updates.name = body.name;
      if (body.type !== undefined) updates.type = body.type;
      if (body.enabled !== undefined) updates.enabled = body.enabled;
      if (body.destinationUrl !== undefined) {
        updates.destinationUrl = encryptSecret(body.destinationUrl);
      }
      if (body.signingSecret !== undefined) {
        updates.signingSecret = body.signingSecret
          ? encryptSecret(body.signingSecret)
          : null;
      }

      const [updated] = await fastify.db
        .update(notificationChannels)
        .set(updates)
        .where(eq(notificationChannels.id, channelId))
        .returning();

      return mapChannel(updated);
    }
  );

  // ---------------------------------------------------------------------------
  // DELETE /v1/projects/:projectId/channels/:channelId — delete a channel
  // ---------------------------------------------------------------------------
  fastify.delete(
    "/:projectId/channels/:channelId",
    {
      schema: {
        params: z.object({
          projectId: z.string().min(1),
          channelId: z.string().min(1),
        }),
        response: {
          200: z.object({ success: z.boolean(), message: z.string() }),
        },
      },
      preHandler: [fastify.authorizeProjectAccess],
    },
    async (request) => {
      const { projectId, channelId } = request.params;

      const [existing] = await fastify.db
        .select()
        .from(notificationChannels)
        .where(
          and(
            eq(notificationChannels.id, channelId),
            eq(notificationChannels.projectId, projectId)
          )
        )
        .limit(1);

      if (!existing) {
        throw fastify.httpErrors.notFound("Notification channel not found");
      }

      await fastify.db
        .delete(notificationChannels)
        .where(eq(notificationChannels.id, channelId));

      return { success: true, message: "Notification channel deleted" };
    }
  );
};

// ---------------------------------------------------------------------------
// Mapper: DB row → API response (never exposes raw URL or signing secret)
// ---------------------------------------------------------------------------
function mapChannel(row: typeof notificationChannels.$inferSelect) {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    type: row.type as "webhook" | "slack",
    maskedUrl: maskUrl(row.destinationUrl),
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export default notificationChannelRoutes;
