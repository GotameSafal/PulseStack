"use client";

import React from "react";
import { Shield, Sparkles, Database } from "lucide-react";

export default function DashboardHome() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to the Next.js 16 Enterprise Starter Platform control center.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-border bg-card rounded-2xl p-6 shadow-sm">
          <div className="flex gap-3 items-center mb-4">
            <div className="p-2 bg-secondary rounded-lg">
              <Shield className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <p className="text-md font-bold">Role-Based Auth</p>
              <p className="text-small text-muted-foreground">Middleware protected</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Built-in adapters and decorators for <code>ADMIN</code>, <code>MANAGER</code>, and <code>USER</code> permissions.
          </p>
        </div>

        <div className="border border-border bg-card rounded-2xl p-6 shadow-sm">
          <div className="flex gap-3 items-center mb-4">
            <div className="p-2 bg-secondary rounded-lg">
              <Sparkles className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <p className="text-md font-bold">Design Foundation</p>
              <p className="text-small text-muted-foreground">Tailwind CSS + Adaptive variables</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Clean interactive styles, unified dark/light support, dynamic layout wrappers.
          </p>
        </div>

        <div className="border border-border bg-card rounded-2xl p-6 shadow-sm">
          <div className="flex gap-3 items-center mb-4">
            <div className="p-2 bg-secondary rounded-lg">
              <Database className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <p className="text-md font-bold">Data Management</p>
              <p className="text-small text-muted-foreground">TanStack Integration</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Synchronized server state, dynamic forms generator, and filter-preserving URL syncing table.
          </p>
        </div>
      </div>
    </div>
  );
}
