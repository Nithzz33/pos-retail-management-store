import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Category } from '../types';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export const CategoryBar: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    return onSnapshot(query(collection(db, 'categories'), orderBy('order')), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
      setCategories(cats);
    });
  }, []);

  return (
    <div className="bg-white border-b border-gray-100 overflow-x-auto no-scrollbar sticky top-[72px] z-40">
      <div className="container mx-auto px-4 flex items-center gap-8 py-3 min-w-max">
        {categories.map((cat) => (
          <Link key={cat.id} to={`/category/${cat.id}`}>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex flex-col items-center gap-2 cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-2xl bg-gray-50 p-2 group-hover:bg-[#FF3269]/5 transition-colors">
                <img 
                  src={cat.imageUrl} 
                  alt={cat.name} 
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="text-[11px] font-bold text-gray-600 group-hover:text-[#FF3269] transition-colors text-center max-w-[80px]">
                {cat.name}
              </span>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
};
