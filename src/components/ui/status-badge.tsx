import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Info, 
  Clock,
  AlertTriangle,
  type LucideIcon 
} from "lucide-react";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        success: "bg-[hsl(145,60%,96%)] text-[hsl(145,55%,32%)] border border-[hsl(145,50%,85%)]",
        warning: "bg-[hsl(32,100%,96%)] text-[hsl(32,80%,35%)] border border-[hsl(32,80%,82%)]",
        error: "bg-[hsl(0,85%,97%)] text-[hsl(0,72%,45%)] border border-[hsl(0,75%,89%)]",
        info: "bg-[hsl(200,85%,97%)] text-[hsl(200,80%,40%)] border border-[hsl(200,80%,85%)]",
        default: "bg-secondary text-secondary-foreground border border-border",
        primary: "bg-[hsl(217,100%,97%)] text-[hsl(217,80%,35%)] border border-[hsl(217,80%,90%)]",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        default: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const iconMap: Record<string, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
  pending: Clock,
  default: Info,
  primary: Info,
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  showIcon?: boolean;
  icon?: LucideIcon;
  pulse?: boolean;
}

function StatusBadge({ 
  className, 
  variant, 
  size,
  showIcon = true,
  icon: CustomIcon,
  pulse = false,
  children,
  ...props 
}: StatusBadgeProps) {
  const Icon = CustomIcon || iconMap[variant || "default"];
  
  return (
    <span 
      className={cn(
        statusBadgeVariants({ variant, size }), 
        pulse && "animate-pulse-soft",
        className
      )} 
      {...props}
    >
      {showIcon && Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
}

// Componentes específicos para casos de uso comunes
export function SuccessBadge(props: Omit<StatusBadgeProps, 'variant'>) {
  return <StatusBadge variant="success" {...props} />;
}

export function WarningBadge(props: Omit<StatusBadgeProps, 'variant'>) {
  return <StatusBadge variant="warning" {...props} />;
}

export function ErrorBadge(props: Omit<StatusBadgeProps, 'variant'>) {
  return <StatusBadge variant="error" {...props} />;
}

export function InfoBadge(props: Omit<StatusBadgeProps, 'variant'>) {
  return <StatusBadge variant="info" {...props} />;
}

export { StatusBadge, statusBadgeVariants };
