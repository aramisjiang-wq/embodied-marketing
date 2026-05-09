"use client";

import { Calendar } from "lucide-react";

interface DateRangeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options?: { value: string; label: string }[];
}

const defaultOptions = [
  { value: "3m", label: "近3个月" },
  { value: "6m", label: "近6个月" },
  { value: "12m", label: "近一年" },
  { value: "ytd", label: "今年" },
];

export function DateRangeSelector({
  value,
  onChange,
  options = defaultOptions,
}: DateRangeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-400" />
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              value === option.value
                ? "bg-blue-100 text-blue-700 font-medium"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
