"use client";

import React, { useEffect } from "react";
import { X, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequestExplorerItem } from "@pulsestack/shared";

interface RequestDetailDrawerProps {
  item: RequestExplorerItem | null;
  onClose: () => void;
}

export function RequestDetailDrawer({ item, onClose }: RequestDetailDrawerProps) {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    if (item) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [item, onClose]);

  if (!item) return null;

  const statusColor =
    item.statusCode >= 200 && item.statusCode < 300
      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
      : item.statusCode >= 300 && item.statusCode < 400
        ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
        : item.statusCode >= 400 && item.statusCode < 500
          ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
          : "bg-rose-500/10 text-rose-500 border-rose-500/20";

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  const headerEntries = Object.entries(item.headers || {});
  const queryEntries = Object.entries(item.queryParams || {});

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer content */}
      <div className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-xs font-bold",
                statusColor
              )}
            >
              {item.statusCode}
            </span>
            <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
              {item.method}
            </span>
            <h2 id="drawer-title" className="truncate font-mono text-xs text-foreground font-medium" title={item.path}>
              {item.path}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close request details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable details */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {/* Metadata Grid */}
          <section aria-labelledby="meta-heading">
            <h3 id="meta-heading" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2.5">
              Request Metadata
            </h3>
            <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border bg-secondary/20 p-3">
              <div>
                <span className="text-muted-foreground block text-[11px]">Duration</span>
                <span className="font-mono font-medium text-foreground">{item.durationMs.toFixed(2)} ms</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Timestamp</span>
                <span className="font-mono text-foreground">{new Date(item.timestamp).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Client IP</span>
                <span className="font-mono text-foreground">{item.clientIp || "Unknown"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Request ID</span>
                <span className="font-mono text-foreground truncate block" title={item.id}>
                  {item.id}
                </span>
              </div>
              {item.requestBodySize !== null && (
                <div>
                  <span className="text-muted-foreground block text-[11px]">Request Body</span>
                  <span className="font-mono text-foreground">{item.requestBodySize} bytes</span>
                </div>
              )}
              {item.responseBodySize !== null && (
                <div>
                  <span className="text-muted-foreground block text-[11px]">Response Body</span>
                  <span className="font-mono text-foreground">{item.responseBodySize} bytes</span>
                </div>
              )}
            </div>
          </section>

          {/* User Agent */}
          {item.userAgent && (
            <section aria-labelledby="ua-heading">
              <h3 id="ua-heading" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">
                User Agent
              </h3>
              <div className="rounded-lg border border-border bg-secondary/20 p-2.5 font-mono text-[11px] break-all text-muted-foreground">
                {item.userAgent}
              </div>
            </section>
          )}

          {/* Query Parameters */}
          <section aria-labelledby="params-heading">
            <div className="flex items-center justify-between mb-2">
              <h3 id="params-heading" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Query Parameters ({queryEntries.length})
              </h3>
            </div>
            {queryEntries.length === 0 ? (
              <p className="text-muted-foreground/60 italic text-xs">No query parameters</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="p-2 font-medium">Key</th>
                      <th className="p-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {queryEntries.map(([k, v]) => (
                      <tr key={k} className="hover:bg-secondary/20">
                        <td className="p-2 font-semibold text-primary">{k}</td>
                        <td className="p-2 text-foreground break-all">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Headers */}
          <section aria-labelledby="headers-heading">
            <div className="flex items-center justify-between mb-2">
              <h3 id="headers-heading" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Headers ({headerEntries.length})
              </h3>
              <button
                type="button"
                onClick={() => copyText(JSON.stringify(item.headers, null, 2), "headers")}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedKey === "headers" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy JSON
                  </>
                )}
              </button>
            </div>
            {headerEntries.length === 0 ? (
              <p className="text-muted-foreground/60 italic text-xs">No headers captured</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead className="bg-secondary/50 text-muted-foreground">
                    <tr>
                      <th className="p-2 font-medium">Header</th>
                      <th className="p-2 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {headerEntries.map(([k, v]) => (
                      <tr key={k} className="hover:bg-secondary/20">
                        <td className="p-2 font-semibold text-muted-foreground">{k}</td>
                        <td className="p-2 text-foreground break-all">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
