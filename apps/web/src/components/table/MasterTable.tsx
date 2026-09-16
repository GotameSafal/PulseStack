"use client";

import React, { useMemo } from "react";
import {
  useTable,
  createCoreRowModel,
  createSortedRowModel,
  createPaginatedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  RowData,
  stockFeatures,
} from "@tanstack/react-table";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Download,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";

interface MasterTableProps<TData extends RowData> {
  columns: ColumnDef<any, TData, any>[];
  queryKey: string;
  data: TData[];
  isLoading?: boolean;
  totalCount?: number;
  bulkActions?: (selectedRows: TData[]) => React.ReactNode;
}

export function MasterTable<TData extends RowData>({
  columns,
  data = [],
  isLoading = false,
  totalCount = 0,
  bulkActions,
}: MasterTableProps<TData>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse parameters
  const page = parseInt(searchParams.get("page") || "1", 10) - 1;
  const pageSize = parseInt(searchParams.get("limit") || "10", 10);
  const search = searchParams.get("search") || "";
  const sortField = searchParams.get("sortField") || "";
  const sortDir = searchParams.get("sortDir") || "";

  // Dynamic sorting state setup
  const sortingState = useMemo<SortingState>(() => {
    if (!sortField) return [];
    return [{ id: sortField, desc: sortDir === "desc" }];
  }, [sortField, sortDir]);

  // Handle updates to URLs
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null) {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });
    router.push(`${pathname}?${params.toString()}`);
  };

  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState({});

  const table = useTable({
    features: stockFeatures,
    data,
    columns: columns as any,
    pageCount: Math.ceil(totalCount / pageSize),
    state: {
      sorting: sortingState,
      pagination: { pageIndex: page, pageSize },
      rowSelection,
      columnVisibility,
    },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: createCoreRowModel(),
    getSortedRowModel: createSortedRowModel(),
    getPaginationRowModel: createPaginatedRowModel(),
  } as any);

  const selectedRows = table.getSelectedRowModel().flatRows.map((r) => r.original as TData);

  const handleSearchChange = (val: string) => {
    updateUrlParams({ search: val || null, page: "1" });
  };

  const handleSort = (columnId: string) => {
    const isCurrent = sortField === columnId;
    let nextDir: string | null = "asc";
    if (isCurrent) {
      if (sortDir === "asc") nextDir = "desc";
      else nextDir = null;
    }
    updateUrlParams({
      sortField: nextDir ? columnId : null,
      sortDir: nextDir,
      page: "1",
    });
  };

  const exportCSV = () => {
    if (!data.length) return;
    const headers = columns
      .map((col) => (col as { accessorKey?: string }).accessorKey || col.id)
      .filter(Boolean) as string[];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [
        headers.join(","),
        ...data.map((row) =>
          headers.map((fieldName) => JSON.stringify((row as Record<string, unknown>)[fieldName] || "")).join(",")
        ),
      ].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `table-export-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
        <div className="relative w-full sm:max-w-xs">
          <Input
            placeholder="Search record..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" onClick={exportCSV} className="flex gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          
          {/* Column Toggle */}
          <div className="relative">
            <Button variant="outline" className="flex gap-2">
              <Settings2 className="w-4 h-4" /> Columns
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedRows.length > 0 && bulkActions && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex justify-between items-center animate-fade-in">
          <span className="text-sm font-medium">
            {selectedRows.length} rows selected
          </span>
          <div className="flex gap-2">{bulkActions(selectedRows)}</div>
        </div>
      )}

      {/* Main Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <Table aria-label="Master Data Table">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) =>
              headerGroup.headers.map((header) => (
                <TableColumn
                  key={header.id}
                  onClick={() =>
                    header.column.getCanSort() && handleSort(header.id)
                  }
                  className={`px-4 py-3 font-semibold text-muted-foreground select-none ${
                    header.column.getCanSort()
                      ? "cursor-pointer hover:text-foreground"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {header.column.getCanSort() && (
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    )}
                  </div>
                </TableColumn>
              ))
            )}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize }).map((_, idx) => (
                <TableRow key={idx}>
                  {columns.map((_, cIdx) => (
                    <TableCell key={cIdx} className="px-4 py-4">
                      <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="border-b border-border hover:bg-secondary/20 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Showing {page * pageSize + 1} to{" "}
          {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} records
        </span>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateUrlParams({ page: String(Math.max(1, page)) })
            }
            isDisabled={page === 0}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              updateUrlParams({
                page: String(
                  Math.min(Math.ceil(totalCount / pageSize), page + 2)
                ),
              })
            }
            isDisabled={(page + 1) * pageSize >= totalCount}
          >
            Next <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
