"use client";

import React, { useState } from "react";
import {
  HelpCircle,
  BookOpen,
  Code2,
  Terminal,
  Activity,
  Bell,
  ShieldAlert,
  ExternalLink,
  ChevronDown,
  Check,
  Copy,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "How do I install and configure the PulseStack Node.js SDK?",
    answer:
      "Run `pnpm add @pulsestack/node` or `npm install @pulsestack/node`. In your application entrypoint, initialize PulseStack with your project API key: `initPulseStack({ apiKey: 'ps_live_...', endpoint: 'http://localhost:8000' })`.",
  },
  {
    question: "How does real-time ClickHouse telemetry ingestion work?",
    answer:
      "Telemetry events are sent to the PulseStack API and appended to a high-throughput Redis Stream (`telemetry:stream`). The background worker processes batch windows and inserts analytical partitions directly into ClickHouse MergeTree tables.",
  },
  {
    question: "What happens when an alert threshold is breached?",
    answer:
      "The worker evaluates sliding 5-minute statistical windows against your configured alert rules (e.g., latency p95 > 500ms or error rate > 5%). If breached, an Incident is automatically opened and delivered via webhook or email.",
  },
  {
    question: "What happens when I delete a project?",
    answer:
      "Project deletion is permanent. PostgreSQL cascades removal of all API keys, alert configurations, and incident logs. Concurrently, a lightweight partition mutation executes across ClickHouse to permanently delete all associated telemetry logs.",
  },
];

export default function HelpDocsPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const sdkCode = `import { initPulseStack } from "@pulsestack/node";

// Initialize before starting your HTTP server
initPulseStack({
  apiKey: "ps_live_your_project_secret_key",
  endpoint: "http://localhost:8000",
  serviceName: "payment-service",
  environment: "production",
});`;

  const copyCode = () => {
    navigator.clipboard.writeText(sdkCode);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl pb-12">
      <PageHeader
        title="Help & Documentation"
        description="Guides, quick-start snippets, architecture overviews, and frequently asked questions."
        icon={<HelpCircle className="h-5 w-5" />}
        iconColor="bg-primary/10 text-primary"
      />

      {/* Quick Start Card */}
      <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 h-40 w-40 bg-primary/10 blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">SDK Quickstart</h2>
            <p className="text-xs text-muted-foreground">Start shipping traces in 3 lines of code</p>
          </div>
        </div>

        <div className="relative rounded-2xl bg-zinc-950 p-4 border border-zinc-800">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800 text-xs text-zinc-400">
            <span className="font-mono">app.ts / index.ts</span>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
            >
              {copiedSnippet ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Snippet</span>
                </>
              )}
            </button>
          </div>
          <pre className="text-xs font-mono text-zinc-200 overflow-x-auto leading-relaxed">
            <code>{sdkCode}</code>
          </pre>
        </div>
      </section>

      {/* Feature Architecture Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Latency & Metrics</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Calculates high-precision histograms (p50, p90, p95, p99) via ClickHouse quantile aggregates for low-overhead performance profiling.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Error Grouping</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Stack traces and exceptions are fingerprinted and clustered automatically to detect newly introduced runtime bugs and regressions.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
            <Bell className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-sm text-foreground">Incident Engine</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Stateless workers check error rates and threshold criteria every 30 seconds to immediately alert engineers when outages strike.
          </p>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Frequently Asked Questions</h2>
            <p className="text-xs text-muted-foreground">Common operational guidance and best practices</p>
          </div>
        </div>

        <div className="divide-y divide-border border-y border-border">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={idx} className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between text-left font-semibold text-sm text-foreground group"
                >
                  <span className="group-hover:text-primary transition-colors">{faq.question}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed pr-6">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
