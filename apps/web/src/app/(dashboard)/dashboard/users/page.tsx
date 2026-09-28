"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Trash2, Users } from "lucide-react";
import { usersApi, type ApiUser } from "@/features/users/services";
import { MasterTable } from "@/components/table/MasterTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";

// ────────────────────────────────────────────────────────────────────────────
// Create user modal
// ────────────────────────────────────────────────────────────────────────────

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const createUser = usersApi.useCreate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createUser.mutateAsync({ name, email, password } as Partial<ApiUser>);
    onClose();
  }

  return (
    <Modal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Create New User Account"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onPress={onClose} isDisabled={createUser.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={createUser.isPending}
            onPress={() =>
              document
                .getElementById("create-user-form")
                ?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }))
            }
          >
            Create User
          </Button>
        </div>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          required
        />
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane@example.com"
          required
        />
        <Input
          label="Initial Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 6 characters"
          required
        />
        {createUser.error && (
          <p role="alert" className="text-sm text-danger">
            {createUser.error.message}
          </p>
        )}
      </form>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page content
// ────────────────────────────────────────────────────────────────────────────

/** Auto-refresh every 30 s */
const REFRESH_INTERVAL_MS = 30_000;

function UsersContent() {
  const searchParams = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const search = searchParams.get("search") || undefined;
  const sortField = searchParams.get("sortField") || undefined;
  const sortDir = searchParams.get("sortDir") || undefined;

  const { data, isLoading } = usersApi.useGetAll(
    { page, limit, search, sortField, sortDir },
    { refetchInterval: REFRESH_INTERVAL_MS }
  );

  const deleteUser = usersApi.useDelete();

  // crudCreator returns data.data when the API wraps in { data, totalCount }
  // but useGetAll does `data?.data ?? data` so we may get the wrapper or the array.
  const rows = Array.isArray(data) ? data : (data as any)?.data ?? [];
  const totalCount = Array.isArray(data) ? rows.length : (data as any)?.totalCount ?? 0;

  const columns: ColumnDef<any, ApiUser, any>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="font-medium text-foreground">{row.original.name}</span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email Address",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Joined",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Users"
        description="Manage registered user accounts."
        icon={<Users className="h-5 w-5" />}
        iconColor="bg-primary/10 text-primary"
        actions={
          <Button
            id="create-user-btn"
            variant="primary"
            onPress={() => setIsCreateOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add User
          </Button>
        }
      />

      <MasterTable<ApiUser>
        columns={columns}
        queryKey="users"
        data={rows}
        isLoading={isLoading}
        totalCount={totalCount}
        bulkActions={(selected) => (
          <Button
            variant="outline"
            size="sm"
            onPress={() => selected.forEach((u) => deleteUser.mutate(u.id))}
            className="flex gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete Selected
          </Button>
        )}
      />

      {isCreateOpen && <CreateUserModal onClose={() => setIsCreateOpen(false)} />}
    </div>
  );
}

export default function UsersPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-muted-foreground text-sm">Loading...</div>}>
      <UsersContent />
    </React.Suspense>
  );
}
