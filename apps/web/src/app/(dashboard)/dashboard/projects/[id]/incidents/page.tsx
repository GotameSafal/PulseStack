import type { Metadata } from "next";
import { IncidentsPanel } from "@/features/incidents/components/IncidentsPanel";

interface IncidentsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: IncidentsPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Incidents — ${id} | PulseStack`,
    description: `View and triage alert-triggered incidents for project ${id}`,
  };
}

export default async function IncidentsPage({ params }: IncidentsPageProps) {
  const { id: projectId } = await params;
  return <IncidentsPanel projectId={projectId} />;
}
