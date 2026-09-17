import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";

export interface AuthUserPayload {
  userId: string;
  email: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthUserPayload;
    user: AuthUserPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthPluginOptions {
  jwtSecret?: string;
}

const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, opts) => {
  const secret = opts.jwtSecret || process.env.JWT_SECRET || "pulsestack-development-super-secret-key-32chars";

  await fastify.register(fastifyJwt, {
    secret,
  });

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Invalid or missing token",
        });
      }
    }
  );
};

export default fp(authPlugin, {
  name: "auth",
});
