"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Bell,
  Plus,
  Trash2,
  Webhook,
  MessageSquare,
  Power,
  PowerOff,
  Loader2,
  Link2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { toast } from "react-toastify";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import axiosInstance from "@/api/setup/axiosInstance";
import type { NotificationChannelResponse } from "@pulsestack/shared";

const CHANNEL_TYPES = [
  {
    id: "webhook" as const,
    label: "Generic Webhook",
    icon: Webhook,
    description: "POST JSON payload to any HTTP endpoint",
    placeholder: "https://your-service.com/webhook",
  },
  {
    id: "slack" as const,
    label: "Slack",
    icon: MessageSquare,
    description: "Send alerts to a Slack Incoming Webhook URL",
    placeholder: "https://hooks.slack.com/services/T.../B.../...",
  },
];

export default function NotificationsPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [channels, setChannels] = useState<NotificationChannelResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    type: "webhook" as "webhook" | "slack",
    destinationUrl: "",
    signingSecret: "",
  });

  const fetchChannels = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const { data } = await axiosInstance.get<NotificationChannelResponse[]>(
        `/projects/${projectId}/channels`
      );
      setChannels(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load notification channels");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const resetForm = () =>
    setForm({ name: "", type: "webhook", destinationUrl: "", signingSecret: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.destinationUrl) return;
    setSubmitting(true);
    try {
      await axiosInstance.post(`/projects/${projectId}/channels`, {
        name: form.name,
        type: form.type,
        destinationUrl: form.destinationUrl,
        signingSecret: form.signingSecret || undefined,
        enabled: true,
      });
      toast.success(`Channel "${form.name}" created successfully`);
      resetForm();
      setCreateOpen(false);
      fetchChannels();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create channel");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (channel: NotificationChannelResponse) => {
    setTogglingId(channel.id);
    try {
      await axiosInstance.patch(`/projects/${projectId}/channels/${channel.id}`, {
        enabled: !channel.enabled,
      });
      toast.success(`Channel ${channel.enabled ? "disabled" : "enabled"}`);
      fetchChannels();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update channel");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    setDeletingId(deleteTargetId);
    setDeleteTargetId(null);
    try {
      await axiosInstance.delete(`/projects/${projectId}/channels/${deleteTargetId}`);
      toast.success("Channel removed");
      fetchChannels();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete channel");
    } finally {
      setDeletingId(null);
    }
  };

  const selectedType = CHANNEL_TYPES.find((t) => t.id === form.type)!;

  return (
    <div className="space-y-8 max-w-4xl pb-12">
      <PageHeader
        title="Notification Channels"
        description="Configure webhook and Slack destinations. Channels are linked to alert rules to deliver incident notifications."
        icon={<Bell className="h-5 w-5" />}
        iconColor="bg-violet-500/10 text-violet-500"
      />

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading channels…
            </span>
          ) : (
            <span>{channels.length} channel{channels.length !== 1 ? "s" : ""} configured</span>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          className="gap-1.5 text-xs font-semibold"
          onPress={() => {
            resetForm();
            setCreateOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Channel
        </Button>
      </div>

      {/* Channel list */}
      {!loading && channels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 px-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
            <Bell className="h-7 w-7 text-violet-500" />
          </div>
          <p className="text-base font-semibold text-foreground">No channels yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Add a webhook or Slack channel, then link it to an alert rule to start receiving incident notifications.
          </p>
          <Button
            variant="primary"
            size="sm"
            className="mt-5 gap-1.5 text-xs font-semibold"
            onPress={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Add your first channel
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => {
            const typeInfo = CHANNEL_TYPES.find((t) => t.id === ch.type);
            const Icon = typeInfo?.icon ?? Webhook;
            return (
              <div
                key={ch.id}
                className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Icon + info */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted border border-border">
                    <Icon className="h-5 w-5 text-foreground/70" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{ch.name}</p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          ch.enabled
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}
                      >
                        {ch.enabled ? (
                          <><CheckCircle2 className="h-2.5 w-2.5 mr-1" />Active</>
                        ) : (
                          "Disabled"
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        {ch.maskedUrl}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {typeInfo?.label ?? ch.type} · Added {new Date(ch.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className={`text-xs h-8 px-3 gap-1.5 ${
                      ch.enabled
                        ? "text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                        : "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    }`}
                    loading={togglingId === ch.id}
                    onPress={() => handleToggle(ch)}
                  >
                    {ch.enabled ? (
                      <><PowerOff className="h-3.5 w-3.5" /> Disable</>
                    ) : (
                      <><Power className="h-3.5 w-3.5" /> Enable</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 px-3 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                    loading={deletingId === ch.id}
                    onPress={() => setDeleteTargetId(ch.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info callout */}
      {channels.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <ShieldCheck className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Destination URLs are <strong className="text-foreground">encrypted at rest</strong> using AES-256-GCM.
            To link a channel to an alert rule, go to the <strong className="text-foreground">Alerts</strong> tab and select this channel when creating or editing a rule.
          </p>
        </div>
      )}

      {/* ── Create Channel Modal ────────────────────────────────────────────── */}
      {createOpen && (
        <Modal
          isOpen
          onOpenChange={(open) => !open && setCreateOpen(false)}
          title={
            <span className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-violet-500" />
              Add Notification Channel
            </span>
          }
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onPress={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={submitting}
                onPress={() =>
                  document
                    .getElementById("create-channel-form")
                    ?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))
                }
              >
                Add Channel
              </Button>
            </div>
          }
        >
          <form id="create-channel-form" onSubmit={handleCreate} className="space-y-5">
            {/* Type selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Channel Type</label>
              <div className="grid grid-cols-2 gap-2">
                {CHANNEL_TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type: t.id }))}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                        form.type === t.id
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${form.type === t.id ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <p className={`text-xs font-semibold ${form.type === t.id ? "text-primary" : "text-foreground"}`}>
                          {t.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                          {t.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <Input
              label="Channel Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={`e.g. ${form.type === "slack" ? "DevOps Slack Alerts" : "Production Webhook"}`}
              required
            />

            <Input
              label="Destination URL"
              value={form.destinationUrl}
              onChange={(e) => setForm((f) => ({ ...f, destinationUrl: e.target.value }))}
              placeholder={selectedType.placeholder}
              required
              type="url"
            />

            {form.type === "webhook" && (
              <div className="space-y-1.5">
                <Input
                  label="Signing Secret (optional)"
                  value={form.signingSecret}
                  onChange={(e) => setForm((f) => ({ ...f, signingSecret: e.target.value }))}
                  placeholder="Used for HMAC signature verification"
                  type="password"
                />
                <p className="text-xs text-muted-foreground pl-0.5">
                  If set, PulseStack signs each request with{" "}
                  <code className="font-mono bg-muted px-1 rounded">X-PulseStack-Signature</code>.
                </p>
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* ── Delete Confirmation Modal ───────────────────────────────────────── */}
      {deleteTargetId && (
        <Modal
          isOpen
          onOpenChange={(open) => !open && setDeleteTargetId(null)}
          title={
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              Remove Channel?
            </div>
          }
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onPress={() => setDeleteTargetId(null)}>
                Cancel
              </Button>
              <Button variant="danger" onPress={handleDelete} className="font-semibold">
                Yes, Remove
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            This channel will be removed from all linked alert rules and will no longer receive
            incident notifications. This action cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
