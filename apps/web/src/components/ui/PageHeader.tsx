import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle shown below the title */
  description?: string;
  /** Optional icon rendered inside a colored badge left of the title */
  icon?: React.ReactNode;
  /** Tailwind bg/text class for the icon badge, e.g. "bg-primary/10 text-primary" */
  iconColor?: string;
  /** Breadcrumb trail rendered above the title */
  breadcrumbs?: BreadcrumbItem[];
  /** Content rendered on the right (buttons, selectors, etc.) */
  actions?: React.ReactNode;
  /** Shows an inline spinner next to the title when true */
  isLoading?: boolean;
  className?: string;
}

/** Pulsing dot shown when isLoading=true */
function LoadingDot() {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse"
      aria-label="Refreshing"
    />
  );
}

/**
 * PageHeader
 *
 * A flexible, reusable header component for all pages and panels.
 * Supports: breadcrumbs, icon badge, title, description, loading state,
 * and an arbitrary right-side actions slot.
 */
export function PageHeader({
  title,
  description,
  icon,
  iconColor = "bg-primary/10 text-primary",
  breadcrumbs,
  actions,
  isLoading = false,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      {/* Left: breadcrumb + title row */}
      <div className="min-w-0">
        {/* Breadcrumb */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground"
          >
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && (
                  <ChevronRight
                    className="h-3 w-3 shrink-0"
                    aria-hidden="true"
                  />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    className={
                      idx === breadcrumbs.length - 1
                        ? "font-medium text-foreground"
                        : "max-w-[200px] truncate font-mono"
                    }
                  >
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Title row */}
        <div className="flex items-center gap-3">
          {icon && (
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                iconColor
              )}
              aria-hidden="true"
            >
              {icon}
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground leading-tight truncate">
                {title}
              </h1>
              {isLoading && <LoadingDot />}
            </div>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right: actions slot */}
      {actions && (
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
