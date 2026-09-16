"use client";

import React from "react";
import { Button as HeroButton, ButtonProps as HeroButtonProps } from "@heroui/react";

export interface ButtonProps extends HeroButtonProps {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, loading = false, ...props }, ref) => {
    return (
      <HeroButton
        ref={ref}
        isPending={loading}
        {...props}
      >
        {children}
      </HeroButton>
    );
  }
);

Button.displayName = "Button";
