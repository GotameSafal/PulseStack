"use client";

import React, { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CreateAlertRuleSchema,
  type AlertRuleResponse,
  type CreateAlertRule,
} from "@pulsestack/shared";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import {
  useCreateAlertRule,
  useUpdateAlertRule,
} from "@/features/alerts/hooks/useAlertMutations";

const METRIC_OPTIONS = [
  { value: "error_rate", label: "Error Rate (%)" },
  { value: "p95_latency_ms", label: "P95 Latency (ms)" },
  { value: "request_volume", label: "Request Volume (req)" },
];

const CONDITION_OPTIONS = [
  { value: "gt", label: "> Greater than" },
  { value: "lt", label: "< Less than" },
  { value: "gte", label: "≥ Greater than or equal" },
  { value: "lte", label: "≤ Less than or equal" },
];

const METRIC_UNIT: Record<string, string> = {
  error_rate: "%",
  p95_latency_ms: "ms",
  request_volume: "req",
};

interface AlertRuleFormModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  rule?: AlertRuleResponse | null;
}

export function AlertRuleFormModal({
  isOpen,
  onOpenChange,
  projectId,
  rule,
}: AlertRuleFormModalProps) {
  const isEdit = Boolean(rule);

  // Use untyped form to avoid Zod v4 / react-hook-form FieldValues conflict
  const methods = useForm({
    resolver: zodResolver(CreateAlertRuleSchema),
    defaultValues: {
      name: "",
      description: "",
      metric: "error_rate",
      condition: "gt",
      threshold: 5,
      windowMinutes: 5,
      cooldownMinutes: 15,
      enabled: true,
    },
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = methods;

  useEffect(() => {
    if (rule) {
      reset({
        name: rule.name,
        description: rule.description ?? "",
        metric: rule.metric,
        condition: rule.condition,
        threshold: rule.threshold,
        windowMinutes: rule.windowMinutes,
        cooldownMinutes: rule.cooldownMinutes,
        enabled: rule.enabled,
      });
    } else {
      reset({
        name: "",
        description: "",
        metric: "error_rate",
        condition: "gt",
        threshold: 5,
        windowMinutes: 5,
        cooldownMinutes: 15,
        enabled: true,
      });
    }
  }, [rule, reset]);

  const createMutation = useCreateAlertRule(projectId);
  const updateMutation = useUpdateAlertRule(projectId, rule?.id ?? "");

  const selectedMetric = watch("metric") as string;
  const thresholdUnit = METRIC_UNIT[selectedMetric] ?? "";

  const onSubmit = async (data: Record<string, unknown>) => {
    const body = data as unknown as CreateAlertRule;
    if (isEdit && rule) {
      await updateMutation.mutateAsync(body);
    } else {
      await createMutation.mutateAsync(body);
    }
    onOpenChange(false);
  };

  const mutationError = isEdit
    ? updateMutation.error?.message
    : createMutation.error?.message;

  // Cast errors to any to avoid FieldErrors<unknown> indexing issues
  const e = errors as Record<string, { message?: string } | undefined>;

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        <h2 className="text-base font-semibold text-foreground">
          {isEdit ? "Edit Alert Rule" : "Create Alert Rule"}
        </h2>
      }
      footer={
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onPress={() => onOpenChange(false)}
            isDisabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={isSubmitting}
            onPress={() => handleSubmit(onSubmit)()}
          >
            {isEdit ? "Save Changes" : "Create Rule"}
          </Button>
        </div>
      }
    >
      <form
        id="alert-rule-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        <Input
          label="Rule Name"
          placeholder="e.g. High error rate"
          {...register("name")}
          error={e.name?.message}
          isInvalid={Boolean(e.name)}
        />

        <TextArea
          label="Description (optional)"
          placeholder="What does this rule monitor?"
          rows={2}
          {...register("description")}
          error={e.description?.message}
          isInvalid={Boolean(e.description)}
        />

        <div className="grid grid-cols-2 gap-4">
          <Controller
            name="metric"
            control={control as any}
            render={({ field }) => (
              <Select
                label="Metric"
                options={METRIC_OPTIONS}
                selectedKey={field.value as string}
                onSelectionChange={(key) => field.onChange(key as string)}
                error={e.metric?.message}
                isInvalid={Boolean(e.metric)}
              />
            )}
          />

          <Controller
            name="condition"
            control={control as any}
            render={({ field }) => (
              <Select
                label="Operator"
                options={CONDITION_OPTIONS}
                selectedKey={field.value as string}
                onSelectionChange={(key) => field.onChange(key as string)}
                error={e.condition?.message}
                isInvalid={Boolean(e.condition)}
              />
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label={`Threshold${thresholdUnit ? ` (${thresholdUnit})` : ""}`}
            type="number"
            step="any"
            {...register("threshold", { valueAsNumber: true })}
            error={e.threshold?.message}
            isInvalid={Boolean(e.threshold)}
          />

          <Input
            label="Window (min)"
            type="number"
            min={1}
            max={1440}
            {...register("windowMinutes", { valueAsNumber: true })}
            error={e.windowMinutes?.message}
            isInvalid={Boolean(e.windowMinutes)}
          />

          <Input
            label="Cooldown (min)"
            type="number"
            min={1}
            max={1440}
            {...register("cooldownMinutes", { valueAsNumber: true })}
            error={e.cooldownMinutes?.message}
            isInvalid={Boolean(e.cooldownMinutes)}
          />
        </div>

        {/* Switch onChange receives a boolean (react-aria SwitchField API) */}
        <Controller
          name="enabled"
          control={control as any}
          render={({ field }) => (
            <Switch
              isSelected={field.value as boolean}
              onChange={field.onChange}
              label="Enable this rule"
            />
          )}
        />

        {mutationError && (
          <p className="text-sm text-danger font-medium" role="alert">
            {mutationError}
          </p>
        )}
      </form>
    </Modal>
  );
}
