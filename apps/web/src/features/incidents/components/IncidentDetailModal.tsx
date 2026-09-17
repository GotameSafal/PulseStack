"use client";

import React, { useState } from "react";
import { ShieldAlert, CheckCircle2, Clock, Hash } from "lucide-react";
import type { IncidentResponse } from "@pulsestack/shared";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextArea";
import { Button } from "@/components/ui/Button";
import { useUpdateIncident } from "@/features/incidents/hooks/useIncidentMutations";

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
    <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-semibold text-danger">
      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
      Open
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      Resolved
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface IncidentDetailModalProps {
  incident: IncidentResponse | null;
  projectId: string;
  onClose: () => void;
}

export function IncidentDetailModal({
  incident,
  projectId,
  onClose,
}: IncidentDetailModalProps) {
  const [prevIncidentId, setPrevIncidentId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  // Sync state during render when incident changes (idiomatic React pattern)
  if (incident && incident.id !== prevIncidentId) {
    setPrevIncidentId(incident.id);
    setNotes(incident.notes ?? "");
    setNotesSaved(false);
  }

  const updateMutation = useUpdateIncident(
    projectId,
    incident?.id ?? ""
  );

  if (!incident) return null;

  const handleSaveNotes = async () => {
    await updateMutation.mutateAsync({ notes });
    setNotesSaved(true);
  };

  const handleResolve = async () => {
    await updateMutation.mutateAsync({ status: "resolved" });
    onClose();
  };

  const canResolve = incident.status === "open";
  // Detect metric type from title heuristic or use triggerValue directly
  // (API doesn't return metric type on incident, so we display raw value)

  return (
    <Modal
      isOpen={Boolean(incident)}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={
        <div className="flex items-start gap-3">
          <StatusBadge status={incident.status} />
          <h2 className="text-base font-semibold text-foreground leading-snug">
            {incident.title}
          </h2>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex gap-2">
            {canResolve && (
              <Button
                variant="primary"
                loading={updateMutation.isPending}
                onPress={handleResolve}
                id={`resolve-incident-${incident.id}`}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" aria-hidden="true" />
                Resolve Manually
              </Button>
            )}
          </div>
          <Button variant="ghost" onPress={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Metadata grid */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
              Trigger Value
            </dt>
            <dd className="font-mono font-semibold text-foreground">
              {incident.triggerValue}
            </dd>
          </div>

          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
              Status
            </dt>
            <dd>
              <StatusBadge status={incident.status} />
            </dd>
          </div>

          <div className="flex items-start gap-1.5">
            <Clock className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                Opened
              </dt>
              <dd className="text-foreground">{formatDate(incident.openedAt)}</dd>
            </div>
          </div>

          <div className="flex items-start gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                Resolved
              </dt>
              <dd className="text-foreground">{formatDate(incident.resolvedAt)}</dd>
            </div>
          </div>

          <div className="col-span-2 flex items-start gap-1.5">
            <Hash className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-0.5">
                Alert Rule ID
              </dt>
              <dd className="font-mono text-xs text-muted-foreground break-all">
                {incident.alertRuleId}
              </dd>
            </div>
          </div>
        </dl>

        <hr className="border-border" />

        {/* Notes */}
        <div>
          <TextArea
            label="Notes"
            placeholder="Add investigation notes, root cause, or any relevant context…"
            rows={4}
            value={notes}
            onChange={(e) => {
              setNotes((e.target as HTMLTextAreaElement).value);
              setNotesSaved(false);
            }}
          />
          <div className="flex items-center justify-between mt-2">
            {updateMutation.error && (
              <p className="text-xs text-danger" role="alert">
                {updateMutation.error.message}
              </p>
            )}
            {notesSaved && !updateMutation.error && (
              <p className="text-xs text-success">Notes saved.</p>
            )}
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                loading={updateMutation.isPending}
                onPress={handleSaveNotes}
                isDisabled={notes === (incident.notes ?? "")}
              >
                Save Notes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
