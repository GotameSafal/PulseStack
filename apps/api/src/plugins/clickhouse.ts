import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import {
  createClickHouseClient,
  type ClickHouseClient,
  type ClickHouseConfig,
} from "@pulsestack/clickhouse";

declare module "fastify" {
  interface FastifyInstance {
    clickhouse: ClickHouseClient;
  }
}

export interface ClickHousePluginOptions {
  clickhouseConfig?: Partial<ClickHouseConfig>;
}

const clickhousePlugin: FastifyPluginAsync<ClickHousePluginOptions> = async (
  fastify,
  opts
) => {
  const client = createClickHouseClient(opts.clickhouseConfig);

  fastify.decorate("clickhouse", client);

  fastify.addHook("onClose", async () => {
    await client.close();
  });
};

export default fp(clickhousePlugin, {
  name: "clickhouse",
});
