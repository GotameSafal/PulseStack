"use client";

import React, { useState } from "react";
import { Copy, Check, ChevronDown, ChevronRight, Terminal } from "lucide-react";
import type { ErrorGroupSummary } from "@pulsestack/shared";

interface StackTraceViewerProps {
  error: ErrorGroupSummary;
}

export function StackTraceViewer({ error }: StackTraceViewerProps) {
  const [copied, setCopied] = useState(false);
  const [showContext, setShowContext] = useState(true);

  function copyStack() {
    if (error.sampleStack) {
      navigator.clipboard.writeText(error.sampleStack);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const stackLines = error.sampleStack ? error.sampleStack.split("\n") : [];

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Stack Trace & Sample Payload
          </h3>
        </div>

        {error.sampleStack && (
          <button
            type="button"
            onClick={copyStack}
            className="flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy Trace
              </>
            )}
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 text-xs">
        {/* Error message highlight */}
        <div className="rounded-md border border-rose-500/20 bg-rose-500/5 p-3 font-mono text-xs text-rose-400 break-all">
          <div className="font-bold text-[11px] uppercase tracking-wider mb-1 text-rose-500">
            {error.name}
          </div>
          {error.sampleMessage || "No error message captured"}
        </div>

        {/* Stack Trace Box */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Trace
            </span>
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              {stackLines.length} frames
            </span>
          </div>

          {error.sampleStack ? (
            <div className="overflow-x-auto rounded-lg border border-border bg-zinc-950 p-3.5 font-mono text-[11px] leading-relaxed text-zinc-300">
              <pre className="whitespace-pre">
                {stackLines.map((line, i) => {
                  const isInternal = line.trim().startsWith("at node:") || line.includes("node_modules");
                  return (
                    <div
                      key={i}
                      className={isInternal ? "text-zinc-500 select-all" : "text-zinc-100 font-medium select-all"}
                    >
                      {line}
                    </div>
                  );
                })}
              </pre>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-secondary/20 p-4 text-center text-muted-foreground italic text-xs">
              No stack trace recorded for this error group.
            </div>
          )}
        </div>

        {/* Collapsible Context Payload */}
        <div className="rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setShowContext(!showContext)}
            className="flex w-full items-center justify-between bg-secondary/40 px-3.5 py-2 text-left text-xs font-medium text-foreground hover:bg-secondary/60 transition-colors"
          >
            <span>Group Context & Metadata</span>
            {showContext ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {showContext && (
            <div className="divide-y divide-border/60 bg-card p-3 font-mono text-[11px]">
              <div className="grid grid-cols-2 gap-2 py-1.5">
                <span className="text-muted-foreground">Fingerprint / Group Key</span>
                <span className="text-foreground truncate" title={error.groupKey}>
                  {error.groupKey}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 py-1.5">
                <span className="text-muted-foreground">Occurrences</span>
                <span className="text-foreground font-semibold">{error.occurrences.toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 py-1.5">
                <span className="text-muted-foreground">First Seen</span>
                <span className="text-foreground">{new Date(error.firstSeen).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 py-1.5">
                <span className="text-muted-foreground">Last Seen</span>
                <span className="text-foreground">{new Date(error.lastSeen).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 py-1.5">
                <span className="text-muted-foreground">Handling Mode</span>
                <span className={error.handled ? "text-emerald-400" : "text-rose-400 font-semibold"}>
                  {error.handled ? "Handled (Caught)" : "Unhandled Exception"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
