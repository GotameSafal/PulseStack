"use client";

import React from "react";
import { Select as HeroSelect, SelectProps as HeroSelectProps, ListBox, ListBoxItem } from "@heroui/react";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends Omit<HeroSelectProps<Record<string, unknown>, "single">, "children" | "errorMessage" | "label"> {
  options: SelectOption[];
  error?: string;
  label?: string;
  isInvalid?: boolean;
}

export const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ options, error, label, isInvalid, placeholder, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <span className="text-foreground font-semibold text-sm mb-1 block">
            {label}
          </span>
        )}
        <HeroSelect
          ref={ref}
          placeholder={placeholder}
          isInvalid={isInvalid || !!error}
          className={className}
          aria-label={label || placeholder || "Select option"}
          {...props}
        >
          <HeroSelect.Trigger className="flex justify-between items-center border border-border hover:border-foreground focus:border-foreground bg-transparent rounded-xl px-3 py-2 w-full text-sm outline-none transition-all">
            <HeroSelect.Value />
            <HeroSelect.Indicator />
          </HeroSelect.Trigger>
          <HeroSelect.Popover className="bg-background border border-border">
            <ListBox className="p-1">
              {options.map((option) => (
                <ListBoxItem key={option.value} id={option.value} textValue={option.label}>
                  {option.label}
                </ListBoxItem>
              ))}
            </ListBox>
          </HeroSelect.Popover>
        </HeroSelect>
        {error && <p className="text-tiny text-danger font-medium mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
