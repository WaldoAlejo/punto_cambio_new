import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { ArrowLeft, type LucideIcon } from "lucide-react";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    variant?: "default" | "outline" | "secondary" | "ghost";
  };
  backAction?: {
    onClick: () => void;
    label?: string;
  };
  breadcrumbs?: Array<{
    label: string;
    onClick?: () => void;
  }>;
}

function PageHeader({
  className,
  title,
  description,
  icon: Icon,
  action,
  backAction,
  breadcrumbs,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 space-y-4", className)} {...props}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {index > 0 && <span className="text-border">/</span>}
              {crumb.onClick ? (
                <button
                  onClick={crumb.onClick}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className={index === breadcrumbs.length - 1 ? "text-foreground font-medium" : ""}>
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          {/* Back button */}
          {backAction && (
            <Button
              variant="ghost"
              size="icon"
              onClick={backAction.onClick}
              className="mt-0.5 shrink-0"
              title={backAction.label || "Volver"}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          
          {/* Title section */}
          <div>
            <div className="flex items-center gap-2">
              {Icon && <Icon className="w-6 h-6 text-primary" />}
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {title}
              </h1>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Action button */}
        {action && (
          <Button
            onClick={action.onClick}
            variant={action.variant || "default"}
            className="shrink-0"
          >
            {action.icon && <action.icon className="w-4 h-4 mr-2" />}
            {action.label}
          </Button>
        )}
      </div>

      {children}
    </div>
  );
}

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  padding?: "none" | "sm" | "default" | "lg";
}

function PageContainer({
  className,
  maxWidth = "xl",
  padding = "default",
  children,
  ...props
}: PageContainerProps) {
  const maxWidthClass = {
    sm: "max-w-3xl",
    md: "max-w-4xl",
    lg: "max-w-5xl",
    xl: "max-w-7xl",
    full: "max-w-none",
  };

  const paddingClass = {
    none: "",
    sm: "p-4",
    default: "p-4 sm:p-6",
    lg: "p-6 sm:p-8",
  };

  return (
    <div 
      className={cn(
        "w-full mx-auto",
        maxWidthClass[maxWidth],
        paddingClass[padding],
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
}

export { PageHeader, PageContainer };
