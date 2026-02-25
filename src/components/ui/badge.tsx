import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ✅ Constante interna (ya no exportamos badgeVariants)
const _badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Nuevas variantes soft
        success: "bg-[hsl(145,60%,96%)] text-[hsl(145,55%,32%)] border-[hsl(145,50%,85%)] hover:bg-[hsl(145,60%,92%)]",
        warning: "bg-[hsl(32,100%,96%)] text-[hsl(32,80%,35%)] border-[hsl(32,80%,82%)] hover:bg-[hsl(32,100%,92%)]",
        error: "bg-[hsl(0,85%,97%)] text-[hsl(0,72%,45%)] border-[hsl(0,75%,89%)] hover:bg-[hsl(0,85%,93%)]",
        info: "bg-[hsl(200,85%,97%)] text-[hsl(200,80%,40%)] border-[hsl(200,80%,85%)] hover:bg-[hsl(200,85%,93%)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof _badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(_badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge };
