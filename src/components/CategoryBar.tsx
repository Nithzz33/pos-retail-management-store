import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Category } from '../types';
import { motion } from 'framer-motion';

interface CategoryBarProps {
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({ selectedCategories, onCategoryChange }) => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    return onSnapshot(query(collection(db, 'categories'), orderBy('order')), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
      setCategories(cats);
    });
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      onCategoryChange(selectedCategories.filter(id => id !== categoryId));
    } else {
      onCategoryChange([categoryId]); // Select exclusively like BlinkIt
    }
  };

  return (
    <div className="bg-white py-6 border-b border-gray-100 overflow-x-auto no-scrollbar relative z-30">
      <div className="container mx-auto px-4 flex items-start gap-4 min-w-max">
        {categories.map((cat) => {
          const isSelected = selectedCategories.includes(cat.id);
          return (
            <div key={cat.id} onClick={() => handleCategoryClick(cat.id)}>
              <motion.div 
                whileHover={{ scale: 1.02 }}
                className={`flex flex-col items-center gap-3 cursor-pointer group w-24 md:w-28 lg:w-32`}
              >
                <div className={`w-full aspect-square rounded-[2rem] bg-[#f8f9fa] overflow-hidden flex items-center justify-center p-3 transition-all ${isSelected ? 'ring-2 ring-[#a111a8] bg-[#a111a8]/5' : 'hover:bg-gray-100'}`}>
                  <img 
                    src={cat.imageUrl} 
                    alt={cat.name} 
                    className="w-full h-full object-contain mix-blend-multiply"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className={`text-xs md:text-sm font-bold text-center leading-tight transition-colors ${isSelected ? 'text-[#a111a8]' : 'text-gray-800'}`}>
                  {cat.name}
                </span>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
