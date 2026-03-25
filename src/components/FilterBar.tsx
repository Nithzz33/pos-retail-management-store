import React from 'react';
import { Filter, ChevronDown, Star, ArrowUpDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface FilterBarProps {
  onPriceChange: (range: [number, number] | null) => void;
  onPopularOnlyChange: (popularOnly: boolean) => void;
  onSortChange: (sort: 'price-asc' | 'price-desc' | 'none') => void;
  activePriceRange: [number, number] | null;
  isPopularOnly: boolean;
  activeSort: 'price-asc' | 'price-desc' | 'none';
}

export const FilterBar: React.FC<FilterBarProps> = ({
  onPriceChange,
  onPopularOnlyChange,
  onSortChange,
  activePriceRange,
  isPopularOnly,
  activeSort
}) => {
  const priceRanges: { label: string; range: [number, number] | null }[] = [
    { label: 'All Prices', range: null },
    { label: 'Under ₹100', range: [0, 100] },
    { label: '₹100 - ₹500', range: [100, 500] },
    { label: 'Above ₹500', range: [500, 10000] },
  ];

  return (
    <div className="bg-white border-b border-gray-100 sticky top-[72px] z-40 shadow-sm">
      <div className="container mx-auto px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-gray-500 font-bold text-sm mr-2">
          <Filter size={16} />
          <span>Filters:</span>
        </div>

        {/* Price Filter */}
        <div className="relative group">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-bold text-gray-700 border border-gray-200">
            Price: {activePriceRange ? priceRanges.find(r => r.range?.[0] === activePriceRange[0])?.label : 'All'}
            <ChevronDown size={14} />
          </button>
          <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 hidden group-hover:block z-50">
            {priceRanges.map((r, i) => (
              <button
                key={i}
                onClick={() => onPriceChange(r.range)}
                className={`w-full text-left px-4 py-2 text-sm font-bold hover:bg-gray-50 transition-colors ${
                  (activePriceRange === null && r.range === null) || (activePriceRange?.[0] === r.range?.[0] && activePriceRange?.[1] === r.range?.[1])
                    ? 'text-[#FF3269] bg-[#FF3269]/5'
                    : 'text-gray-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Popularity Filter */}
        <button
          onClick={() => onPopularOnlyChange(!isPopularOnly)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-bold border ${
            isPopularOnly
              ? 'bg-[#FF3269] text-white border-[#FF3269] shadow-lg shadow-[#FF3269]/20'
              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
          }`}
        >
          <Star size={14} fill={isPopularOnly ? 'white' : 'none'} />
          Popular Only
        </button>

        {/* Sort Filter */}
        <div className="relative group ml-auto">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-bold text-gray-700 border border-gray-200">
            <ArrowUpDown size={14} />
            Sort: {activeSort === 'price-asc' ? 'Price: Low to High' : activeSort === 'price-desc' ? 'Price: High to Low' : 'Default'}
            <ChevronDown size={14} />
          </button>
          <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 hidden group-hover:block z-50">
            <button
              onClick={() => onSortChange('none')}
              className={`w-full text-left px-4 py-2 text-sm font-bold hover:bg-gray-50 transition-colors ${activeSort === 'none' ? 'text-[#FF3269] bg-[#FF3269]/5' : 'text-gray-700'}`}
            >
              Default
            </button>
            <button
              onClick={() => onSortChange('price-asc')}
              className={`w-full text-left px-4 py-2 text-sm font-bold hover:bg-gray-50 transition-colors ${activeSort === 'price-asc' ? 'text-[#FF3269] bg-[#FF3269]/5' : 'text-gray-700'}`}
            >
              Price: Low to High
            </button>
            <button
              onClick={() => onSortChange('price-desc')}
              className={`w-full text-left px-4 py-2 text-sm font-bold hover:bg-gray-50 transition-colors ${activeSort === 'price-desc' ? 'text-[#FF3269] bg-[#FF3269]/5' : 'text-gray-700'}`}
            >
              Price: High to Low
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
