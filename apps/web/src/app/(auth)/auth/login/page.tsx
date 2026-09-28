"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { useAuthStore } from "@/lib/auth/authStore";
import { DynamicForm, DynamicFormSchema } from "@/components/forms/DynamicForm";
import { ShieldAlert } from "lucide-react";
import axiosInstance from "@/api/setup/axiosInstance";
import { setAuthCookieAction } from "@/actions/authCookies";

const loginSchema: DynamicFormSchema = {
  fields: [
    {
      name: "email",
      label: "Email Address",
      type: "email",
      placeholder: "admin@example.com",
      required: true,
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      placeholder: "••••••••",
      required: true,
    },
  ],
};

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  const handleLoginSubmit = async (formData: Record<string, unknown>) => {
    const { email, password } = formData as { email: string; password: string };

    try {
      const { data } = await axiosInstance.post<{
        id: string;
        name: string;
        email: string;
        token: string;
        activeOrganizationId?: string;
      }>("/auth/login", { email, password });

      // Securely set HTTP cookie via Next.js Server Action
      await setAuthCookieAction(data.token);

      await login(
        {
          id: data.id,
          name: data.name,
          email: data.email,
          role: "ADMIN",
          permissions: ["USER_CREATE", "USER_READ", "USER_UPDATE", "USER_DELETE"],
          organizationId: data.activeOrganizationId,
        },
        data.token
      );

      toast.success(`Welcome back, ${data.name}!`);
      router.push("/dashboard");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        "Login failed. Please verify your credentials.";
      toast.error(msg);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md border border-border bg-card rounded-2xl p-8 space-y-6 shadow-xl">
        <div className="flex flex-col items-center text-center gap-2">
          <ShieldAlert className="w-10 h-10 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Access Control Portal</h2>
          <p className="text-sm text-muted-foreground">
            Sign in to access your enterprise workspace.
          </p>
        </div>

        <DynamicForm
          schema={loginSchema}
          onSubmit={handleLoginSubmit}
          submitLabel="Authenticate"
        />

        <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border flex items-center justify-center gap-1.5">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-semibold text-primary hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
