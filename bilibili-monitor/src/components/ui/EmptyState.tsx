"use client";

import { type ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center mb-4 text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-gray-500 mb-4 max-w-xs">{description}</p>
      )}
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
