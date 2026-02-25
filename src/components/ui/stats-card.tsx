import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react";

const statsCardVariants = cva(
  "relative overflow-hidden rounded-xl border bg-white p-6 transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border-border/50 shadow-sm hover:shadow-md",
        primary: "border-[hsl(217,80%,90%)] bg-[hsl(217,100%,97%)]",
        success: "border-[hsl(145,50%,85%)] bg-[hsl(145,60%,96%)]",
        warning: "border-[hsl(32,80%,82%)] bg-[hsl(32,100%,96%)]",
        error: "border-[hsl(0,75%,89%)] bg-[hsl(0,85%,97%)]",
        outline: "border-border bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface StatsCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statsCardVariants> {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label?: string;
    direction?: "up" | "down" | "neutral";
  };
  loading?: boolean;
}

function StatsCard({
  className,
  variant,
  title,
  value,
  description,
  icon: Icon,
  trend,
  loading = false,
  children,
  ...props
}: StatsCardProps) {
  const trendColor = 
    trend?.direction === "up" ? "text-[hsl(145,55%,42%)]" :
    trend?.direction === "down" ? "text-[hsl(0,72%,51%)]" :
    "text-muted-foreground";
  
  const TrendIcon = 
    trend?.direction === "up" ? TrendingUp :
    trend?.direction === "down" ? TrendingDown :
    Minus;

  if (loading) {
    return (
      <div className={cn(statsCardVariants({ variant }), "animate-pulse", className)} {...props}>
        <div className="h-4 w-24 bg-muted rounded mb-2" />
        <div className="h-8 w-32 bg-muted rounded mb-2" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className={cn(statsCardVariants({ variant }), className)} {...props}>
      {/* Icono de fondo decorativo */}
      {Icon && (
        <div className="absolute right-4 top-4 opacity-10">
          <Icon className="w-16 h-16" />
        </div>
      )}
      
      <div className="relative z-10">
        {/* Título */}
        <p className="text-sm font-medium text-muted-foreground mb-1">
          {title}
        </p>
        
        {/* Valor principal */}
        <div className="flex items-baseline gap-2">
          <h3 className="text-2xl font-bold tracking-tight text-foreground">
            {value}
          </h3>
          
          {/* Tendencia */}
          {trend && (
            <div className={cn("flex items-center gap-0.5 text-xs font-medium", trendColor)}>
              <TrendIcon className="w-3.5 h-3.5" />
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        
        {/* Descripción */}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
        
        {/* Trend label */}
        {trend?.label && (
          <p className="text-xs text-muted-foreground mt-1">
            {trend.label}
          </p>
        )}
        
        {children}
      </div>
    </div>
  );
}

// Grupo de StatsCards
interface StatsGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | 4 | 5;
  gap?: "sm" | "default" | "lg";
}

function StatsGroup({ 
  className, 
  columns = 4, 
  gap = "default",
  children,
  ...props 
}: StatsGroupProps) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  };
  
  const gapSize = {
    sm: "gap-3",
    default: "gap-4",
    lg: "gap-6",
  };

  return (
    <div 
      className={cn("grid", gridCols[columns], gapSize[gap], className)} 
      {...props}
    >
      {children}
    </div>
  );
}

export { StatsCard, StatsGroup, statsCardVariants };
