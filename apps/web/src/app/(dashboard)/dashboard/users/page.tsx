"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { UserType } from "@/features/users/schemas";
import { userService } from "@/features/users/services";
import { MasterTable } from "@/components/table/MasterTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DynamicForm, DynamicFormSchema } from "@/components/forms/DynamicForm";
import { Plus, Trash, Trash2 } from "lucide-react";

function UsersContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Extract query parameters for Server-Side sync
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const search = searchParams.get("search") || "";
  const sortField = searchParams.get("sortField") || "";
  const sortDir = searchParams.get("sortDir") || "";

  // React Query fetch config
  const { data, isLoading } = useQuery({
    queryKey: ["users", { page, limit, search, sortField, sortDir }],
    queryFn: () => userService.getAll({ page, limit, search, sortField, sortDir }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (newData: Omit<UserType, "id">) => userService.create(newData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsCreateOpen(false);
    },
  });

  const columns: ColumnDef<any, UserType>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(e) => table.toggleAllPageRowsSelected(!!e.target.checked)}
          className="rounded border-border"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={(e) => row.toggleSelected(!!e.target.checked)}
          className="rounded border-border"
        />
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "email",
      header: "Email Address",
    },
    {
      accessorKey: "role",
      header: "System Role",
      cell: ({ row }) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary/80 text-foreground">
          {row.original.role}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.original.status === "ACTIVE";
        return (
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isActive
                ? "bg-success/15 text-success"
                : "bg-danger/15 text-danger"
            }`}
          >
            {row.original.status}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteMutation.mutate(row.original.id)}
          className="min-w-0 p-1.5"
        >
          <Trash className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  const formSchema: DynamicFormSchema = {
    fields: [
      {
        name: "name",
        type: "text",
        label: "Full Name",
        placeholder: "Enter full name",
        required: true,
      },
      {
        name: "email",
        type: "email",
        label: "Email Address",
        placeholder: "Enter email address",
        required: true,
      },
      {
        name: "role",
        type: "select",
        label: "System Role",
        required: true,
        options: [
          { label: "Administrator", value: "ADMIN" },
          { label: "Manager", value: "MANAGER" },
          { label: "User", value: "USER" },
        ],
      },
      {
        name: "status",
        type: "radio",
        label: "Account Status",
        required: true,
        defaultValue: "ACTIVE",
        options: [
          { label: "Active", value: "ACTIVE" },
          { label: "Inactive", value: "INACTIVE" },
        ],
      },
    ],
  };

  const handleCreateSubmit = (formData: Record<string, unknown>) => {
    createMutation.mutate(formData as Omit<UserType, "id">);
  };

  const handleBulkDelete = (selected: UserType[]) => {
    selected.forEach((item) => deleteMutation.mutate(item.id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">System Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage security roles, active states, and directory accounts.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="flex gap-2">
          <Plus className="w-4 h-4" /> Add User
        </Button>
      </div>

      <MasterTable
        columns={columns}
        queryKey="users"
        data={data?.data || []}
        isLoading={isLoading}
        totalCount={data?.totalCount || 0}
        bulkActions={(selected) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkDelete(selected)}
            className="flex gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete Selected
          </Button>
        )}
      />

      <Modal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        title="Create New User Account"
      >
        <DynamicForm
          schema={formSchema}
          onSubmit={handleCreateSubmit}
          submitLabel="Create User"
        />
      </Modal>
    </div>
  );
}

export default function UsersPage() {
  return (
    <React.Suspense fallback={<div className="p-6">Loading Users...</div>}>
      <UsersContent />
    </React.Suspense>
  );
}
