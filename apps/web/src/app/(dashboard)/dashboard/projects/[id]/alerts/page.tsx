import type { Metadata } from "next";
import { AlertRulesPanel } from "@/features/alerts/components/AlertRulesPanel";

interface AlertsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AlertsPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Alerts — ${id} | PulseStack`,
    description: `Manage alert rules and thresholds for project ${id}`,
  };
}

export default async function AlertsPage({ params }: AlertsPageProps) {
  const { id: projectId } = await params;
  return <AlertRulesPanel projectId={projectId} />;
}
