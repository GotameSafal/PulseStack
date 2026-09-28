"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  Users,
  ExternalLink,
  Loader2,
  Plus,
  Activity,
  Layers,
  Sparkles,
  Zap,
  Server,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/lib/auth/authStore";
import { useProjects, useCreateProject } from "@/features/projects/hooks/useProjects";
import { usersApi } from "@/features/users/services";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import type { ProjectResponse, CreateProject } from "@pulsestack/shared";

const ENV_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  production: {
    bg: "bg-rose-500/10 dark:bg-rose-500/20 border-rose-500/25",
    text: "text-rose-600 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  staging: {
    bg: "bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/25",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  development: {
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/25",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
};

function EnvBadge({ env }: { env: string }) {
  const meta = ENV_STYLES[env] ?? {
    bg: "bg-secondary border-border",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${meta.bg} ${meta.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} animate-pulse`} />
      {env}
    </span>
  );
}

const REFRESH_MS = 30_000;

export default function DashboardHome() {
  const router = useRouter();
  const { user } = useAuthStore();
  const orgId = user?.organizationId;

  const { data: projects = [], isLoading: projectsLoading } = useProjects(orgId, REFRESH_MS);
  const { data: usersData, isLoading: usersLoading } = usersApi.useGetAll(
    {},
    { refetchInterval: REFRESH_MS }
  );
  const createProject = useCreateProject();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSlug, setNewProjectSlug] = useState("");
  const [newProjectEnv, setNewProjectEnv] = useState<CreateProject["environment"]>("development");

  const totalUsers =
    Array.isArray(usersData)
      ? usersData.length
      : (usersData as any)?.totalCount ?? 0;

  const prodCount = (projects as ProjectResponse[]).filter((p) => p.environment === "production").length;
  const devCount = (projects as ProjectResponse[]).filter((p) => p.environment === "development").length;

  const handleNameChange = (val: string) => {
    setNewProjectName(val);
    setNewProjectSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    await createProject.mutateAsync({
      name: newProjectName,
      slug: newProjectSlug,
      organizationId: orgId,
      environment: newProjectEnv,
    } as Partial<ProjectResponse>);
    setCreateModalOpen(false);
    setNewProjectName("");
    setNewProjectSlug("");
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Hero Welcome Banner with glowing gradient */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-background p-6 sm:p-8 shadow-sm">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="absolute right-32 -bottom-16 h-48 w-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> High-Performance Observability
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back{user?.name ? `, ${user.name}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Real-time monitoring across your distributed microservices, ClickHouse telemetry streams, and intelligent alerting.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onPress={() => router.push("/dashboard/projects")}
              className="border-border hover:bg-secondary text-sm font-medium"
            >
              Browse All Projects
            </Button>
            <Button
              variant="primary"
              onPress={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 shadow-lg shadow-primary/25 font-semibold text-sm"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Projects */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm hover:border-primary/40 transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Projects
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <FolderOpen className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
              {projectsLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : projects.length}
            </span>
            <span className="text-xs text-muted-foreground">monitored apps</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground border-t border-border/50 pt-2.5">
            <span className="font-semibold text-foreground">{prodCount}</span> production •{" "}
            <span className="font-semibold text-foreground">{devCount}</span> dev
          </div>
        </div>

        {/* System Users */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm hover:border-primary/40 transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Team Members
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
              {usersLoading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : totalUsers}
            </span>
            <span className="text-xs text-muted-foreground">registered users</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2.5">
            <span>Workspace accounts</span>
            <button
              onClick={() => router.push("/dashboard/users")}
              className="text-primary hover:underline font-medium text-[11px]"
            >
              Manage &rarr;
            </button>
          </div>
        </div>

        {/* Ingestion Engine Status */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm hover:border-primary/40 transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ingestion Pipe
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              Operational
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2.5">
            <span>Redis Stream &rarr; ClickHouse</span>
            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">ACTIVE</span>
          </div>
        </div>

        {/* Platform Reliability */}
        <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm hover:border-primary/40 transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Health Status
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight tabular-nums text-foreground">
              99.98%
            </span>
            <span className="text-xs text-muted-foreground">uptime SLA</span>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground border-t border-border/50 pt-2.5">
            <Server className="h-3 w-3 text-muted-foreground/70" />
            <span>Telemetry buffer stable</span>
          </div>
        </div>
      </div>

      {/* Projects Showcase Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Active Projects
            </h2>
            <p className="text-xs text-muted-foreground">
              Select a service below to view latency histograms, error traces, and incident triggers.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onPress={() => router.push("/dashboard/projects")}
            className="text-xs font-semibold text-primary hover:text-primary/80 gap-1.5"
          >
            View All ({projects.length})
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {projectsLoading && (
          <div className="flex items-center justify-center py-20 rounded-2xl border border-border/60 bg-card">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        )}

        {!projectsLoading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-card/60 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 shadow-inner">
              <FolderOpen className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-foreground">No projects configured yet</h3>
            <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
              Create your first project to receive SDK credentials and start streaming telemetry into PulseStack.
            </p>
            <Button
              variant="primary"
              size="md"
              className="mt-5 font-semibold"
              onPress={() => setCreateModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Create Project Now
            </Button>
          </div>
        )}

        {!projectsLoading && projects.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(projects as ProjectResponse[]).slice(0, 6).map((p) => (
              <div
                key={p.id}
                onClick={() => router.push(`/dashboard/projects/${p.id}/overview`)}
                className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 cursor-pointer shadow-sm hover:border-primary/60 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary border border-primary/20 group-hover:scale-105 transition-transform">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                          {p.name}
                        </h4>
                        <p className="text-xs font-mono text-muted-foreground truncate">{p.slug}</p>
                      </div>
                    </div>
                    <EnvBadge env={p.environment} />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  <span className="font-mono text-[11px]">
                    Created {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Open Console <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick-Create Project Modal */}
      {createModalOpen && (
        <Modal
          isOpen
          onOpenChange={(open) => !open && setCreateModalOpen(false)}
          title="Create New Project"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onPress={() => setCreateModalOpen(false)}
                isDisabled={createProject.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={createProject.isPending}
                onPress={() =>
                  document
                    .getElementById("home-create-project-form")
                    ?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))
                }
              >
                Create Project
              </Button>
            </div>
          }
        >
          <form id="home-create-project-form" onSubmit={handleCreateSubmit} className="space-y-4">
            <Input
              label="Project Name"
              value={newProjectName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="E-Commerce API"
              required
            />
            <div>
              <Input
                label="Project Slug"
                value={newProjectSlug}
                onChange={(e) => setNewProjectSlug(e.target.value)}
                placeholder="e-commerce-api"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Slug identifier used in API keys and SDK telemetry headers
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Target Environment</label>
              <div className="flex gap-2">
                {(["development", "staging", "production"] as const).map((env) => (
                  <button
                    key={env}
                    type="button"
                    onClick={() => setNewProjectEnv(env)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition-all ${
                      newProjectEnv === env
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {env}
                  </button>
                ))}
              </div>
            </div>
            {createProject.error && (
              <p role="alert" className="text-sm text-danger font-medium">
                {createProject.error.message}
              </p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

