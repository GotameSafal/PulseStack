import { createHash } from "crypto";
import { Database } from "./client";
import { users, organizations, organizationMembers, projects, apiKeys } from "./schema";

export interface SeedResult {
  userId: string;
  organizationId: string;
  projectId: string;
  apiKeyId: string;
  rawApiKey: string;
}

/**
 * Deterministically seeds initial test fixtures for development and testing.
 */
export async function seedDatabase(db: Database): Promise<SeedResult> {
  // 1. Create Default Admin User
  const [adminUser] = await db
    .insert(users)
    .values({
      name: "PulseStack Admin",
      email: "admin@pulsestack.io",
      passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456", // Test fixture bcrypt placeholder
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: "PulseStack Admin" },
    })
    .returning();

  // 2. Create Default Organization
  const [defaultOrg] = await db
    .insert(organizations)
    .values({
      name: "PulseStack Engineering",
      slug: "pulsestack-engineering",
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: { name: "PulseStack Engineering" },
    })
    .returning();

  // 3. Associate Admin as Organization OWNER
  await db
    .insert(organizationMembers)
    .values({
      organizationId: defaultOrg.id,
      userId: adminUser.id,
      role: "OWNER",
    })
    .onConflictDoNothing();

  // 4. Create Default Project
  const [defaultProject] = await db
    .insert(projects)
    .values({
      organizationId: defaultOrg.id,
      name: "Production Core",
      slug: "production-core",
      environment: "production",
    })
    .onConflictDoNothing()
    .returning();

  const projectId = defaultProject ? defaultProject.id : (await db.query.projects.findFirst())!.id;

  // 5. Generate Default Project Ingestion API Key
  const rawApiKey = "ps_live_testkey_1234567890abcdef";
  const keyPrefix = "ps_live_testkey_";
  const keyHash = createHash("sha256").update(rawApiKey).digest("hex");

  const [createdApiKey] = await db
    .insert(apiKeys)
    .values({
      projectId,
      name: "Default Ingestion Key",
      keyPrefix,
      keyHash,
      rateLimitTier: "enterprise",
    })
    .returning();

  const apiKeyId = createdApiKey ? createdApiKey.id : (await db.query.apiKeys.findFirst())!.id;

  return {
    userId: adminUser.id,
    organizationId: defaultOrg.id,
    projectId,
    apiKeyId,
    rawApiKey,
  };
}
