"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Settings,
  KeyRound,
  Trash2,
  AlertTriangle,
  Copy,
  Check,
  Plus,
  Loader2,
  ShieldAlert,
  ServerCrash,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-toastify";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useProject, useDeleteProject } from "@/features/projects/hooks/useProjects";
import axiosInstance from "@/api/setup/axiosInstance";
import type { ApiKeyResponse } from "@pulsestack/shared";

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const { data: project, isLoading: projectLoading, isError, error } = useProject(projectId);
  const deleteProject = useDeleteProject();

  // API Key management state
  const [apiKeysList, setApiKeysList] = useState<ApiKeyResponse[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [createKeyModalOpen, setCreateKeyModalOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyTier, setKeyTier] = useState<"standard" | "pro" | "enterprise">("standard");
  const [keyCreating, setKeyCreating] = useState(false);
  const [createdSecretKey, setCreatedSecretKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [rotatingKeyId, setRotatingKeyId] = useState<string | null>(null);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [revokeConfirmKeyId, setRevokeConfirmKeyId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const fetchApiKeys = React.useCallback(async () => {
    if (!projectId) return;
    setKeysLoading(true);
    try {
      const { data } = await axiosInstance.get<ApiKeyResponse[]>(`/projects/${projectId}/api-keys`);
      setApiKeysList(data);
    } catch (err: any) {
      console.error("Failed to fetch API keys", err);
    } finally {
      setKeysLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !keyName) return;
    setKeyCreating(true);
    try {
      const { data } = await axiosInstance.post<ApiKeyResponse>(`/projects/${projectId}/api-keys`, {
        name: keyName,
        rateLimitTier: keyTier,
      });
      setCreatedSecretKey(data.secretKey || "Key created");
      setKeyName("");
      fetchApiKeys();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "Failed to generate key");
    } finally {
      setKeyCreating(false);
    }
  };

  const handleRotateKey = async (keyId: string) => {
    setRotatingKeyId(keyId);
    try {
      const { data } = await axiosInstance.post<ApiKeyResponse>(
        `/projects/${projectId}/api-keys/${keyId}/rotate`
      );
      setCreatedSecretKey(data.secretKey ?? null);
      setCreateKeyModalOpen(true);
      fetchApiKeys();
      toast.success("Key rotated — copy the new secret before closing!");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "Failed to rotate key");
    } finally {
      setRotatingKeyId(null);
    }
  };

  const confirmRevokeKey = async () => {
    if (!revokeConfirmKeyId) return;
    setRevokingKeyId(revokeConfirmKeyId);
    setRevokeConfirmKeyId(null);
    try {
      await axiosInstance.delete(`/projects/${projectId}/api-keys/${revokeConfirmKeyId}`);
      fetchApiKeys();
      toast.success("API key revoked successfully.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "Failed to revoke key");
    } finally {
      setRevokingKeyId(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!project || confirmName !== project.name) return;
    await deleteProject.mutateAsync(project.id);
    setDeleteModalOpen(false);
    router.push("/dashboard/projects");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <ServerCrash className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">Failed to load project details</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      <PageHeader
        title="Project Settings"
        description="Manage API credentials, configuration, and security settings."
        icon={<Settings className="h-5 w-5" />}
        iconColor="bg-primary/10 text-primary"
      />

      {projectLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!projectLoading && project && (
        <div className="space-y-8">
          {/* General Information */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <h3 className="text-base font-semibold text-foreground">General Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Project Name
                </label>
                <p className="text-sm font-medium text-foreground mt-1">{project.name}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Slug / Identifier
                </label>
                <p className="text-sm font-mono text-foreground mt-1">{project.slug}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Environment
                </label>
                <p className="text-sm font-medium text-foreground mt-1 capitalize">{project.environment}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Project ID
                </label>
                <p className="text-sm font-mono text-muted-foreground mt-1 truncate">{project.id}</p>
              </div>
            </div>
          </div>

          {/* API Keys Section */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  API Keys &amp; Ingestion Tokens
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generate and rotate ingest keys to send traces, logs, and metrics from the @pulsestack/node SDK.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onPress={() => {
                  setCreatedSecretKey(null);
                  setKeyName("");
                  setCreateKeyModalOpen(true);
                }}
                className="gap-1.5 text-xs font-semibold shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Generate Key
              </Button>
            </div>

            {/* Keys Table / Empty State */}
            {keysLoading && apiKeysList.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeysList.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-8 px-4 text-center">
                <KeyRound className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">No API keys generated yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Create an API key above to start transmitting telemetry from your application into PulseStack.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Label</th>
                      <th className="py-3 px-4">API Key Token</th>
                      <th className="py-3 px-4">Rate Limit</th>
                      <th className="py-3 px-4">Created</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {apiKeysList.map((k) => (
                      <tr key={k.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-foreground">{k.name}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-foreground/90 bg-muted/60 px-2 py-0.5 rounded border border-border">
                              {k.keyPrefix}••••••••••••••••
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(k.keyPrefix);
                                toast.info("Copied key prefix to clipboard");
                              }}
                              className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                              title="Copy key prefix"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              k.rateLimitTier === "enterprise"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                                : k.rateLimitTier === "pro"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {k.rateLimitTier}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(k.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2.5 gap-1 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                              loading={rotatingKeyId === k.id}
                              onPress={() => handleRotateKey(k.id)}
                            >
                              <RefreshCw className="h-3 w-3" />
                              Rotate
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 px-2 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                              loading={revokingKeyId === k.id}
                              onPress={() => setRevokeConfirmKeyId(k.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                              Revoke
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-rose-600 dark:text-rose-400">
                  Danger Zone
                </h3>
                <p className="text-xs text-muted-foreground">
                  Irreversible actions that affect your project and all captured telemetry.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-rose-500/20 bg-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Delete this project</h4>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-lg">
                  Once deleted, all historical ClickHouse metrics, error traces, incidents, API keys, and alert configurations will be permanently purged.
                </p>
              </div>

              <Button
                variant="danger"
                onPress={() => {
                  setConfirmName("");
                  setDeleteModalOpen(true);
                }}
                className="shrink-0 flex items-center gap-2 font-semibold text-xs"
              >
                <Trash2 className="h-4 w-4" />
                Delete Project
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Generate API Key Modal */}
      {createKeyModalOpen && (
        <Modal
          isOpen
          onOpenChange={(open) => !open && setCreateKeyModalOpen(false)}
      title={createdSecretKey ? (
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" /> API Key Ready
            </span>
          ) : "Generate New API Key"}
          footer={
            createdSecretKey ? (
              <Button variant="primary" onPress={() => setCreateKeyModalOpen(false)}>
                Done
              </Button>
            ) : (
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onPress={() => setCreateKeyModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={keyCreating}
                  onPress={() =>
                    document
                      .getElementById("create-api-key-form")
                      ?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))
                  }
                >
                  Generate
                </Button>
              </div>
            )
          }
        >
          {createdSecretKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <span>Make sure to copy your secret key now. You won't be able to see it again!</span>
              </div>

              <div className="relative flex items-center">
                <input
                  type="text"
                  readOnly
                  value={createdSecretKey}
                  className="w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs font-mono text-foreground pr-10 outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdSecretKey)}
                  className="absolute right-2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {copiedKey ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ) : (
            <form id="create-api-key-form" onSubmit={handleCreateApiKey} className="space-y-4">
              <Input
                label="Key Label"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="Production Ingestion Key"
                required
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Rate Limit Tier</label>
                <div className="flex gap-2">
                  {(["standard", "pro", "enterprise"] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setKeyTier(tier)}
                      className={`flex-1 rounded-lg border py-2 text-xs font-semibold capitalize transition-all ${
                        keyTier === tier
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Revoke API Key Confirmation Modal */}
      {revokeConfirmKeyId && (
        <Modal
          isOpen
          onOpenChange={(open) => !open && setRevokeConfirmKeyId(null)}
          title={
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              <span>Revoke API Key?</span>
            </div>
          }
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onPress={() => setRevokeConfirmKeyId(null)}>
                Cancel
              </Button>
              <Button variant="danger" onPress={confirmRevokeKey} className="font-semibold">
                Yes, Revoke Key
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            Revoking this key will <strong className="text-foreground">immediately stop all ingestion</strong> from
            any application or SDK using it. This action cannot be undone.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            If you need to replace it, use <strong className="text-foreground">Rotate</strong> instead.
          </p>
        </Modal>
      )}

      {/* Delete Confirmation Modal (Name confirmation required) */}
      {deleteModalOpen && project && (
        <Modal
          isOpen
          onOpenChange={(open) => !open && setDeleteModalOpen(false)}
          title={
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
              <span>Delete Project Confirmation</span>
            </div>
          }
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onPress={() => setDeleteModalOpen(false)}
                isDisabled={deleteProject.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={deleteProject.isPending}
                isDisabled={confirmName !== project.name || deleteProject.isPending}
                onPress={handleDeleteProject}
                className="font-semibold"
              >
                I understand the consequences, delete this project
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              This action <strong className="text-foreground font-semibold">cannot be undone</strong>. This will permanently delete the{" "}
              <strong className="text-foreground font-semibold font-mono">{project.name}</strong> project, including all its telemetry logs, metrics, alerts, and incidents.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">
                To confirm, please type <span className="font-bold text-rose-500">{project.name}</span> below:
              </label>
              <Input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={project.name}
                autoFocus
              />
            </div>

            {deleteProject.error && (
              <p role="alert" className="text-xs text-danger font-medium">
                {deleteProject.error.message}
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
