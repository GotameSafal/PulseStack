"use client";

import React from "react";
import {
  Modal as HeroModal,
} from "@heroui/react";

export interface ModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg" | "full" | "cover";
}

export function Modal({
  isOpen,
  onOpenChange,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  // Use state props passed from parent to control HeroModal subcomponents
  return (
    <HeroModal isOpen={isOpen} onOpenChange={onOpenChange}>
      <HeroModal.Backdrop />
      <HeroModal.Container size={size}>
        <HeroModal.Dialog>
          {title && <HeroModal.Header className="flex flex-col gap-1 border-b border-border pb-3 mb-4">{title}</HeroModal.Header>}
          <HeroModal.Body className="py-2">{children}</HeroModal.Body>
          {footer && <HeroModal.Footer className="border-t border-border pt-3 mt-4">{footer}</HeroModal.Footer>}
          <HeroModal.CloseTrigger className="absolute top-4 right-4" />
        </HeroModal.Dialog>
      </HeroModal.Container>
    </HeroModal>
  );
}
