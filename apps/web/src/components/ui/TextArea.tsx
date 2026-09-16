"use client";

import React from "react";
import { TextField as HeroTextField, TextArea as HeroTextArea, TextAreaProps as HeroTextAreaProps } from "@heroui/react";

export interface TextAreaProps extends Omit<HeroTextAreaProps, "errorMessage" | "label"> {
  error?: string;
  label?: string;
  isInvalid?: boolean;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ error, label, isInvalid, className, style, ...props }, ref) => {
    return (
      <HeroTextField
        isInvalid={isInvalid || !!error}
        className="flex flex-col gap-1 w-full"
      >
        {label && (
          <label className="text-foreground font-semibold text-sm mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <HeroTextArea
            ref={ref}
            className={`border border-border hover:border-foreground focus:border-foreground bg-transparent rounded-xl px-3 py-2 w-full text-sm outline-none transition-all ${
              isInvalid || error ? "border-danger focus:border-danger" : ""
            } ${className || ""}`}
            style={style}
            aria-label={label || props.placeholder || "Text area"}
            {...props}
          />
        </div>
        {error && <p className="text-tiny text-danger font-medium mt-1">{error}</p>}
      </HeroTextField>
    );
  }
);

TextArea.displayName = "TextArea";
