"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequestExplorerItem } from "@pulsestack/shared";

interface RequestTableProps {
  items: RequestExplorerItem[];
  totalCount: number;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
  onSelectRequest: (item: RequestExplorerItem) => void;
}

const METHOD_BADGES: Record<string, string> = {
  GET: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  POST: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  PUT: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  PATCH: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  DELETE: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

export function RequestTable({
  items,
  totalCount,
  limit,
  offset,
  onOffsetChange,
  onSelectRequest,
}: RequestTableProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  function getStatusBadge(code: number) {
    if (code >= 200 && code < 300) {
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    }
    if (code >= 300 && code < 400) {
      return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    }
    if (code >= 400 && code < 500) {
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    }
    return "bg-rose-500/10 text-rose-500 border-rose-500/20";
  }

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
      {/* Table responsive container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs" aria-label="HTTP requests log">
          <thead className="border-b border-border bg-secondary/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Path</th>
              <th className="px-4 py-3 text-right">Latency</th>
              <th className="px-4 py-3">Client IP</th>
              <th className="px-4 py-3 text-right">Time</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.map((item) => {
              const statusCls = getStatusBadge(item.statusCode);
              const methodCls =
                METHOD_BADGES[item.method] ?? "bg-secondary text-muted-foreground border-border";

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectRequest(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectRequest(item);
                    }
                  }}
                  tabIndex={0}
                  className="cursor-pointer transition-colors hover:bg-secondary/30 focus-visible:bg-secondary/40 focus-visible:outline-hidden"
                >
                  {/* Status */}
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold", statusCls)}>
                      {item.statusCode}
                    </span>
                  </td>

                  {/* Method */}
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase", methodCls)}>
                      {item.method}
                    </span>
                  </td>

                  {/* Path */}
                  <td className="px-4 py-2.5 font-mono font-medium text-foreground max-w-xs truncate" title={item.path}>
                    {item.path}
                  </td>

                  {/* Latency */}
                  <td className="px-4 py-2.5 font-mono text-right whitespace-nowrap">
                    <span
                      className={cn(
                        item.durationMs > 1000
                          ? "text-rose-400 font-bold"
                          : item.durationMs > 500
                            ? "text-amber-400 font-medium"
                            : "text-muted-foreground"
                      )}
                    >
                      {item.durationMs.toFixed(1)} ms
                    </span>
                  </td>

                  {/* Client IP */}
                  <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                    {item.clientIp || "—"}
                  </td>

                  {/* Time */}
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-muted-foreground" title={new Date(item.timestamp).toLocaleString()}>
                    {formatRelativeTime(item.timestamp)}
                  </td>

                  {/* Action */}
                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRequest(item);
                      }}
                      className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      title="Inspect request details"
                      aria-label={`Inspect request ${item.method} ${item.path}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground bg-card">
        <div>
          Showing <span className="font-semibold text-foreground">{offset + 1}</span> to{" "}
          <span className="font-semibold text-foreground">
            {Math.min(offset + limit, totalCount)}
          </span>{" "}
          of <span className="font-semibold text-foreground">{totalCount.toLocaleString()}</span> requests
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => onOffsetChange(Math.max(0, offset - limit))}
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>

          <span className="px-2 text-xs font-medium text-foreground">
            {currentPage} / {totalPages}
          </span>

          <button
            type="button"
            disabled={offset + limit >= totalCount}
            onClick={() => onOffsetChange(offset + limit)}
            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
