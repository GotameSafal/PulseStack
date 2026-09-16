import { describe, it, expect } from "vitest";
import {
  RegisterInputSchema,
  LoginInputSchema,
  CreateOrganizationSchema,
  CreateProjectSchema,
  CreateApiKeySchema,
  ProjectEnvironmentEnum,
  OrganizationRoleEnum,
} from "../src";

describe("Authentication Schemas", () => {
  it("validates valid registration input", () => {
    const validData = {
      name: "Alex Smith",
      email: "alex@example.com",
      password: "StrongPassword123!",
      organizationName: "Acme Corp",
    };
    const result = RegisterInputSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects invalid email and short password", () => {
    const invalidData = {
      name: "Alex",
      email: "not-an-email",
      password: "short",
      organizationName: "A",
    };
    const result = RegisterInputSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("validates login input", () => {
    const validLogin = {
      email: "alex@example.com",
      password: "password123",
    };
    expect(LoginInputSchema.safeParse(validLogin).success).toBe(true);
  });
});

describe("Multi-Tenant Organization & Project Schemas", () => {
  it("validates organization creation and slug generation rules", () => {
    const validOrg = {
      name: "PulseStack Systems",
      slug: "pulsestack-systems",
    };
    expect(CreateOrganizationSchema.safeParse(validOrg).success).toBe(true);

    const invalidSlug = {
      name: "PulseStack Systems",
      slug: "invalid slug with spaces",
    };
    expect(CreateOrganizationSchema.safeParse(invalidSlug).success).toBe(false);
  });

  it("validates project creation with environment enum", () => {
    const validProject = {
      organizationId: "org_12345",
      name: "Production Web App",
      slug: "prod-web-app",
      environment: ProjectEnvironmentEnum.Values.production,
    };
    expect(CreateProjectSchema.safeParse(validProject).success).toBe(true);

    const invalidProject = {
      organizationId: "org_12345",
      name: "Prod",
      slug: "prod",
      environment: "invalid-env",
    };
    expect(CreateProjectSchema.safeParse(invalidProject).success).toBe(false);
  });

  it("validates API key generation schema", () => {
    const validKey = {
      projectId: "proj_98765",
      name: "Primary Ingestion Key",
      rateLimitTier: "standard",
    };
    expect(CreateApiKeySchema.safeParse(validKey).success).toBe(true);
  });
});
