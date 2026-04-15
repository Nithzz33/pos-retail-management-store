import React, { useEffect, useState, useMemo } from 'react';
import { db, auth, onAuthStateChanged } from '../firebase';
import { collection, onSnapshot, query, where, limit, getDocs } from 'firebase/firestore';
import { Product, Offer } from '../types';
import { ProductCard } from '../components/ProductCard';
import { CategoryBar } from '../components/CategoryBar';
import { CategoryNav } from '../components/CategoryNav';
import { FilterBar } from '../components/FilterBar';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, ShoppingCart, Globe, Scan, History, Tag } from 'lucide-react';
import { seedDatabase, seedCategoriesIfEmpty } from '../seed';
import { StorePOS } from '../components/StorePOS';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { AIAssistant } from '../components/AIAssistant';
import { getRecentlyViewed } from '../utils/recentlyViewed';

const ADMIN_EMAIL = "sainithingowda3714@gmail.com";

export const Home: React.FC = () => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [userOrderCount, setUserOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'online' | 'pos'>('online');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | undefined>(undefined);
  
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = user?.email === ADMIN_EMAIL;

  // Filter States
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [isPopularOnly, setIsPopularOnly] = useState(false);
  const [sort, setSort] = useState<'newest' | 'price-low' | 'price-high' | 'popularity'>('newest');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    if (isAdmin) {
      seedCategoriesIfEmpty();
    }
  }, [isAdmin]);

  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubProducts = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setAllProducts(prods);
      setLoading(false);
    });

    const unsubOffers = onSnapshot(query(collection(db, 'offers'), where('isActive', '==', true)), (snapshot) => {
      const offersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Offer[];
      setOffers(offersData);
    });

    if (user) {
      getDocs(query(collection(db, 'orders'), where('userId', '==', user.uid)))
        .then(snap => setUserOrderCount(snap.size))
        .catch(console.error);
    } else {
      setUserOrderCount(0);
    }

    setRecentlyViewed(getRecentlyViewed());

    return () => {
      unsubProducts();
      unsubOffers();
    };
  }, [user]);

  const applicableOffers = useMemo(() => {
    return offers.filter(offer => {
      if (offer.targetAudience === 'all') return true;
      if (offer.targetAudience === 'first_order' && userOrderCount === 0) return true;
      if (offer.targetAudience === 'loyal_customer' && userOrderCount > 5) return true;
      return false;
    });
  }, [offers, userOrderCount]);

  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    // Category Filter
    if (selectedCategories.length > 0) {
      result = result.filter(p => selectedCategories.includes(p.categoryId));
    }

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
    result.sort((a, b) => {
      const priceA = a.discountPrice || a.price;
      const priceB = b.discountPrice || b.price;

      switch (sort) {
        case 'price-low': return priceA - priceB;
        case 'price-high': return priceB - priceA;
        case 'popularity': return (b.rating || 0) - (a.rating || 0);
        case 'newest':
        default:
          return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      }
    });

    return result;
  }, [allProducts, priceRange, isPopularOnly, sort, selectedCategories]);

  const clearFilters = () => {
    setPriceRange(null);
    setIsPopularOnly(false);
    setSort('newest');
    setSelectedCategories([]);
  };

  return (
    <div className="min-h-screen bg-app-bg">
      {isAdmin && (
        <div className="bg-white/40 backdrop-blur-md border-b border-white/20 sticky top-[88px] z-40">
          <div className="container mx-auto px-4 flex items-center justify-center gap-4 py-2">
            <button 
              onClick={() => setViewMode('online')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black transition-all ${viewMode === 'online' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-white/40'}`}
            >
              <Globe size={18} /> Online Store
            </button>
            <button 
              onClick={() => setViewMode('pos')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black transition-all ${viewMode === 'pos' ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20' : 'text-gray-500 hover:bg-white/40'}`}
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
            onCategoryChange={setSelectedCategories}
            activePriceRange={priceRange}
            isPopularOnly={isPopularOnly}
            activeSort={sort}
            selectedCategories={selectedCategories}
            onClearAll={clearFilters}
          />
          
          <main className="container mx-auto px-4 py-8">
            {/* Offers Section */}
            {!priceRange && !isPopularOnly && sort === 'newest' && selectedCategories.length === 0 && applicableOffers.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-black text-gray-800 tracking-tight">Top Offers For You</h2>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
                  {applicableOffers.map((offer, index) => {
                    const gradients = [
                      "from-purple-500 to-indigo-600",
                      "from-[#FF3269] to-orange-500",
                      "from-emerald-500 to-teal-600"
                    ];
                    const gradient = gradients[index % gradients.length];
                    const shadowColors = [
                      "shadow-indigo-500/20",
                      "shadow-[#FF3269]/20",
                      "shadow-emerald-500/20"
                    ];
                    const shadow = shadowColors[index % shadowColors.length];

                    return (
                      <div key={offer.id} className={`snap-start min-w-[280px] sm:min-w-[320px] h-[160px] rounded-3xl bg-gradient-to-br ${gradient} p-6 text-white relative overflow-hidden flex-shrink-0 shadow-lg ${shadow}`}>
                        <div className="relative z-10">
                          <h3 className="text-3xl font-black mb-1">{offer.title}</h3>
                          <p className="text-white/90 font-medium mb-4">{offer.description}</p>
                          <span className="bg-white/20 px-3 py-1.5 rounded-xl font-bold text-sm backdrop-blur-md border border-white/20">Code: {offer.code}</span>
                        </div>
                        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/20 rounded-full blur-3xl"></div>
                        <div className="absolute right-4 top-4 opacity-50">
                          <Tag size={48} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Hero Section */}
        {!priceRange && !isPopularOnly && sort === 'newest' && selectedCategories.length === 0 && (
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
        {!priceRange && !isPopularOnly && sort === 'newest' && selectedCategories.length === 0 && (
          <CategoryNav />
        )}

        {/* Recently Viewed Section */}
        {!priceRange && !isPopularOnly && sort === 'newest' && selectedCategories.length === 0 && recentlyViewed.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100">
                <History className="text-[#FF3269]" size={20} />
              </div>
              <h2 className="text-2xl font-black text-gray-800 tracking-tight">Recently Viewed</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              {recentlyViewed.map(product => (
                <div key={product.id} className="w-[160px] sm:w-[200px] flex-shrink-0">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Products Section by Category */}
        <section className="space-y-12">
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
              {(priceRange || isPopularOnly || sort !== 'newest' || selectedCategories.length > 0) ? (
                // Filtered View
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black text-gray-800">
                      Filtered Products
                      <span className="ml-3 text-sm font-bold text-gray-400">({filteredProducts.length} items)</span>
                    </h2>
                    <button 
                      onClick={clearFilters}
                      className="text-[#FF3269] font-bold hover:underline text-sm"
                    >
                      Clear All
                    </button>
                  </div>
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
                </div>
              ) : (
                // Grouped by Category View (Zepto Style)
                <div className="space-y-10">
                  {/* Popular Products Row */}
                  {filteredProducts.filter(p => p.isPopular).length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl lg:text-2xl font-black text-gray-800">Trending Near You</h2>
                      </div>
                      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                        {filteredProducts.filter(p => p.isPopular).map(product => (
                          <div key={product.id} className="w-[160px] sm:w-[200px] flex-shrink-0">
                            <ProductCard product={product} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Products by Category Rows */}
                  {Array.from(new Set(filteredProducts.map(p => p.categoryId))).map(categoryId => {
                    const categoryProducts = filteredProducts.filter(p => p.categoryId === categoryId);
                    if (categoryProducts.length === 0) return null;
                    
                    // Try to find category name from the first product's categoryId
                    // Note: We don't have categories array in Home.tsx directly, so we'll just use a generic title or fetch it if needed.
                    // For now, we'll just show the products.
                    return (
                      <div key={categoryId}>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-xl lg:text-2xl font-black text-gray-800 capitalize">
                            {categoryId.replace(/-/g, ' ')}
                          </h2>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                          {categoryProducts.map(product => (
                            <div key={product.id} className="w-[160px] sm:w-[200px] flex-shrink-0">
                              <ProductCard product={product} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
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
