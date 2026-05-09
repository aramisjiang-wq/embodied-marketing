"use client";

import { type ReactNode, type HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "elevated" | "bordered";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = "default",
      padding = "md",
      hover = false,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles = "bg-white rounded-xl border border-gray-200 transition-all duration-200";

    const variants = {
      default: "",
      elevated: "shadow-sm",
      bordered: "border-gray-300",
    };

    const paddings = {
      none: "",
      sm: "p-4",
      md: "p-5",
      lg: "p-6",
    };

    const hoverStyles = hover
      ? "cursor-pointer hover:shadow-md hover:border-gray-300 hover:-translate-y-px"
      : "";

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${paddings[padding]} ${hoverStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function CardHeader({ children, className = "", action }: CardHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div className="flex-1 min-w-0">{children}</div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className = "" }: CardTitleProps) {
  return (
    <h3 className={`text-sm font-semibold text-gray-900 ${className}`}>
      {children}
    </h3>
  );
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className = "" }: CardDescriptionProps) {
  return (
    <p className={`text-xs text-gray-500 mt-1 ${className}`}>
      {children}
    </p>
  );
}
