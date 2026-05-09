"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

interface Brand {
  id: number;
  name: string;
  follower?: number;
  video_count?: number;
  total_views?: number;
  is_self?: number;
}

interface BrandSelectorProps {
  brands: Brand[];
  selected: number[];
  onChange: (ids: number[]) => void;
  max?: number;
}

export function BrandSelector({
  brands,
  selected,
  onChange,
  max = 5,
}: BrandSelectorProps) {
  const [search, setSearch] = useState("");

  const filteredBrands = search.trim()
    ? brands.filter((brand) =>
        brand.name.toLowerCase().includes(search.toLowerCase())
      )
    : brands;

  // 排序：自研优先，然后按播放量降序
  const sortedBrands = [...filteredBrands].sort((a, b) => {
    if (a.is_self === 1) return -1;
    if (b.is_self === 1) return 1;
    return (b.total_views || 0) - (a.total_views || 0);
  });

  const toggleBrand = (id: number) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (selected.length < max) {
      onChange([...selected, id]);
    }
  };

  const removeBrand = (id: number) => {
    onChange(selected.filter((s) => s !== id));
  };

  const selectedBrands = brands.filter((b) => selected.includes(b.id));

  const isMaxed = selected.length >= max;

  return (
    <div className="space-y-2.5">
      {/* 已选标签 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedBrands.map((brand) => (
          <span
            key={brand.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-700 text-white rounded text-[11px] font-medium"
          >
            {brand.name}
            <button
              onClick={() => removeBrand(brand.id)}
              className="hover:bg-emerald-600 rounded-full p-px transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <span className={`text-[10px] ${isMaxed ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {selected.length}/{max} {isMaxed && '(已达上限)'}
        </span>
      </div>

      {/* 操作栏：搜索 + 快捷按钮 */}
      <div className="flex items-center gap-2">
        {/* 搜索框 */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索厂家..."
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-gray-400 transition-colors placeholder:text-gray-400"
          />
        </div>

        {/* 快捷操作 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const allIds = sortedBrands.slice(0, max).map(b => b.id);
              onChange(allIds);
            }}
            disabled={brands.length === 0}
            className="px-2 py-1 text-[11px] font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
          >
            快速选择
          </button>
          <button
            onClick={() => onChange([])}
            disabled={selected.length === 0}
            className="px-2 py-1 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
          >
            清空
          </button>
        </div>
      </div>

      {/* 厂家列表 - 内联标签式 */}
      <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
        {sortedBrands.length === 0 ? (
          <div className="w-full py-4 text-center text-[11px] text-gray-400">
            {search ? '未找到匹配的厂家' : '暂无厂家数据'}
          </div>
        ) : (
          sortedBrands.map((brand) => {
            const isSelected = selected.includes(brand.id);
            const isDisabled = !isSelected && isMaxed;

            return (
              <button
                key={brand.id}
                onClick={() => !isDisabled && toggleBrand(brand.id)}
                disabled={isDisabled}
                className={`
                  px-2 py-1 rounded text-[11px] font-medium
                  transition-all duration-150 border
                  ${
                    isSelected
                      ? brand.is_self === 1
                        ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                        : 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                      : isDisabled
                        ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  }
                `}
              >
                {brand.name}
                {brand.is_self === 1 && !isSelected && (
                  <span className="ml-0.5 text-[9px] opacity-70">自</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
