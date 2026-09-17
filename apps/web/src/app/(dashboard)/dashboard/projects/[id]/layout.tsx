import React from "react";
import { ProjectShellLayout } from "@/components/layouts/ProjectShellLayout";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id: projectId } = await params;

  return (
    <ProjectShellLayout projectId={projectId}>
      {children}
    </ProjectShellLayout>
  );
}
