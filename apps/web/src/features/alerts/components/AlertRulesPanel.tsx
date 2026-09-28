"use client";

import React, { useState } from "react";
import { Bell, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AlertRuleResponse } from "@pulsestack/shared";
import { MasterTable } from "@/components/table/MasterTable";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { AlertRuleFormModal } from "./AlertRuleFormModal";
import { useAlertRules } from "@/features/alerts/hooks/useAlertRules";
import {
  useUpdateAlertRule,
  useDeleteAlertRule,
} from "@/features/alerts/hooks/useAlertMutations";

// ---------------------------------------------------------------------------
// Human-readable helpers
// ---------------------------------------------------------------------------

const METRIC_LABEL: Record<string, string> = {
  error_rate: "Error Rate",
  p95_latency_ms: "P95 Latency",
  request_volume: "Request Volume",
};

const METRIC_UNIT: Record<string, string> = {
  error_rate: "%",
  p95_latency_ms: " ms",
  request_volume: " req",
};

const CONDITION_LABEL: Record<string, string> = {
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
};

function formatCondition(rule: AlertRuleResponse): string {
  const cond = CONDITION_LABEL[rule.condition] ?? rule.condition;
  const unit = METRIC_UNIT[rule.metric] ?? "";
  return `${cond} ${rule.threshold}${unit}`;
}

// ---------------------------------------------------------------------------
// Inline enable/disable toggle cell
// ---------------------------------------------------------------------------

function EnableToggle({
  rule,
  projectId,
}: {
  rule: AlertRuleResponse;
  projectId: string;
}) {
  const toggleMutation = useUpdateAlertRule(projectId, rule.id);

  return (
    <button
      onClick={() => toggleMutation.mutate({ enabled: !rule.enabled })}
      disabled={toggleMutation.isPending}
      aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
      title={rule.enabled ? "Disable" : "Enable"}
      className="flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50"
    >
      {rule.enabled ? (
        <>
          <ToggleRight className="h-4 w-4 text-success" aria-hidden="true" />
          <span className="text-success">Enabled</span>
        </>
      ) : (
        <>
          <ToggleLeft className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Disabled</span>
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------

function DeleteConfirmModal({
  rule,
  projectId,
  onClose,
}: {
  rule: AlertRuleResponse;
  projectId: string;
  onClose: () => void;
}) {
  const deleteMutation = useDeleteAlertRule(projectId);

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(rule.id);
    onClose();
  };

  return (
    <Modal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      size="sm"
      title={
        <h2 className="text-base font-semibold text-foreground">Delete Alert Rule</h2>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onPress={onClose}
            isDisabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onPress={handleDelete}
          >
            Delete
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted-foreground">
        Are you sure you want to delete{" "}
        <span className="font-semibold text-foreground">&quot;{rule.name}&quot;</span>?
        This action cannot be undone and will stop future evaluations for this rule.
      </p>
      {deleteMutation.error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {deleteMutation.error.message}
        </p>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface AlertRulesPanelProps {
  projectId: string;
}

export function AlertRulesPanel({ projectId }: AlertRulesPanelProps) {
  const { data: rules = [], isLoading, isError, error } = useAlertRules(projectId);

  const [formOpen, setFormOpen] = useState(false);
  const [editRule, setEditRule] = useState<AlertRuleResponse | null>(null);
  const [deleteRule, setDeleteRule] = useState<AlertRuleResponse | null>(null);

  const openCreate = () => {
    setEditRule(null);
    setFormOpen(true);
  };

  const openEdit = (rule: AlertRuleResponse) => {
    setEditRule(rule);
    setFormOpen(true);
  };

  // ColumnDef<TData, TValue> — use `any` for TValue to match MasterTable expectation
  const columns: ColumnDef<any, AlertRuleResponse, any>[] = [
    {
      accessorKey: "name",
      header: "Rule Name",
      cell: ({ row }: { row: { original: AlertRuleResponse } }) => (
        <div>
          <p className="font-medium text-foreground text-sm">{row.original.name}</p>
          {row.original.description && (
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
              {row.original.description}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "metric",
      header: "Metric",
      cell: ({ row }: { row: { original: AlertRuleResponse } }) => (
        <span className="text-sm">
          {METRIC_LABEL[row.original.metric] ?? row.original.metric}
        </span>
      ),
    },
    {
      id: "condition",
      header: "Condition",
      cell: ({ row }: { row: { original: AlertRuleResponse } }) => (
        <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-foreground">
          {formatCondition(row.original)}
        </code>
      ),
    },
    {
      accessorKey: "windowMinutes",
      header: "Window",
      cell: ({ row }: { row: { original: AlertRuleResponse } }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.windowMinutes} min
        </span>
      ),
    },
    {
      accessorKey: "cooldownMinutes",
      header: "Cooldown",
      cell: ({ row }: { row: { original: AlertRuleResponse } }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.cooldownMinutes} min
        </span>
      ),
    },
    {
      id: "enabled",
      header: "Status",
      cell: ({ row }: { row: { original: AlertRuleResponse } }) => (
        <EnableToggle rule={row.original} projectId={projectId} />
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }: { row: { original: AlertRuleResponse } }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Edit ${row.original.name}`}
            onPress={() => openEdit(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="danger-soft"
            size="sm"
            aria-label={`Delete ${row.original.name}`}
            onPress={() => setDeleteRule(row.original)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Alert Rules"
        description="Monitor metrics and trigger incidents automatically"
        icon={<Bell className="h-5 w-5" aria-hidden="true" />}
        iconColor="bg-primary/10 text-primary"
        actions={
          <Button
            id="create-alert-rule-btn"
            variant="primary"
            onPress={openCreate}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Rule
          </Button>
        }
      />

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          Failed to load alert rules: {error?.message ?? "Unknown error"}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && rules.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/40 mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">No alert rules yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create your first rule to start monitoring metrics
          </p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            onPress={openCreate}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> New Rule
          </Button>
        </div>
      )}

      {/* Table */}
      {(isLoading || rules.length > 0) && (
        <MasterTable<AlertRuleResponse>
          queryKey="alerts"
          columns={columns as any}
          data={rules}
          isLoading={isLoading}
          totalCount={rules.length}
        />
      )}

      {/* Create / Edit modal */}
      <AlertRuleFormModal
        isOpen={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditRule(null);
        }}
        projectId={projectId}
        rule={editRule}
      />

      {/* Delete confirmation */}
      {deleteRule && (
        <DeleteConfirmModal
          rule={deleteRule}
          projectId={projectId}
          onClose={() => setDeleteRule(null)}
        />
      )}
    </div>
  );
}
