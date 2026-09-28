import { createApiConfig } from "@/api/setup/crudCreater";

/** Shape returned by GET /v1/users */
export interface ApiUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

/**
 * CRUD hooks for /users.
 * useGetAll wraps paginated list: GET /users?page=&limit=&search=&sortField=&sortDir=
 * useCreate → POST /users
 * useDelete → DELETE /users/:id
 */
export const usersApi = createApiConfig<ApiUser>({
  entityName: "users",
  entityNameFormatted: "User",
});
