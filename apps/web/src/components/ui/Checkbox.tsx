"use client";

import React from "react";
import { Checkbox as HeroCheckbox, CheckboxProps as HeroCheckboxProps } from "@heroui/react";

export interface CheckboxProps extends Omit<HeroCheckboxProps, "children"> {
  label?: React.ReactNode;
  error?: string;
}

export const Checkbox = React.forwardRef<HTMLDivElement, CheckboxProps>(
  ({ label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <HeroCheckbox ref={ref} {...props}>
          {label}
        </HeroCheckbox>
        {error && <p className="text-tiny text-danger font-medium">{error}</p>}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";
