import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
  fullScreen?: boolean;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Loading({
  size = "md",
  text = "Cargando...",
  className,
  fullScreen = false,
}: LoadingProps) {
  const content = (
    <div className={cn("flex items-center justify-center", className)}>
      <Loader2
        className={cn("animate-spin text-gray-500", sizeClasses[size])}
      />
      {text && <span className="ml-2 text-gray-500">{text}</span>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{text}</p>
        </div>
      </div>
    );
  }

  return content;
}

export function LoadingSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} />;
}
