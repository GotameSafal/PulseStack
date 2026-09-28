"use client";

import React from "react";
import { Modal as HeroModal } from "@heroui/react";

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
  return (
    <HeroModal isOpen={isOpen} onOpenChange={onOpenChange}>
      <HeroModal.Backdrop>
        <HeroModal.Container size={size}>
          <HeroModal.Dialog>
            <HeroModal.CloseTrigger className="absolute right-4 top-4" />

            {title && (
              <HeroModal.Header className="mb-1 font-semibold border-b border-border pb-3">
                {title}
              </HeroModal.Header>
            )}

            <HeroModal.Body className="py-0">
              {children}
            </HeroModal.Body>

            {footer && (
              <HeroModal.Footer className="mt-4 border-t border-border pt-3">
                {footer}
              </HeroModal.Footer>
            )}
          </HeroModal.Dialog>
        </HeroModal.Container>
      </HeroModal.Backdrop>
    </HeroModal>
  );
}
