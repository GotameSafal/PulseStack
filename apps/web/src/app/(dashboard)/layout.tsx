"use client";

import { usePathname } from "next/navigation";
import { ShellLayout } from "@/components/layouts/ShellLayout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // If we are under a project route (/dashboard/projects/*), ProjectShellLayout handles its own shell
  if (pathname.startsWith("/dashboard/projects")) {
    return <>{children}</>;
  }

  return <ShellLayout>{children}</ShellLayout>;
}

