import { useCallback, useMemo } from "react";
import {
  QueryClient,
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
  UseInfiniteQueryOptions,
  QueryKey,
} from "@tanstack/react-query";
import axiosInstance from "./axiosInstance";
import { AxiosError } from "axios";

// ===================================================
// TYPES
// ===================================================

interface ApiErrorShape {
  message?: string;
  error?: Array<{ message: string }> | string;
  errors?: Array<{ message: string }> | Record<string, string[]>;
}

interface CreateApiConfigOptions {
  /** Base resource path, e.g. "customers". Can also be a function if the
   *  endpoint needs to be computed (rare, but avoids ad-hoc overrides). */
  entityName: string;
  /** Human readable name used in toast messages, e.g. "Customer". */
  entityNameFormatted: string;
  /** Extra query keys to invalidate alongside this entity's own key. */
  additionalQueriesToInvalidate?: string[];
  /** Show a success toast on create/update/delete. Default true. */
  showSuccessToast?: boolean;
  /** How the delete endpoint expects the id. Default "path" -> DELETE /entity/:id */
  deleteMode?: "path" | "query";
}

interface MutationData<T> {
  entityData: Partial<T>;
  id: string | number;
}

type EntityId = string | number;

// ===================================================
// NOTIFICATIONS
// ===================================================

function notify(type: "success" | "error", message: string) {
  if (typeof window === "undefined") return;
  const event = new CustomEvent("fieldops-notification", {
    detail: { type, message },
  });
  window.dispatchEvent(event);
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Notification] ${type.toUpperCase()}: ${message}`);
  }
}

// ===================================================
// ERROR PARSING
// ===================================================

function extractErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<ApiErrorShape>;
  const data = axiosError?.response?.data;

  if (!data) return fallback;

  if (Array.isArray(data.error) && data.error[0]?.message) {
    return data.error[0].message;
  }
  if (typeof data.error === "string") {
    return data.error;
  }
  if (Array.isArray(data.errors) && data.errors[0]?.message) {
    return data.errors[0].message;
  }
  if (data.errors && typeof data.errors === "object" && !Array.isArray(data.errors)) {
    const firstKey = Object.keys(data.errors)[0];
    const firstVal = firstKey ? (data.errors as Record<string, string[]>)[firstKey] : undefined;
    if (firstVal?.[0]) return firstVal[0];
  }
  if (data.message) {
    return data.message;
  }

  return fallback;
}

// ===================================================
// CRUD CREATOR
// ===================================================

export function createApiConfig<T = unknown>(options: CreateApiConfigOptions) {
  // NOTE: config is re-destructured locally inside every hook below (not just
  // relied on via this outer closure). This is deliberate defensive coding:
  // it protects against Fast Refresh / HMR re-wiring a dynamically generated
  // hook without re-binding its enclosing scope, which is what produces
  // "ReferenceError: entityName is not defined" style bugs in dev.
  const config = {
    entityName: options.entityName,
    entityNameFormatted: options.entityNameFormatted,
    additionalQueriesToInvalidate: options.additionalQueriesToInvalidate ?? [],
    showSuccessToast: options.showSuccessToast !== false,
    deleteMode: options.deleteMode ?? "path",
  };

  const buildKey = (...parts: (string | number | Record<string, unknown> | undefined)[]): QueryKey =>
    [config.entityName, ...parts.filter((p) => p !== undefined)];

  const invalidateQueries = (queryClient: QueryClient, extra: string[]) => {
    console.log(`[crudCreater] Invalidate key:`, [config.entityName], "extra:", extra);
    queryClient.invalidateQueries({ queryKey: [config.entityName] });
    extra.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  };

  const handleError = (error: unknown, action: string, entityNameFormatted: string): Error => {
    console.error(`[crudCreater] handleError for ${action} ${entityNameFormatted}:`, error);
    const message = extractErrorMessage(error, `Error ${action} ${entityNameFormatted}`);
    notify("error", message);
    return new Error(message);
  };

  // ===================================================
  // GET ALL
  // ===================================================
  const useGetAll = (
    queryParams?: Record<string, unknown>,
    queryOptions?: Omit<UseQueryOptions<T[], Error>, "queryKey" | "queryFn">
  ) => {
    const { entityName } = config;
    const queryKey = useMemo(
      () => buildKey("all", queryParams),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [entityName, JSON.stringify(queryParams)]
    );

    const queryFn = useCallback(
      async ({ signal }: { signal?: AbortSignal }) => {
        const { data } = await axiosInstance.get(`/${entityName}`, {
          params: queryParams,
          signal,
        });
        return data?.data ?? data;
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [entityName, JSON.stringify(queryParams)]
    );

    return useQuery<T[], Error>({
      queryKey,
      queryFn,
      ...queryOptions,
    });
  };

  // ===================================================
  // GET BY ID
  // ===================================================
  const useGetById = (
    id: EntityId,
    queryParams?: Record<string, unknown>,
    queryOptions?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn" | "enabled">
  ) => {
    const { entityName } = config;
    const queryKey = useMemo(
      () => buildKey(id, queryParams),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [entityName, id, JSON.stringify(queryParams)]
    );

    const queryFn = useCallback(
      async ({ signal }: { signal?: AbortSignal }) => {
        const { data } = await axiosInstance.get(`/${entityName}/${id}`, {
          params: queryParams,
          signal,
        });
        return data?.data ?? data;
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [entityName, id, JSON.stringify(queryParams)]
    );

    return useQuery<T, Error>({
      queryKey,
      queryFn,
      enabled: !!id,
      ...queryOptions,
    });
  };

  // ===================================================
  // GET ALL (INFINITE / PAGINATED)
  // ===================================================
  const useGetInfinite = (
    queryParams?: Record<string, unknown>,
    queryOptions?: Omit<
      UseInfiniteQueryOptions<T[], Error, T[], QueryKey, number>,
      "queryKey" | "queryFn" | "getNextPageParam" | "initialPageParam"
    >
  ) => {
    const { entityName } = config;
    const queryKey = useMemo(
      () => buildKey("infinite", queryParams),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [entityName, JSON.stringify(queryParams)]
    );

    return useInfiniteQuery<T[], Error, T[], QueryKey, number>({
      queryKey,
      queryFn: async ({ pageParam, signal }) => {
        const { data } = await axiosInstance.get(`/${entityName}`, {
          params: { ...queryParams, page: pageParam },
          signal,
        });
        return data?.data ?? data;
      },
      initialPageParam: 1,
      getNextPageParam: (lastPage, allPages) =>
        lastPage && lastPage.length > 0 ? allPages.length + 1 : undefined,
      ...queryOptions,
    });
  };

  // ===================================================
  // CREATE
  // ===================================================
  const useCreate = (mutationOptions?: UseMutationOptions<T, Error, Partial<T>>) => {
    const { entityName, entityNameFormatted, showSuccessToast, additionalQueriesToInvalidate } = config;
    const queryClient = useQueryClient();

    return useMutation<T, Error, Partial<T>>({
      ...mutationOptions,
      mutationFn: async (entityData: Partial<T>) => {
        const { data } = await axiosInstance.post(`/${entityName}`, entityData);
        return data?.data ?? data;
      },
      onSuccess: (data, variables, context) => {
        invalidateQueries(queryClient, additionalQueriesToInvalidate);
        if (showSuccessToast) {
          notify("success", `${entityNameFormatted} Created Successfully`);
        }
        mutationOptions?.onSuccess?.(data, variables, context, undefined as any);
      },
      onError: (error, variables, context) => {
        const parsed = handleError(error, "Creating", entityNameFormatted);
        mutationOptions?.onError?.(parsed, variables, context, undefined as any);
      },
      retry: false,
    });
  };

  // ===================================================
  // UPDATE
  // ===================================================
  const useUpdate = (mutationOptions?: UseMutationOptions<T, Error, MutationData<T>>) => {
    const { entityName, entityNameFormatted, showSuccessToast, additionalQueriesToInvalidate } = config;
    const queryClient = useQueryClient();

    return useMutation<T, Error, MutationData<T>>({
      ...mutationOptions,
      mutationFn: async ({ entityData, id }: MutationData<T>) => {
        const { data } = await axiosInstance.patch(`/${entityName}/${id}`, entityData);
        return data?.data ?? data;
      },
      onSuccess: (data, variables, context) => {
        invalidateQueries(queryClient, additionalQueriesToInvalidate);
        // Also refresh the single-record cache for this id, not just lists.
        queryClient.invalidateQueries({ queryKey: [entityName, variables.id] });
        if (showSuccessToast) {
          notify("success", `${entityNameFormatted} Updated Successfully`);
        }
        mutationOptions?.onSuccess?.(data, variables, context, undefined as any);
      },
      onError: (error, variables, context) => {
        const parsed = handleError(error, "Updating", entityNameFormatted);
        mutationOptions?.onError?.(parsed, variables, context, undefined as any);
      },
      retry: false,
    });
  };

  // ===================================================
  // DELETE (single, by id)
  // ===================================================
  const useDelete = (mutationOptions?: UseMutationOptions<void, Error, EntityId>) => {
    const { entityName, entityNameFormatted, additionalQueriesToInvalidate, deleteMode } = config;
    const queryClient = useQueryClient();

    return useMutation<void, Error, EntityId>({
      ...mutationOptions,
      mutationFn: async (id: EntityId) => {
        if (deleteMode === "query") {
          await axiosInstance.delete(`/${entityName}`, { params: { id } });
        } else {
          await axiosInstance.delete(`/${entityName}/${id}`);
        }
      },
      onSuccess: (data, variables, context) => {
        invalidateQueries(queryClient, additionalQueriesToInvalidate);
        queryClient.removeQueries({ queryKey: [entityName, variables] });
        notify("success", `${entityNameFormatted} Deleted Successfully`);
        mutationOptions?.onSuccess?.(data, variables, context, undefined as any);
      },
      onError: (error, variables, context) => {
        const parsed = handleError(error, "Deleting", entityNameFormatted);
        mutationOptions?.onError?.(parsed, variables, context, undefined as any);
      },
    });
  };

  // ===================================================
  // DELETE (bulk, arbitrary query params)
  // ===================================================
  const useDeleteWithQuery = (
    mutationOptions?: UseMutationOptions<void, Error, Record<string, unknown> | undefined>
  ) => {
    const { entityName, entityNameFormatted, additionalQueriesToInvalidate } = config;
    const queryClient = useQueryClient();

    return useMutation<void, Error, Record<string, unknown> | undefined>({
      ...mutationOptions,
      mutationFn: async (queryParams: Record<string, unknown> | undefined) => {
        await axiosInstance.delete(`/${entityName}`, { params: queryParams });
      },
      onSuccess: (data, variables, context) => {
        invalidateQueries(queryClient, additionalQueriesToInvalidate);
        notify("success", `${entityNameFormatted} Deleted Successfully`);
        mutationOptions?.onSuccess?.(data, variables, context, undefined as any);
      },
      onError: (error, variables, context) => {
        const parsed = handleError(error, "Deleting", entityNameFormatted);
        mutationOptions?.onError?.(parsed, variables, context, undefined as any);
      },
    });
  };

  // ===================================================
  // BULK DELETE (array of ids, properly serialized)
  // ===================================================
  const useBulkDelete = (mutationOptions?: UseMutationOptions<void, Error, EntityId[]>) => {
    const { entityName, entityNameFormatted, additionalQueriesToInvalidate } = config;
    const queryClient = useQueryClient();

    return useMutation<void, Error, EntityId[]>({
      ...mutationOptions,
      mutationFn: async (ids: EntityId[]) => {
        await axiosInstance.delete(`/${entityName}`, {
          params: { ids },
          paramsSerializer: { indexes: null }, // -> ids=1&ids=2&ids=3
        });
      },
      onSuccess: (data, variables, context) => {
        invalidateQueries(queryClient, additionalQueriesToInvalidate);
        variables.forEach((id) => queryClient.removeQueries({ queryKey: [entityName, id] }));
        notify("success", `${entityNameFormatted} Deleted Successfully`);
        mutationOptions?.onSuccess?.(data, variables, context, undefined as any);
      },
      onError: (error, variables, context) => {
        const parsed = handleError(error, "Deleting", entityNameFormatted);
        mutationOptions?.onError?.(parsed, variables, context, undefined as any);
      },
    });
  };

  return {
    useGetAll,
    useGetById,
    useGetInfinite,
    useCreate,
    useUpdate,
    useDelete,
    useDeleteWithQuery,
    useBulkDelete,
  };
}