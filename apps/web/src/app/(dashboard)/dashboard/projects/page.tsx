"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  Plus,
  ExternalLink,
  ServerCrash,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth/authStore";
import { useProjects, useCreateProject } from "@/features/projects/hooks/useProjects";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import type { ProjectResponse, CreateProject } from "@pulsestack/shared";

// ────────────────────────────────────────────────────────────────────────────
// Environment badge
// ────────────────────────────────────────────────────────────────────────────

const ENV_STYLES: Record<string, string> = {
  production: "bg-danger/15 text-danger",
  staging: "bg-warning/15 text-warning",
  development: "bg-success/15 text-success",
};

function EnvBadge({ env }: { env: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ENV_STYLES[env] ?? "bg-secondary text-muted-foreground"
        }`}
    >
      {env}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Create project modal
// ────────────────────────────────────────────────────────────────────────────

interface CreateProjectModalProps {
  organizationId: string;
  onClose: () => void;
}

function CreateProjectModal({ organizationId, onClose }: CreateProjectModalProps) {
  const createProject = useCreateProject();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [environment, setEnvironment] = useState<CreateProject["environment"]>("development");

  // Auto-generate slug from name
  function handleNameChange(v: string) {
    setName(v);
    setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createProject.mutateAsync({
      name,
      slug,
      organizationId,
      environment,
    } as Partial<ProjectResponse>);
    onClose();
  }

  return (
    <Modal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Create New Project"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onPress={onClose} isDisabled={createProject.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={createProject.isPending}
            onPress={() =>
              document
                .getElementById("create-project-form")
                ?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))
            }
          >
            Create Project
          </Button>
        </div>
      }
    >
      <form id="create-project-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Project Name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="My API Service"
          required
        />
        <div>
          <Input
            label="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="my-api-service"
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Unique identifier used in SDK configuration
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Environment</label>
          <div className="flex gap-2">
            {(["development", "staging", "production"] as const).map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => setEnvironment(env)}
                className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition-colors ${environment === env
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
              >
                {env}
              </button>
            ))}
          </div>
        </div>

        {createProject.error && (
          <p role="alert" className="text-sm text-danger">
            {createProject.error.message}
          </p>
        )}
      </form>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Project card
// ────────────────────────────────────────────────────────────────────────────

function ProjectCard({
  project,
}: {
  project: ProjectResponse;
}) {
  const router = useRouter();

  return (
    <div className="group relative flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/50 hover:shadow-md">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FolderOpen className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{project.name}</p>
            <p className="text-xs text-muted-foreground font-mono truncate">{project.slug}</p>
          </div>
        </div>
        <EnvBadge env={project.environment} />
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between pt-3 border-t border-border/60">
        <span className="text-xs text-muted-foreground font-mono">
          {new Date(project.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>

        <Button
          variant="primary"
          size="sm"
          aria-label={`Open ${project.name}`}
          onPress={() => router.push(`/dashboard/projects/${project.id}/overview`)}
          className="text-xs gap-1.5"
        >
          Open Console
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

/** Real-time refresh interval for the project list: every 30 */
const REFRESH_INTERVAL_MS = 30_000;

function ProjectsContent() {
  const { user } = useAuthStore();
  const organizationId = user?.organizationId;

  const { data: projects = [], isLoading, isError, error } = useProjects(
    organizationId,
    REFRESH_INTERVAL_MS
  );

  const [createOpen, setCreateOpen] = useState(false);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <ServerCrash className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">Failed to load projects</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Manage your monitored applications and services."
        icon={<FolderOpen className="h-5 w-5" />}
        iconColor="bg-primary/10 text-primary"
        actions={
          <Button
            id="create-project-btn"
            variant="primary"
            onPress={() => setCreateOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Project
          </Button>
        }
      />

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card py-20 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">No projects yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create your first project to start capturing telemetry
          </p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            onPress={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> New Project
          </Button>
        </div>
      )}

      {/* Grid */}
      {!isLoading && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {createOpen && organizationId && (
        <CreateProjectModal
          organizationId={organizationId}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ProjectsContent />
    </React.Suspense>
  );
}
