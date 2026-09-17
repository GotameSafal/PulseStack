import React from "react";
import type { Metadata } from "next";
import { RequestExplorer } from "@/components/requests/RequestExplorer";

interface RequestsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RequestsPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Requests — ${id} | PulseStack`,
    description: "Explore and filter raw HTTP request telemetry for this project.",
  };
}

export default async function RequestsPage({ params }: RequestsPageProps) {
  const { id: projectId } = await params;
  return <RequestExplorer projectId={projectId} />;
}
