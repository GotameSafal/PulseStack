import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  users,
  organizations,
  organizationMembers,
  projects,
  apiKeys,
} from "../src/schema";

describe("Database Schema Definitions", () => {
  it("defines users table with expected columns", () => {
    const cols = getTableColumns(users);
    expect(cols.id).toBeDefined();
    expect(cols.email).toBeDefined();
    expect(cols.passwordHash).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.createdAt).toBeDefined();
    expect(cols.updatedAt).toBeDefined();
  });

  it("defines organizations table with expected columns", () => {
    const cols = getTableColumns(organizations);
    expect(cols.id).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.slug).toBeDefined();
    expect(cols.createdAt).toBeDefined();
    expect(cols.updatedAt).toBeDefined();
  });

  it("defines organization_members table with foreign keys and role", () => {
    const cols = getTableColumns(organizationMembers);
    expect(cols.id).toBeDefined();
    expect(cols.organizationId).toBeDefined();
    expect(cols.userId).toBeDefined();
    expect(cols.role).toBeDefined();
    expect(cols.createdAt).toBeDefined();
  });

  it("defines projects table with expected columns and environment", () => {
    const cols = getTableColumns(projects);
    expect(cols.id).toBeDefined();
    expect(cols.organizationId).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.slug).toBeDefined();
    expect(cols.environment).toBeDefined();
    expect(cols.createdAt).toBeDefined();
    expect(cols.updatedAt).toBeDefined();
  });

  it("defines api_keys table with prefix, hash and rate limit tier", () => {
    const cols = getTableColumns(apiKeys);
    expect(cols.id).toBeDefined();
    expect(cols.projectId).toBeDefined();
    expect(cols.name).toBeDefined();
    expect(cols.keyPrefix).toBeDefined();
    expect(cols.keyHash).toBeDefined();
    expect(cols.rateLimitTier).toBeDefined();
    expect(cols.lastUsedAt).toBeDefined();
    expect(cols.createdAt).toBeDefined();
  });
});
