import type { Metadata } from "next";
import { OverviewDashboard } from "@/components/analytics/OverviewDashboard";

interface OverviewPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: OverviewPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Overview — ${id} | PulseStack`,
    description: `Real-time analytics overview for project ${id}`,
  };
}

export default async function OverviewPage({ params }: OverviewPageProps) {
  const { id: projectId } = await params;

  return <OverviewDashboard projectId={projectId} />;
}
