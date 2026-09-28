"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { useAuthStore } from "@/lib/auth/authStore";
import { DynamicForm, DynamicFormSchema } from "@/components/forms/DynamicForm";
import { ShieldCheck, ArrowRight } from "lucide-react";
import axiosInstance from "@/api/setup/axiosInstance";
import { setAuthCookieAction } from "@/actions/authCookies";

const registerSchema: DynamicFormSchema = {
  fields: [
    {
      name: "name",
      label: "Full Name",
      type: "text",
      placeholder: "Alex Mercer",
      required: true,
    },
    {
      name: "email",
      label: "Work Email",
      type: "email",
      placeholder: "alex@company.com",
      required: true,
    },
    {
      name: "organizationName",
      label: "Organization / Workspace Name",
      type: "text",
      placeholder: "Acme Corp",
      required: true,
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      placeholder: "Minimum 8 characters",
      required: true,
    },
  ],
};

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();

  const handleRegisterSubmit = async (formData: Record<string, unknown>) => {
    const { name, email, password, organizationName } = formData as {
      name: string;
      email: string;
      password: string;
      organizationName: string;
    };

    try {
      const { data } = await axiosInstance.post<{
        id: string;
        name: string;
        email: string;
        token: string;
        activeOrganizationId?: string;
      }>("/auth/register", {
        name,
        email,
        password,
        organizationName,
      });

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

      toast.success(`Welcome to PulseStack, ${data.name}!`);
      router.push("/dashboard");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        "Registration failed. Please check your inputs.";
      toast.error(msg);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md border border-border bg-card rounded-3xl p-8 space-y-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Create your Account</h2>
          <p className="text-xs text-muted-foreground">
            Get started with real-time enterprise observability in minutes.
          </p>
        </div>

        <DynamicForm
          schema={registerSchema}
          onSubmit={handleRegisterSubmit}
          submitLabel="Create Account & Get Started"
        />

        <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border flex items-center justify-center gap-1.5">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-semibold text-primary hover:underline inline-flex items-center gap-0.5">
            Sign In <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

