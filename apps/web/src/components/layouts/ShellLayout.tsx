"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, LayoutDashboard, LogOut, FolderOpen, Activity, HelpCircle } from "lucide-react";
import { useAuthStore } from "@/lib/auth/authStore";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { clearAuthCookieAction } from "@/actions/authCookies";

interface ShellLayoutProps {
  children: React.ReactNode;
}

export function ShellLayout({ children }: ShellLayoutProps) {
  const pathname = usePathname();
  const { user, logout, initAuth } = useAuthStore();

  const handleLogout = async () => {
    await clearAuthCookieAction();
    await logout();
  };

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Projects", href: "/dashboard/projects", icon: FolderOpen },
    { label: "Users List", href: "/dashboard/users", icon: Users },
    { label: "Help & Docs", href: "/dashboard/help", icon: HelpCircle },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="w-5 h-5" />
            </div>
            <span className="font-bold text-base tracking-tight text-foreground">PulseStack</span>
          </div>
          <ThemeToggle />
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-border space-y-3 bg-secondary/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              {user?.name?.[0] || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name || "Standard User"}</p>
              <p className="text-tiny text-muted-foreground truncate">{user?.role || "USER"}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-xs"
            size="sm"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main workspace */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-background p-6">
        <div className="w-full mx-auto">{children}</div>
      </main>
    </div>
  );
}
