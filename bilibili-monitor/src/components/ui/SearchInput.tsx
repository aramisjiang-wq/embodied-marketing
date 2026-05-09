"use client";

import { Search, X } from "lucide-react";
import { type InputHTMLAttributes, forwardRef } from "react";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className = "", value, onClear, ...props }, ref) => {
    const hasValue = value && String(value).length > 0;

    return (
      <div className={`relative flex-1 ${className}`}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-all"
          {...props}
        />
        {hasValue && onClear && (
          <button
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            type="button"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
