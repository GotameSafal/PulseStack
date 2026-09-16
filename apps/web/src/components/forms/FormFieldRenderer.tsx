"use client";

import React from "react";
import { Controller, useFormContext, Control } from "react-hook-form";

import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Switch } from "@/components/ui/Switch";
import { RadioGroup } from "@/components/ui/Radio";
import { UploadZone } from "@/components/ui/UploadZone";

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldSchema {
  name: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "password"
    | "email"
    | "select"
    | "checkbox"
    | "switch"
    | "radio"
    | "file"
    | "image";
  placeholder?: string;
  required?: boolean;
  options?: FormFieldOption[];
  defaultValue?: unknown;
  validation?: any;
  colSpan?: 1 | 2 | 3 | 4 | 6 | 12 | "full";
  className?: string;
}

interface FormFieldRendererProps {
  field: FormFieldSchema;
  control?: Control<any>;
}

export function FormFieldRenderer({
  field,
  control: explicitControl,
}: FormFieldRendererProps) {
  const formContext = useFormContext();
  const control = explicitControl || formContext?.control;

  if (!control) {
    throw new Error(
      "FormFieldRenderer must be wrapped inside a FormProvider or passed an explicit control prop."
    );
  }

  const getColSpanClass = () => {
    switch (field.colSpan) {
      case 1:
        return "col-span-1";
      case 2:
        return "col-span-1 sm:col-span-2";
      case 3:
        return "col-span-1 sm:col-span-3";
      case 4:
        return "col-span-1 sm:col-span-4";
      case 6:
        return "col-span-1 sm:col-span-6";
      case 12:
      case "full":
        return "col-span-full";
      default:
        return "col-span-1";
    }
  };

  return (
    <div className={`${getColSpanClass()} ${field.className || ""}`}>
      <Controller
        name={field.name}
        control={control}
        render={({ field: controllerField, fieldState: { error } }) => {
          const errorMsg = error?.message;

          switch (field.type) {
            case "textarea":
              return (
                <TextArea
                  {...controllerField}
                  value={(controllerField.value as string) || ""}
                  label={field.label}
                  placeholder={field.placeholder}
                  error={errorMsg}
                />
              );
            case "select":
              return (
                <Select
                  {...controllerField}
                  value={(controllerField.value as string) || ""}
                  label={field.label}
                  placeholder={field.placeholder}
                  options={field.options || []}
                  error={errorMsg}
                  onChange={(val) => controllerField.onChange(val)}
                />
              );
            case "checkbox":
              return (
                <Checkbox
                  {...controllerField}
                  value={
                    controllerField.value !== undefined
                      ? String(controllerField.value)
                      : ""
                  }
                  label={field.label}
                  isSelected={!!controllerField.value}
                  onChange={controllerField.onChange}
                  error={errorMsg}
                />
              );
            case "switch":
              return (
                <Switch
                  {...controllerField}
                  value={
                    controllerField.value !== undefined
                      ? String(controllerField.value)
                      : ""
                  }
                  label={field.label}
                  isSelected={!!controllerField.value}
                  onChange={controllerField.onChange}
                  error={errorMsg}
                />
              );
            case "radio":
              return (
                <RadioGroup
                  {...controllerField}
                  value={(controllerField.value as string) || ""}
                  options={field.options || []}
                  error={errorMsg}
                  onChange={(val: string) => controllerField.onChange(val)}
                />
              );
            case "file":
            case "image":
              return (
                <div className="space-y-2">
                  <label className="text-foreground font-semibold text-sm">
                    {field.label}
                  </label>
                  <UploadZone
                    accept={field.type === "image" ? "image/*" : "*"}
                    onUploadComplete={(urls) => controllerField.onChange(urls)}
                  />
                  {errorMsg && (
                    <p className="text-tiny text-danger font-medium mt-1">
                      {errorMsg}
                    </p>
                  )}
                </div>
              );
            case "number":
              return (
                <Input
                  {...controllerField}
                  value={
                    controllerField.value !== undefined
                      ? String(controllerField.value)
                      : ""
                  }
                  type="number"
                  label={field.label}
                  placeholder={field.placeholder}
                  error={errorMsg}
                  onChange={(e) =>
                    controllerField.onChange(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                />
              );
            default:
              return (
                <Input
                  {...controllerField}
                  value={(controllerField.value as string) || ""}
                  type={field.type}
                  label={field.label}
                  placeholder={field.placeholder}
                  error={errorMsg}
                />
              );
          }
        }}
      />
    </div>
  );
}
