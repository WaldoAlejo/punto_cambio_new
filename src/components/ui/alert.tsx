import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive:
          "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
        // Soft variants con los nuevos colores del tema
        success: "bg-[hsl(145,60%,96%)] text-[hsl(145,55%,32%)] border-[hsl(145,50%,85%)] [&>svg]:text-[hsl(145,55%,42%)]",
        warning: "bg-[hsl(32,100%,96%)] text-[hsl(32,80%,35%)] border-[hsl(32,80%,82%)] [&>svg]:text-[hsl(32,95%,55%)]",
        error: "bg-[hsl(0,85%,97%)] text-[hsl(0,72%,45%)] border-[hsl(0,75%,89%)] [&>svg]:text-[hsl(0,72%,51%)]",
        info: "bg-[hsl(200,85%,97%)] text-[hsl(200,80%,40%)] border-[hsl(200,80%,85%)] [&>svg]:text-[hsl(200,80%,50%)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
