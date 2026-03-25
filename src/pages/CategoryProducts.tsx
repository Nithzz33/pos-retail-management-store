import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import { Product, Category } from '../types';
import { ProductCard } from '../components/ProductCard';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Loader2, ShoppingBag } from 'lucide-react';

export const CategoryProducts: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categoryId) return;

    // Fetch Category Details
    const fetchCategory = async () => {
      try {
        const docRef = doc(db, 'categories', categoryId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCategory({ id: docSnap.id, ...docSnap.data() } as Category);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `categories/${categoryId}`);
      }
    };

    // Fetch Products in Category
    const q = query(
      collection(db, 'products'),
      where('categoryId', '==', categoryId)
    );

    const unsubProducts = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(prods);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `products?category=${categoryId}`);
      setLoading(false);
    });

    fetchCategory();
    window.scrollTo(0, 0);
    return () => unsubProducts();
  }, [categoryId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#FF3269]" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-[72px] z-30">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-gray-900">{category?.name || 'Category'}</h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{products.length} Items</p>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <AnimatePresence mode="popLayout">
              {products.map(product => (
                <motion.div
                  layout
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="text-gray-400" size={32} />
            </div>
            <h3 className="text-xl font-black text-gray-800">No products in this category</h3>
            <p className="text-gray-500 font-medium">We're currently restocking items for this category.</p>
            <Link to="/" className="mt-6 inline-block bg-[#FF3269] text-white px-8 py-3 rounded-xl font-black">
              Back to Home
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};
