import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Category } from '../types';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export const CategoryNav: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(query(collection(db, 'categories'), orderBy('order')), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
      setCategories(cats);
      setLoading(false);
    });
  }, []);

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-gray-800">Shop by Category</h2>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {loading ? (
          [...Array(7)].map((_, i) => (
            <div key={i} className="bg-card-bg p-4 rounded-3xl border border-gray-100 shadow-sm animate-pulse">
              <div className="aspect-square bg-gray-50 rounded-2xl mb-3" />
              <div className="h-3 bg-gray-50 rounded w-3/4 mx-auto" />
            </div>
          ))
        ) : (
          categories.map((cat) => (
            <Link key={cat.id} to={`/category/${cat.id}`}>
              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-card-bg p-4 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group text-center"
              >
                <div className="aspect-square bg-gray-50 rounded-2xl p-3 mb-3 group-hover:bg-[#FF3269]/5 transition-colors">
                  <img 
                    src={cat.imageUrl} 
                    alt={cat.name} 
                    className="w-full h-full object-contain group-hover:scale-110 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-xs font-black text-gray-700 group-hover:text-[#FF3269] transition-colors line-clamp-2 leading-tight">
                  {cat.name}
                </span>
              </motion.div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};
