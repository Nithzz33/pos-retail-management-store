import React, { useEffect, useState, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { Product } from '../types';
import { ProductCard } from '../components/ProductCard';
import { CategoryBar } from '../components/CategoryBar';
import { CategoryNav } from '../components/CategoryNav';
import { FilterBar } from '../components/FilterBar';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, ShoppingCart, Globe, Scan } from 'lucide-react';
import { seedDatabase } from '../seed';
import { StorePOS } from '../components/StorePOS';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { AIAssistant } from '../components/AIAssistant';

const ADMIN_EMAIL = "sainithingowda3714@gmail.com";

export const Home: React.FC = () => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'online' | 'pos'>('online');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | undefined>(undefined);
  
  const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;

  // Filter States
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [isPopularOnly, setIsPopularOnly] = useState(false);
  const [sort, setSort] = useState<'price-asc' | 'price-desc' | 'none'>('none');

  useEffect(() => {
    const q = query(collection(db, 'products'));
    return onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setAllProducts(prods);
      setLoading(false);
    });
  }, []);

  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    // Price Filter
    if (priceRange) {
      result = result.filter(p => {
        const price = p.discountPrice || p.price;
        return price >= priceRange[0] && price <= priceRange[1];
      });
    }

    // Popularity Filter
    if (isPopularOnly) {
      result = result.filter(p => p.isPopular);
    }

    // Sort
    if (sort === 'price-asc') {
      result.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
    } else if (sort === 'price-desc') {
      result.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
    }

    return result;
  }, [allProducts, priceRange, isPopularOnly, sort]);

  return (
    <div className="min-h-screen bg-gray-50">
      {isAdmin && (
        <div className="bg-white border-b border-gray-100 sticky top-[72px] z-40">
          <div className="container mx-auto px-4 flex items-center justify-center gap-4 py-2">
            <button 
              onClick={() => setViewMode('online')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black transition-all ${viewMode === 'online' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Globe size={18} /> Online Store
            </button>
            <button 
              onClick={() => setViewMode('pos')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black transition-all ${viewMode === 'pos' ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <ShoppingCart size={18} /> Store POS
            </button>
          </div>
        </div>
      )}

      {viewMode === 'pos' ? (
        <main className="container mx-auto px-4 py-8">
          <StorePOS 
            products={allProducts} 
            onScan={() => setIsScanning(true)} 
            externalBarcode={scannedBarcode}
          />
          <AnimatePresence>
            {isScanning && (
              <BarcodeScanner 
                isOpen={isScanning}
                onScan={(barcode) => {
                  setScannedBarcode(barcode);
                  setIsScanning(false);
                  // Reset barcode after a short delay so it can be scanned again
                  setTimeout(() => setScannedBarcode(undefined), 100);
                }}
                onClose={() => setIsScanning(false)}
              />
            )}
          </AnimatePresence>
        </main>
      ) : (
        <>
          <FilterBar 
            onPriceChange={setPriceRange}
            onPopularOnlyChange={setIsPopularOnly}
            onSortChange={setSort}
            activePriceRange={priceRange}
            isPopularOnly={isPopularOnly}
            activeSort={sort}
          />
          
          <main className="container mx-auto px-4 py-8">
            {/* Hero Section */}
        {!priceRange && !isPopularOnly && sort === 'none' && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-3xl overflow-hidden shadow-xl bg-[#FF3269] p-8 text-white flex flex-col justify-center relative group"
            >
              <div className="relative z-10">
                <h2 className="text-4xl font-black mb-4 leading-tight">Groceries delivered in <br/> <span className="text-yellow-300">10 Minutes</span></h2>
                <p className="text-white/80 font-medium mb-6">Fresh fruits, vegetables, dairy & more at your doorstep.</p>
                <button className="bg-white text-[#FF3269] px-8 py-3 rounded-xl font-black hover:bg-yellow-300 transition-colors">Shop Now</button>
              </div>
              <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-20 group-hover:scale-110 transition-transform duration-700">
                <img src="https://cdn.zeptonow.com/production///tr:w-640,ar-640-640,pr-true,f-auto,q-80/inventory/banner/06020c64-071c-438e-8913-64998811d333.png" alt="" className="w-full h-full object-contain" />
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-3xl overflow-hidden shadow-xl bg-yellow-400 p-8 text-gray-900 flex flex-col justify-center relative group"
            >
              <div className="relative z-10">
                <h2 className="text-4xl font-black mb-4 leading-tight">Get <span className="text-[#FF3269]">50% OFF</span> on <br/> your first order</h2>
                <p className="text-gray-800/80 font-medium mb-6">Use code: RETAIL50. Valid on orders above ₹199.</p>
                <button className="bg-gray-900 text-white px-8 py-3 rounded-xl font-black hover:bg-gray-800 transition-colors">Claim Offer</button>
              </div>
              <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-20 group-hover:scale-110 transition-transform duration-700">
                <img src="https://cdn.zeptonow.com/production///tr:w-640,ar-640-640,pr-true,f-auto,q-80/inventory/banner/8014594c-8367-463e-903d-818222634351.png" alt="" className="w-full h-full object-contain" />
              </div>
            </motion.div>
          </section>
        )}

        {/* Category Navigation Bar - NEW */}
        {!priceRange && !isPopularOnly && sort === 'none' && (
          <CategoryNav />
        )}

        {/* Products Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-gray-800">
              {priceRange || isPopularOnly || sort !== 'none' ? 'Filtered Products' : 'Popular Products'}
              <span className="ml-3 text-sm font-bold text-gray-400">({filteredProducts.length} items)</span>
            </h2>
            {(priceRange || isPopularOnly || sort !== 'none') && (
              <button 
                onClick={() => {
                  setPriceRange(null);
                  setIsPopularOnly(false);
                  setSort('none');
                }}
                className="text-[#FF3269] font-bold hover:underline text-sm"
              >
                Clear All
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-3 h-[240px] animate-pulse border border-gray-100">
                  <div className="aspect-square bg-gray-100 rounded-xl mb-4" />
                  <div className="h-4 bg-gray-100 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <AnimatePresence mode="popLayout">
                    {filteredProducts.map(product => (
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
                    <Filter className="text-gray-400" size={32} />
                  </div>
                  <h3 className="text-xl font-black text-gray-800">No products found</h3>
                  <p className="text-gray-500 font-medium">Try adjusting your filters to find what you're looking for.</p>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  )}

  {isAdmin && viewMode === 'pos' && (
    <AIAssistant 
      dataContext={{
        stats: {
          totalProducts: allProducts.length,
          lowStockCount: allProducts.filter(p => p.stock < 10).length,
        },
        allProducts: allProducts.map(p => ({ 
          name: p.name, 
          stock: p.stock, 
          price: p.discountPrice || p.price
        })),
        lowStockProducts: allProducts.filter(p => p.stock < 10).map(p => ({ name: p.name, stock: p.stock })),
      }}
      last7Days={[]}
      products={allProducts}
    />
  )}
</div>
);
};
