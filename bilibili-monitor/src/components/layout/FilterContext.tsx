"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import type { BrandWithStats } from "@/lib/types";

interface FilterContextType {
  brands: BrandWithStats[];
  setBrands: (brands: BrandWithStats[]) => void;
  selectedBrands: number[];
  period: "week" | "month";
  toggleBrand: (id: number) => void;
  setSelectedBrands: React.Dispatch<React.SetStateAction<number[]>>;
  setPeriod: (period: "week" | "month") => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [brands, setBrands] = useState<BrandWithStats[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<number[]>([]);
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const toggleBrand = (id: number) => {
    setSelectedBrands((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <FilterContext.Provider
      value={{
        brands,
        setBrands,
        selectedBrands,
        setSelectedBrands,
        period,
        toggleBrand,
        setPeriod,
        selectedYear,
        setSelectedYear,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilter() {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilter must be used within a FilterProvider");
  }
  return context;
}
