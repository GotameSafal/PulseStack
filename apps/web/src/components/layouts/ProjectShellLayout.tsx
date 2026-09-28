"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  List,
  AlertTriangle,
  Bell,
  Siren,
  Settings,
  HelpCircle,
  LogOut,
  ChevronLeft,
  Webhook,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth/authStore";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

interface ProjectShellLayoutProps {
  children: React.ReactNode;
  projectId: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.FC<{ className?: string }>;
}

export function ProjectShellLayout({ children, projectId }: ProjectShellLayoutProps) {
  const pathname = usePathname();
  const { user, logout, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const navItems: NavItem[] = [
    {
      label: "Overview",
      href: `/dashboard/projects/${projectId}/overview`,
      icon: LayoutDashboard,
    },
    {
      label: "Requests",
      href: `/dashboard/projects/${projectId}/requests`,
      icon: List,
    },
    {
      label: "Errors",
      href: `/dashboard/projects/${projectId}/errors`,
      icon: AlertTriangle,
    },
    {
      label: "Alerts",
      href: `/dashboard/projects/${projectId}/alerts`,
      icon: Bell,
    },
    {
      label: "Incidents",
      href: `/dashboard/projects/${projectId}/incidents`,
      icon: Siren,
    },
    {
      label: "Notifications",
      href: `/dashboard/projects/${projectId}/notifications`,
      icon: Webhook,
    },
    {
      label: "Settings",
      href: `/dashboard/projects/${projectId}/settings`,
      icon: Settings,
    },
    {
      label: "Help & Docs",
      href: "/dashboard/help",
      icon: HelpCircle,
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ───────────────────────────────────────── */}
      <aside
        className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex"
        aria-label="Project navigation"
      >
        {/* Brand */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="text-sm font-bold tracking-tight text-foreground">
              PulseStack
            </span>
          </div>
          <ThemeToggle />
        </div>

        {/* Back to projects */}
        <div className="border-b border-border px-3 py-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
            All Projects
          </Link>
        </div>

        {/* Project indicator */}
        <div className="border-b border-border px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Project
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground" title={projectId}>
            {projectId}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3" aria-label="Project sections">
          <ul className="space-y-0.5" role="list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground"
              aria-hidden="true"
            >
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">
                {user?.name ?? "User"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {user?.email ?? ""}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Mobile top bar */}
        <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="text-sm font-bold text-foreground">PulseStack</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex-1 px-4 py-6 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
