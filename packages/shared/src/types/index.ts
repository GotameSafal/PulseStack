import { z } from "zod";
import {
  RegisterInputSchema,
  LoginInputSchema,
  UserAuthResponseSchema,
} from "../schemas/auth.schema";
import {
  CreateOrganizationSchema,
  OrganizationMemberSchema,
  OrganizationRoleEnum,
} from "../schemas/organization.schema";
import {
  CreateProjectSchema,
  ProjectResponseSchema,
  ProjectEnvironmentEnum,
} from "../schemas/project.schema";
import {
  CreateApiKeySchema,
  ApiKeyResponseSchema,
} from "../schemas/apiKey.schema";
import {
  HttpMethodEnum,
  HttpRequestEventSchema,
  ErrorEventSchema,
  DatabaseQueryEventSchema,
  BackgroundJobEventSchema,
  CustomEventSchema,
  TelemetryEventSchema,
  IngestBatchPayloadSchema,
} from "../schemas/telemetry.schema";

export type RegisterInput = z.infer<typeof RegisterInputSchema>;
export type LoginInput = z.infer<typeof LoginInputSchema>;
export type UserAuthResponse = z.infer<typeof UserAuthResponseSchema>;

export type OrganizationRole = z.infer<typeof OrganizationRoleEnum>;
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;
export type OrganizationMember = z.infer<typeof OrganizationMemberSchema>;

export type ProjectEnvironment = z.infer<typeof ProjectEnvironmentEnum>;
export type CreateProject = z.infer<typeof CreateProjectSchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;

export type CreateApiKey = z.infer<typeof CreateApiKeySchema>;
export type ApiKeyResponse = z.infer<typeof ApiKeyResponseSchema>;

export type HttpMethod = z.infer<typeof HttpMethodEnum>;
export type HttpRequestEvent = z.infer<typeof HttpRequestEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type DatabaseQueryEvent = z.infer<typeof DatabaseQueryEventSchema>;
export type BackgroundJobEvent = z.infer<typeof BackgroundJobEventSchema>;
export type CustomEvent = z.infer<typeof CustomEventSchema>;
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
export type IngestBatchPayload = z.infer<typeof IngestBatchPayloadSchema>;

export type {
  TimeRangePreset,
  AnalyticsQueryFilter,
  AnalyticsOverviewResponse,
  TimeSeriesBucket,
  AnalyticsTimeSeriesResponse,
  RequestExplorerQuery,
  RequestExplorerItem,
  RequestExplorerResponse,
  ErrorExplorerQuery,
  ErrorGroupSummary,
  ErrorExplorerResponse,
} from "../schemas/analytics.schema";
