import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { eq, and } from "drizzle-orm";
import { projects, organizationMembers } from "@pulsestack/database";

declare module "fastify" {
  interface FastifyInstance {
    authorizeProjectAccess: (
      request: FastifyRequest<any>,
      reply: FastifyReply
    ) => Promise<void>;
  }
}

/**
 * Registers the `authorizeProjectAccess` preHandler decorator.
 *
 * This enforces multi-tenant isolation: the authenticated JWT user must be
 * an organization member of the project they are requesting data for.
 * Returns 404 if the project does not exist, 403 if the user is not a member.
 */
const projectAccessPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    "authorizeProjectAccess",
    async (
      request: FastifyRequest<{ Params: { projectId: string } }>,
      reply: FastifyReply
    ): Promise<void> => {
      const { projectId } = request.params;
      const { userId } = request.user;

      const [project] = await fastify.db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        reply
          .status(404)
          .send({ statusCode: 404, error: "Not Found", message: "Project not found" });
        return;
      }

      const [membership] = await fastify.db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, project.organizationId),
            eq(organizationMembers.userId, userId)
          )
        )
        .limit(1);

      if (!membership) {
        reply.status(403).send({
          statusCode: 403,
          error: "Forbidden",
          message: "You do not have access to this project",
        });
      }
    }
  );
};

export default fp(projectAccessPlugin, {
  name: "projectAccess",
});
