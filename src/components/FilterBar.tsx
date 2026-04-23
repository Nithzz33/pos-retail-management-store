import React, { useState, useEffect, useRef } from 'react';
import { Filter, ChevronDown, Star, ArrowUpDown, Check, X, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Category } from '../types';

interface FilterBarProps {
  onPriceChange: (range: [number, number] | null) => void;
  onPopularOnlyChange: (popularOnly: boolean) => void;
  onSortChange: (sort: 'newest' | 'price-low' | 'price-high' | 'popularity') => void;
  onCategoryChange: (categories: string[]) => void;
  activePriceRange: [number, number] | null;
  isPopularOnly: boolean;
  activeSort: 'newest' | 'price-low' | 'price-high' | 'popularity';
  selectedCategories: string[];
  onClearAll: () => void;
}

export const FilterBar: React.FC<FilterBarProps & { className?: string }> = ({
  onPriceChange,
  onPopularOnlyChange,
  onSortChange,
  onCategoryChange,
  activePriceRange,
  isPopularOnly,
  activeSort,
  selectedCategories,
  onClearAll,
  className
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'categories'), orderBy('order')), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
      setCategories(cats);
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      unsub();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const priceRanges: { label: string; range: [number, number] | null }[] = [
    { label: 'All Prices', range: null },
    { label: 'Under ₹100', range: [0, 100] },
    { label: '₹100 - ₹500', range: [100, 500] },
    { label: 'Above ₹500', range: [500, 10000] },
  ];

  const toggleCategory = (id: string) => {
    const newSelection = selectedCategories.includes(id)
      ? selectedCategories.filter(c => c !== id)
      : [...selectedCategories, id];
    onCategoryChange(newSelection);
  };

  const hasActiveFilters = activePriceRange !== null || isPopularOnly || activeSort !== 'newest' || selectedCategories.length > 0;

  return (
    <div className={className || "bg-white/80 backdrop-blur-xl border-b border-white/20 z-30 shadow-[0_4px_30px_rgb(0,0,0,0.03)] overflow-visible"}>
      <div className="container max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 lg:gap-4" ref={dropdownRef}>
        <div className="flex items-center gap-2 text-gray-400 font-black text-xs uppercase tracking-widest mr-2 whitespace-nowrap">
          <Filter size={14} />
          <span>Filters</span>
        </div>

        {/* Category Filter */}
        <div className="relative">
          <button 
            onClick={() => setActiveDropdown(activeDropdown === 'category' ? null : 'category')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-black whitespace-nowrap border ${
              selectedCategories.length > 0 
                ? 'bg-[#0c831f]/5 text-[#0c831f] border-[#0c831f]/20' 
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Tag size={14} />
            Categories {selectedCategories.length > 0 && `(${selectedCategories.length})`}
            <ChevronDown size={14} className={`transition-transform duration-200 ${activeDropdown === 'category' ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {activeDropdown === 'category' && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-0 mt-2 w-64 bg-white/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 py-3 z-50 overflow-hidden"
              >
                <div className="max-h-64 overflow-y-auto px-2 space-y-1">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors group"
                    >
                      <span className={`text-sm font-bold ${selectedCategories.includes(cat.id) ? 'text-[#0c831f]' : 'text-gray-600'}`}>
                        {cat.name}
                      </span>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        selectedCategories.includes(cat.id) 
                          ? 'bg-[#0c831f] border-[#0c831f]' 
                          : 'border-gray-200 group-hover:border-gray-300'
                      }`}>
                        {selectedCategories.includes(cat.id) && <Check size={12} className="text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Price Filter */}
        <div className="relative">
          <button 
            onClick={() => setActiveDropdown(activeDropdown === 'price' ? null : 'price')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-black whitespace-nowrap border ${
              activePriceRange 
                ? 'bg-[#0c831f]/5 text-[#0c831f] border-[#0c831f]/20' 
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            Price: {activePriceRange ? priceRanges.find(r => r.range?.[0] === activePriceRange[0])?.label : 'All'}
            <ChevronDown size={14} className={`transition-transform duration-200 ${activeDropdown === 'price' ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {activeDropdown === 'price' && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full left-0 mt-2 w-48 bg-white/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 py-2 z-50"
              >
                {priceRanges.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onPriceChange(r.range);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-gray-50 transition-colors flex items-center justify-between ${
                      (activePriceRange === null && r.range === null) || (activePriceRange?.[0] === r.range?.[0] && activePriceRange?.[1] === r.range?.[1])
                        ? 'text-[#0c831f] bg-[#0c831f]/5'
                        : 'text-gray-700'
                    }`}
                  >
                    {r.label}
                    {((activePriceRange === null && r.range === null) || (activePriceRange?.[0] === r.range?.[0] && activePriceRange?.[1] === r.range?.[1])) && <Check size={14} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Popularity Filter */}
        <button
          onClick={() => onPopularOnlyChange(!isPopularOnly)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-black whitespace-nowrap border ${
            isPopularOnly
              ? 'bg-[#0c831f] text-white border-[#0c831f] shadow-lg shadow-[#0c831f]/20'
              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
          }`}
        >
          <Star size={14} fill={isPopularOnly ? 'white' : 'none'} />
          Popular
        </button>

        {/* Sort Filter */}
        <div className="relative ml-auto">
          <button 
            onClick={() => setActiveDropdown(activeDropdown === 'sort' ? null : 'sort')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-black whitespace-nowrap border ${
              activeSort !== 'newest' 
                ? 'bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-900/20' 
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <ArrowUpDown size={14} />
            {activeSort === 'price-low' ? 'Low to High' : activeSort === 'price-high' ? 'High to Low' : activeSort === 'popularity' ? 'Popularity' : 'Newest'}
            <ChevronDown size={14} className={`transition-transform duration-200 ${activeDropdown === 'sort' ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence>
            {activeDropdown === 'sort' && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-full right-0 mt-2 w-56 bg-white/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 py-2 z-50"
              >
                {[
                  { label: 'Newest First', value: 'newest' },
                  { label: 'Price: Low to High', value: 'price-low' },
                  { label: 'Price: High to Low', value: 'price-high' },
                  { label: 'Popularity', value: 'popularity' }
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => {
                      onSortChange(s.value as any);
                      setActiveDropdown(null);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-gray-50 transition-colors flex items-center justify-between ${
                      activeSort === s.value ? 'text-[#0c831f] bg-[#0c831f]/5' : 'text-gray-700'
                    }`}
                  >
                    {s.label}
                    {activeSort === s.value && <Check size={14} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Clear All Button */}
        {hasActiveFilters && (
          <button 
            onClick={onClearAll}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-[#0c831f] hover:bg-[#0c831f]/5 transition-colors text-xs font-black uppercase tracking-wider whitespace-nowrap"
          >
            <X size={14} />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
