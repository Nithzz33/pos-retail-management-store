import React, { useEffect, useState, useMemo } from 'react';
import { db, auth, onAuthStateChanged } from '../firebase';
import { collection, onSnapshot, query, where, limit, getDocs } from 'firebase/firestore';
import { Product, Offer } from '../types';
import { ProductCard } from '../components/ProductCard';
import { CategoryBar } from '../components/CategoryBar';
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
  const [categories, setCategories] = useState<any[]>([]);
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

    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCategories(cats);
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
      unsubCategories();
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
    <div className="min-h-screen bg-app-bg pb-20">
      {isAdmin && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-white/90 backdrop-blur-xl shadow-2xl rounded-2xl border border-gray-100 p-1.5 flex items-center gap-1">
          <button 
            onClick={() => setViewMode('online')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black transition-all ${viewMode === 'online' ? 'bg-[#0c831f] text-white shadow-lg shadow-[#0c831f]/20' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <Globe size={18} /> Online Store
          </button>
          <button 
            onClick={() => setViewMode('pos')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black transition-all ${viewMode === 'pos' ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <ShoppingCart size={18} /> Store POS
          </button>
        </div>
      )}

      {viewMode === 'pos' ? (
        <main className="container max-w-7xl mx-auto px-4 py-8">
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
          
          <main className="container max-w-7xl mx-auto px-4 py-8">
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
                      "from-[#0c831f] to-emerald-500",
                      "from-blue-500 to-teal-600"
                    ];
                    const gradient = gradients[index % gradients.length];
                    const shadowColors = [
                      "shadow-indigo-500/20",
                      "shadow-[#0c831f]/20",
                      "shadow-blue-500/20"
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

            {/* Banners Section */}
            {!priceRange && !isPopularOnly && sort === 'newest' && selectedCategories.length === 0 && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
                {/* Left Banner */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-[2rem] overflow-hidden bg-gradient-to-br from-[#f1e6fd] to-[#ebd9fd] p-8 lg:p-10 flex flex-col justify-between relative group shadow-sm border border-purple-100"
                >
                  <div className="text-center mb-8">
                    <h2 className="text-xl lg:text-2xl font-black tracking-tight text-[#812cba]">
                      <span className="text-[#a111a8]/60">ALL </span> 
                      NEW ZEPTO <span className="text-[#a111a8]/60">EXPERIENCE</span>
                    </h2>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    <div className="flex-1 bg-white rounded-3xl p-4 flex items-center justify-center gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#a111a8] to-[#812cba] rounded-2xl flex items-center justify-center text-white pb-1 font-black text-2xl shadow-inner">
                        Z
                      </div>
                      <div>
                        <p className="text-3xl font-black text-[#812cba] leading-none">₹0 <span className="text-xl">FEES</span></p>
                      </div>
                    </div>
                    <div className="flex-1 bg-white rounded-3xl p-4 flex items-center justify-center gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                      <div className="w-12 h-12 bg-[#ffe800] rounded-2xl flex items-center justify-center text-[#812cba] font-black text-2xl shadow-inner relative">
                        <span className="absolute -top-1 -left-1 bg-[#812cba] w-4 h-4 rounded-full border-2 border-white"></span>
                        ₹
                      </div>
                      <div>
                        <p className="text-sm font-black text-[#812cba] leading-tight">EVERYDAY<br/><span className="text-xl tracking-tight">LOWEST PRICES*</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                    {['₹0 Handling Fee', '₹0 Delivery Fee*', '₹0 Rain & Surge Fee'].map((text, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <span className="font-bold text-[#812cba] text-sm">{text}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-center text-[#812cba]/60 font-bold mt-4">*T&C Apply. Above specific minimum order value</p>
                </motion.div>

                {/* Right Banner */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-[2rem] overflow-hidden bg-[#0d163f] p-8 lg:p-12 text-white flex flex-col relative group shadow-sm h-[320px] lg:h-auto"
                >
                  <div className="relative z-10 max-w-[60%]">
                    <h2 className="text-4xl lg:text-5xl font-black mb-4 leading-none tracking-tight">Paan Corner</h2>
                    <p className="text-white/90 font-medium mb-8 text-sm lg:text-base leading-relaxed">
                      Get smoking accessories, fresheners & more in Minutes this IPL with Zepto!
                    </p>
                    <button className="bg-white text-gray-900 px-8 py-3.5 rounded-2xl font-black text-lg hover:scale-105 transition-transform shadow-xl">
                      Order now
                    </button>
                  </div>
                  <div className="absolute right-0 bottom-0 w-full lg:w-2/3 h-full opacity-90">
                    <img 
                      src="https://images.unsplash.com/photo-1540324155974-7523202daa3f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" 
                      alt="Stadium" 
                      className="w-full h-full object-cover object-right opacity-40 mix-blend-screen"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute right-4 bottom-0 h-[85%] w-1/2 flex items-end justify-end pointer-events-none">
                     <img 
                      src="https://cdn.zeptonow.com/production///tr:w-640,ar-640-640,pr-true,f-auto,q-80/inventory/banner/8014594c-8367-463e-903d-818222634351.png" 
                      alt="Products" 
                      className="h-full w-auto object-contain object-bottom translate-y-4 group-hover:-translate-y-2 transition-transform duration-500"
                    />
                  </div>
                </motion.div>
              </section>
            )}

        {/* Recently Viewed Section */}
        {!priceRange && !isPopularOnly && sort === 'newest' && selectedCategories.length === 0 && recentlyViewed.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100">
                <History className="text-[#0c831f]" size={20} />
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
                      className="text-[#0c831f] font-bold hover:underline text-sm"
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
                // Grouped by Category View (BlinkIt Style)
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
                    
                    const category = categories.find(c => c.id === categoryId);
                    const categoryName = category ? category.name : categoryId.replace(/-/g, ' ');

                    return (
                      <div key={categoryId}>
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-xl lg:text-2xl font-black text-gray-800 capitalize">
                            {categoryName}
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
