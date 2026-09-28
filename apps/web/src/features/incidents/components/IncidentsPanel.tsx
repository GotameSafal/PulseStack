"use client";

import React, { useState } from "react";
import { Siren, ShieldAlert, CheckCircle2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { IncidentResponse } from "@pulsestack/shared";
import { MasterTable } from "@/components/table/MasterTable";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { IncidentDetailModal } from "./IncidentDetailModal";
import { useIncidents } from "@/features/incidents/hooks/useIncidents";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value as string));
}

function StatusBadge({ status }: { status: "open" | "resolved" }) {
  return status === "open" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger">
      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
      Open
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      Resolved
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status filter tabs
// ---------------------------------------------------------------------------

type StatusFilter = "all" | "open" | "resolved";

function FilterTabs({
  value,
  onChange,
  openCount,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
  openCount: number;
}) {
  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "resolved", label: "Resolved" },
  ];

  return (
    <div
      className="inline-flex rounded-lg border border-border bg-card p-0.5 gap-0.5"
      role="tablist"
      aria-label="Filter incidents by status"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            value === tab.key
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.label}
          {tab.key === "open" && openCount > 0 && (
            <span className="ml-1.5 rounded-full bg-danger/20 px-1.5 py-0.5 text-[10px] font-bold text-danger">
              {openCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface IncidentsPanelProps {
  projectId: string;
}

export function IncidentsPanel({ projectId }: IncidentsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIncident, setSelectedIncident] =
    useState<IncidentResponse | null>(null);

  const queryStatus =
    statusFilter === "all" ? undefined : statusFilter;

  const {
    data: incidents = [],
    isLoading,
    isError,
    error,
  } = useIncidents(projectId, queryStatus);

  const openCount = incidents.filter((i) => i.status === "open").length;

  const columns: ColumnDef<any, IncidentResponse, any>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }: { row: { original: IncidentResponse } }) => (
        <span className="font-medium text-foreground text-sm">
          {row.original.title}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: { row: { original: IncidentResponse } }) => (
        <StatusBadge status={row.original.status} />
      ),
    },
    {
      accessorKey: "triggerValue",
      header: "Trigger Value",
      cell: ({ row }: { row: { original: IncidentResponse } }) => (
        <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-foreground">
          {row.original.triggerValue}
        </code>
      ),
    },
    {
      accessorKey: "alertRuleId",
      header: "Rule ID",
      cell: ({ row }: { row: { original: IncidentResponse } }) => (
        <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px] block">
          {row.original.alertRuleId}
        </span>
      ),
    },
    {
      accessorKey: "openedAt",
      header: "Opened",
      cell: ({ row }: { row: { original: IncidentResponse } }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.openedAt)}
        </span>
      ),
    },
    {
      accessorKey: "resolvedAt",
      header: "Resolved",
      cell: ({ row }: { row: { original: IncidentResponse } }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.resolvedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }: { row: { original: IncidentResponse } }) => (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`View incident: ${row.original.title}`}
          onPress={() => setSelectedIncident(row.original)}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Incidents"
        description="Alert-triggered incidents — auto-refreshes every 30 s"
        icon={<Siren className="h-5 w-5" aria-hidden="true" />}
        iconColor="bg-danger/10 text-danger"
        actions={
          <FilterTabs
            value={statusFilter}
            onChange={setStatusFilter}
            openCount={openCount}
          />
        }
      />

      {/* Summary strip */}
      {!isLoading && !isError && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
            <ShieldAlert className="h-4 w-4 text-danger" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">
              {incidents.filter((i) => i.status === "open").length}
            </span>
            <span className="text-xs text-muted-foreground">Open</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">
              {incidents.filter((i) => i.status === "resolved").length}
            </span>
            <span className="text-xs text-muted-foreground">Resolved</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
            <Siren className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-semibold text-foreground">
              {incidents.length}
            </span>
            <span className="text-xs text-muted-foreground">Total shown</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          Failed to load incidents: {error?.message ?? "Unknown error"}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && incidents.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <Siren className="h-10 w-10 text-muted-foreground/40 mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            {statusFilter === "open"
              ? "No open incidents"
              : statusFilter === "resolved"
              ? "No resolved incidents"
              : "No incidents yet"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Incidents are created automatically when alert rules are breached
          </p>
        </div>
      )}

      {/* Table */}
      {(isLoading || incidents.length > 0) && (
        <MasterTable<IncidentResponse>
          queryKey="incidents"
          columns={columns as any}
          data={incidents}
          isLoading={isLoading}
          totalCount={incidents.length}
        />
      )}

      {/* Detail modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        projectId={projectId}
        onClose={() => setSelectedIncident(null)}
      />
    </div>
  );
}
