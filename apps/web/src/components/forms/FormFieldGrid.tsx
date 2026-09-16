"use client";

import React from "react";
import { FormFieldRenderer, FormFieldSchema } from "./FormFieldRenderer";
import { Control } from "react-hook-form";

export interface FormFieldGridProps {
  fields: FormFieldSchema[];
  columns?: 1 | 2 | 3 | 4;
  gap?: "sm" | "md" | "lg";
  className?: string;
  control?: Control<any>;
}

export function FormFieldGrid({
  fields,
  columns = 2,
  gap = "md",
  className = "",
  control,
}: FormFieldGridProps) {
  const getGridColsClass = () => {
    switch (columns) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-1 sm:grid-cols-2";
      case 3:
        return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
      case 4:
        return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
      default:
        return "grid-cols-1 sm:grid-cols-2";
    }
  };

  const getGapClass = () => {
    switch (gap) {
      case "sm":
        return "gap-3";
      case "lg":
        return "gap-6";
      default:
        return "gap-4";
    }
  };

  return (
    <div className={`grid ${getGridColsClass()} ${getGapClass()} ${className}`}>
      {fields.map((field) => (
        <FormFieldRenderer key={field.name} field={field} control={control} />
      ))}
    </div>
  );
}
