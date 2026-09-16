"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/authStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ShieldAlert } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulated login API wrapper request response
    setTimeout(async () => {
      await login(
        {
          id: "1",
          name: "Administrator Account",
          email: email,
          role: "ADMIN",
          permissions: ["USER_CREATE", "USER_READ", "USER_UPDATE", "USER_DELETE"],
        },
        "mock-jwt-token-xyz"
      );
      document.cookie = "auth_token=mock-jwt-token-xyz; path=/";
      router.push("/dashboard");
    }, 600);
  };

  return (
    <div className="flex h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md border border-border bg-card rounded-2xl p-8 space-y-6 shadow-xl">
        <div className="flex flex-col items-center text-center gap-2">
          <ShieldAlert className="w-10 h-10 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">Access Control Portal</h2>
          <p className="text-sm text-muted-foreground">
            Sign in to access your enterprise starter workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="admin@example.com"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
          <Button type="submit" loading={isLoading} className="w-full mt-2">
            Authenticate
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
          Mock Auth Credentials: Use any credentials to sign in
        </div>
      </div>
    </div>
  );
}
