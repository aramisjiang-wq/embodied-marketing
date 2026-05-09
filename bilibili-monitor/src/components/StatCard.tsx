"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, trend, icon }: StatCardProps) {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-gray-500 text-sm font-medium">{title}</span>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-gray-400"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : isNegative ? (
              <TrendingDown className="w-4 h-4" />
            ) : null}
            <span>{trend > 0 ? "+" : ""}{trend}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
