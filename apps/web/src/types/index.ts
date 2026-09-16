export type UserRole = "ADMIN" | "MANAGER" | "USER";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
}

export type Permission =
  | "USER_CREATE"
  | "USER_READ"
  | "USER_UPDATE"
  | "USER_DELETE"
  | "SETTINGS_WRITE"
  | "DASHBOARD_VIEW";
