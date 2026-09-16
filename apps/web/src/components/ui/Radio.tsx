"use client";

import React from "react";
import { RadioGroup as HeroRadioGroup, Radio as HeroRadio, RadioGroupProps as HeroRadioGroupProps } from "@heroui/react";

export interface RadioOption {
  label: string;
  value: string;
}

export interface RadioProps extends Omit<HeroRadioGroupProps, "children" | "errorMessage" | "label"> {
  options: RadioOption[];
  error?: string;
  label?: string;
  isInvalid?: boolean;
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioProps>(
  ({ options, error, label, isInvalid, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full" ref={ref}>
        {label && (
          <span className="text-foreground font-semibold text-sm mb-1 block">
            {label}
          </span>
        )}
        <HeroRadioGroup
          isInvalid={isInvalid || !!error}
          className={`flex gap-4 ${className || ""}`}
          {...props}
        >
          {options.map((option) => (
            <HeroRadio key={option.value} value={option.value}>
              {option.label}
            </HeroRadio>
          ))}
        </HeroRadioGroup>
        {error && <p className="text-tiny text-danger font-medium mt-1">{error}</p>}
      </div>
    );
  }
);

RadioGroup.displayName = "RadioGroup";
