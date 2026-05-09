"use client";

import { type ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  accentColor?: string;
  trend?: {
    value: number;
    label?: string;
  };
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  accentColor = "#2563EB",
  trend,
}: StatCardProps) {
  const isPositive = trend && trend.value > 0;
  const isNegative = trend && trend.value < 0;

  return (
    <div className="relative overflow-hidden bg-white rounded-xl border border-gray-200 p-5 transition-all duration-200 hover:shadow-md hover:border-gray-300">
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full"
        style={{ backgroundColor: accentColor }}
      />

      <div className="pl-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {icon && (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}15` }}
              >
                <div style={{ color: accentColor }}>{icon}</div>
              </div>
            )}
            <span className="text-sm font-medium text-gray-600">{title}</span>
          </div>
          {trend && (
            <span
              className={`text-xs font-medium ${
                isPositive
                  ? "text-green-600"
                  : isNegative
                  ? "text-red-600"
                  : "text-gray-400"
              }`}
            >
              {isPositive ? "+" : ""}
              {trend.value}%
            </span>
          )}
        </div>

        <p className="text-2xl font-bold text-gray-900 tracking-tight">
          {value}
        </p>

        {subtitle && (
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
