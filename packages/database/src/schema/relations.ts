import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";
import { organizationMembers } from "./members";
import { projects } from "./projects";
import { apiKeys } from "./apiKeys";
import { alertRules } from "./alertRules";
import { incidents } from "./incidents";

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  projects: many(projects),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  apiKeys: many(apiKeys),
  alertRules: many(alertRules),
  incidents: many(incidents),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  project: one(projects, {
    fields: [apiKeys.projectId],
    references: [projects.id],
  }),
}));

export const alertRulesRelations = relations(alertRules, ({ one, many }) => ({
  project: one(projects, {
    fields: [alertRules.projectId],
    references: [projects.id],
  }),
  incidents: many(incidents),
}));

export const incidentsRelations = relations(incidents, ({ one }) => ({
  project: one(projects, {
    fields: [incidents.projectId],
    references: [projects.id],
  }),
  alertRule: one(alertRules, {
    fields: [incidents.alertRuleId],
    references: [alertRules.id],
  }),
}));
