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
  triggerClassName?: string;
}

export const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ options, error, label, isInvalid, placeholder, className, triggerClassName, ...props }, ref) => {
    return (
      <div className={`flex flex-col gap-1 ${className || "w-full"}`}>
        {label && (
          <span className="text-foreground font-semibold text-sm mb-1 block">
            {label}
          </span>
        )}
        <HeroSelect
          ref={ref}
          placeholder={placeholder}
          isInvalid={isInvalid || !!error}
          aria-label={label || placeholder || "Select option"}
          {...props}
        >
          <HeroSelect.Trigger
            className={`flex justify-between items-center border border-border hover:border-foreground focus:border-foreground bg-transparent rounded-lg px-2.5 py-1.5 text-xs outline-hidden transition-all gap-2 ${
              triggerClassName || "w-full"
            }`}
          >
            <HeroSelect.Value />
            <HeroSelect.Indicator />
          </HeroSelect.Trigger>
          <HeroSelect.Popover className="bg-popover text-popover-foreground border border-border rounded-lg shadow-md z-50">
            <ListBox className="p-1 text-xs">
              {options.map((option) => (
                <ListBoxItem
                  key={option.value}
                  id={option.value}
                  textValue={option.label}
                  className="rounded-md px-2 py-1.5 hover:bg-secondary cursor-pointer transition-colors outline-hidden"
                >
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
