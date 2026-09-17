"use client";

import React from "react";
import { Clock, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ErrorGroupSummary } from "@pulsestack/shared";

interface ErrorListProps {
  groups: ErrorGroupSummary[];
  selectedGroup: ErrorGroupSummary | null;
  onSelectGroup: (group: ErrorGroupSummary) => void;
}

export function ErrorList({ groups, selectedGroup, onSelectGroup }: ErrorListProps) {
  function formatRelativeTime(isoStr: string) {
    const date = new Date(isoStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card shadow-xs overflow-hidden">
      <div className="border-b border-border bg-secondary/30 px-4 py-3">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Error Groups ({groups.length})
        </h2>
      </div>

      <div className="divide-y divide-border/60 overflow-y-auto max-h-[600px]" role="list">
        {groups.map((group) => {
          const isSelected = selectedGroup?.groupKey === group.groupKey;

          return (
            <button
              key={group.groupKey}
              type="button"
              onClick={() => onSelectGroup(group)}
              aria-pressed={isSelected}
              className={cn(
                "flex w-full flex-col p-4 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "bg-primary/10 border-l-4 border-l-primary"
                  : "hover:bg-secondary/30"
              )}
            >
              {/* Top row: Name + Handled Badge + Occurrences */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs font-bold text-rose-500 truncate" title={group.name}>
                    {group.name}
                  </span>
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wider",
                      group.handled
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-rose-500/10 text-rose-400 font-bold"
                    )}
                  >
                    {group.handled ? "Handled" : "Unhandled"}
                  </span>
                </div>

                <div className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-500 shrink-0">
                  <Flame className="h-3 w-3" />
                  {group.occurrences.toLocaleString()}
                </div>
              </div>

              {/* Message preview */}
              <p className="font-mono text-[11px] text-muted-foreground line-clamp-2 mb-2 break-all">
                {group.sampleMessage || "No message provided"}
              </p>

              {/* Timestamps */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
                <span className="truncate max-w-[180px] font-mono" title={group.groupKey}>
                  key: {group.groupKey.substring(0, 16)}…
                </span>
                <span className="flex items-center gap-1 shrink-0" title={`Last seen: ${new Date(group.lastSeen).toLocaleString()}`}>
                  <Clock className="h-3 w-3" />
                  Last: {formatRelativeTime(group.lastSeen)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
