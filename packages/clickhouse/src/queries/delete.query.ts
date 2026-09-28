import type { ClickHouseClient } from "@clickhouse/client";

/**
 * Deletes all ClickHouse telemetry rows for a given project.
 * Uses ALTER TABLE ... DELETE (lightweight delete) which is async by nature
 * in ClickHouse. We execute it and move on.
 */
export async function deleteTelemetryForProject(
  client: ClickHouseClient,
  projectId: string,
  database = "pulsestack"
): Promise<void> {
  await client.command({
    query: `ALTER TABLE ${database}.http_requests DELETE WHERE project_id = {projectId: String}`,
    query_params: { projectId },
  });
}
