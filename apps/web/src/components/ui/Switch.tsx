"use client";

import React from "react";
import { Switch as HeroSwitch, SwitchProps as HeroSwitchProps } from "@heroui/react";

export interface SwitchProps extends Omit<HeroSwitchProps, "children"> {
  label?: React.ReactNode;
  error?: string;
}

export const Switch = React.forwardRef<HTMLDivElement, SwitchProps>(
  ({ label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        <HeroSwitch ref={ref} {...props}>
          {label}
        </HeroSwitch>
        {error && <p className="text-tiny text-danger font-medium">{error}</p>}
      </div>
    );
  }
);

Switch.displayName = "Switch";
