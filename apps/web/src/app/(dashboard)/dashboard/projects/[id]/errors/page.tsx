import React from "react";
import type { Metadata } from "next";
import { ErrorInspector } from "@/components/errors/ErrorInspector";

interface ErrorsPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ErrorsPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Errors — ${id} | PulseStack`,
    description: "Inspect grouped exceptions, error frequency, and stack traces for this project.",
  };
}

export default async function ErrorsPage({ params }: ErrorsPageProps) {
  const { id: projectId } = await params;
  return <ErrorInspector projectId={projectId} />;
}
