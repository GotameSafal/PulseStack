"use client";

import React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/Button";
import { FormFieldGrid } from "./FormFieldGrid";
import { FormFieldSchema } from "./FormFieldRenderer";

export type { FormFieldSchema };

export interface DynamicFormSchema {
  fields: FormFieldSchema[];
}

interface DynamicFormProps {
  schema: DynamicFormSchema;
  onSubmit: (data: Record<string, unknown>) => void | Promise<void>;
  submitLabel?: string;
  columns?: 1 | 2 | 3 | 4;
}

export function DynamicForm({
  schema,
  onSubmit,
  submitLabel = "Submit",
  columns = 1,
}: DynamicFormProps) {
  // 1. Build validation schema dynamically based on fields definition
  const shape: Record<string, z.ZodTypeAny> = {};
  const defaultValues: Record<string, unknown> = {};

  schema.fields.forEach((field) => {
    let fieldSchema: z.ZodTypeAny = z.any();

    if (field.validation) {
      fieldSchema = field.validation;
    } else {
      switch (field.type) {
        case "email":
          fieldSchema = z
            .string()
            .email(field.required ? "Invalid email" : undefined);
          if (!field.required)
            fieldSchema = fieldSchema.optional().or(z.literal(""));
          break;
        case "number":
          fieldSchema = z.number();
          if (!field.required) fieldSchema = fieldSchema.optional();
          break;
        case "checkbox":
        case "switch":
          fieldSchema = z.boolean();
          break;
        case "file":
        case "image":
          fieldSchema = z.array(z.string());
          if (!field.required) fieldSchema = fieldSchema.optional();
          break;
        default:
          fieldSchema = z.string();
          if (field.required) {
            fieldSchema = (fieldSchema as z.ZodString).min(
              1,
              `${field.label} is required`
            );
          } else {
            fieldSchema = fieldSchema.optional().or(z.literal(""));
          }
      }
    }

    shape[field.name] = fieldSchema;
    defaultValues[field.name] =
      field.defaultValue !== undefined
        ? field.defaultValue
        : field.type === "checkbox" || field.type === "switch"
        ? false
        : field.type === "file" || field.type === "image"
        ? []
        : "";
  });

  const validationSchema = z.object(shape);

  const methods = useForm({
    resolver: zodResolver(validationSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormFieldGrid fields={schema.fields} columns={columns} />
        <Button type="submit" loading={isSubmitting} className="w-full">
          {submitLabel}
        </Button>
      </form>
    </FormProvider>
  );
}
