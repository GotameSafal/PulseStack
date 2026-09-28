import { createApiConfig } from "@/api/setup/crudCreater";
import type { ProjectResponse } from "@pulsestack/shared";

/**
 * CRUD hooks for /projects.
 *
 * GET  /projects?organizationId=xxx  → useGetAll({ organizationId })
 * POST /projects                     → useCreate()
 * DEL  /projects/:id                 → useDelete()
 */
export const projectsApi = createApiConfig<ProjectResponse>({
  entityName: "projects",
  entityNameFormatted: "Project",
  // Invalidate the projects list when mutations happen
  additionalQueriesToInvalidate: [],
});
