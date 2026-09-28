import { projectsApi } from "../services";
import type { ProjectResponse } from "@pulsestack/shared";

/**
 * Fetch all projects for a given organization.
 * Auto-refreshes every `refetchInterval` ms when > 0.
 */
export function useProjects(
  organizationId: string | undefined,
  refetchInterval = 0
) {
  return projectsApi.useGetAll(
    organizationId ? { organizationId } : undefined,
    {
      enabled: Boolean(organizationId),
      refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    }
  );
}

/** Fetch a single project by ID */
export function useProject(projectId: string | undefined) {
  return projectsApi.useGetById(projectId as string, undefined, {
    enabled: Boolean(projectId),
  });
}

/** Create a new project */
export function useCreateProject() {
  return projectsApi.useCreate();
}

/** Delete a project (+ telemetry via API cascade) */
export function useDeleteProject() {
  return projectsApi.useDelete();
}
