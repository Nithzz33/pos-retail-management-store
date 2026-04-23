import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, User, MapPin, ChevronDown, History, LayoutDashboard, Grid, ShoppingBag, X, Loader2 } from 'lucide-react';
import { loginWithGoogle, logout, auth, db, onAuthStateChanged } from '../firebase';
import { collection, onSnapshot, query, orderBy, getDocs, where, limit } from 'firebase/firestore';
import { useCart } from '../context/CartContext';
import { Category, Product } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { CartDrawer } from './CartDrawer';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

const ADMIN_EMAIL = "sainithingowda3714@gmail.com";

export const Header: React.FC = () => {
  const { cartItems, totalAmount } = useCart();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [user, setUser] = useState(auth.currentUser);
  
  // Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length >= 2) {
        setIsSearching(true);
        try {
          // Note: Firestore doesn't support full-text search natively.
          // For a real app, we'd use Algolia or similar.
          // Here we'll do a simple prefix search or fetch all and filter.
          const q = query(
            collection(db, 'products'),
            limit(50)
          );
          const snapshot = await getDocs(q);
          const results = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Product))
            .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .slice(0, 8);
          setSearchResults(results);
          setShowSearchResults(true);
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  useEffect(() => {
    return onSnapshot(query(collection(db, 'categories'), orderBy('order')), (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
      setCategories(cats);
    });
  }, []);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header className={`sticky top-0 left-0 right-0 z-50 w-full bg-white border-b border-gray-100 transition-shadow duration-300 py-3 ${isScrolled ? 'shadow-xl' : ''}`}>
        <div className="container mx-auto px-4 lg:px-8 flex items-center justify-between gap-4 lg:gap-8">
          {/* Logo & Location */}
          <div className="flex items-center gap-4 lg:gap-8">
            <Link to="/" className="text-3xl lg:text-4xl font-black tracking-tight cursor-pointer flex items-center">
              <span className="text-[#a111a8] lowercase">zepto</span>
            </Link>
            
            {/* Location */}
            <div className="hidden md:flex flex-col cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-colors">
              <div className="flex items-center gap-1 text-xs font-bold text-gray-500">
                Select Location <ChevronDown size={16} className="text-gray-400" />
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl relative hidden sm:block" ref={searchRef}>
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400">
              {isSearching ? <Loader2 size={24} className="animate-spin" /> : <Search size={22} className="text-gray-400" />}
            </div>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => searchTerm.length >= 2 && setShowSearchResults(true)}
              placeholder='Search for "chocolate box"' 
              className="w-full bg-white border border-gray-200 rounded-2xl py-4 pl-14 pr-10 focus:ring-1 focus:ring-[#a111a8] focus:border-[#a111a8] transition-all outline-none text-gray-700 font-bold text-base lg:text-lg shadow-sm"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 shadow-sm"
              >
                <X size={14} />
              </button>
            )}

            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showSearchResults && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-[calc(100%+12px)] left-0 right-0 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-50 max-h-[400px] overflow-y-auto"
                >
                  {searchResults.length > 0 ? (
                    <div className="py-2">
                      {searchResults.map((product) => (
                        <Link
                          key={product.id}
                          to={`/product/${product.id}`}
                          onClick={() => {
                            setShowSearchResults(false);
                            setSearchTerm('');
                          }}
                          className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0"
                        >
                          <div className="w-14 h-14 bg-white rounded-xl p-1 flex-shrink-0 border border-gray-100">
                            <img src={product.imageUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-800 text-base truncate group-hover:text-[#a111a8] transition-colors">{product.name}</h4>
                            <p className="text-xs text-gray-400 font-bold">{product.unit}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-gray-900 text-lg">₹{product.discountPrice || product.price}</p>
                            {product.discountPrice && (
                              <p className="text-xs text-gray-400 line-through font-bold">₹{product.price}</p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Search size={32} className="text-gray-300" />
                      </div>
                      <p className="text-gray-900 text-lg font-black">No products found for "{searchTerm}"</p>
                      <p className="text-sm text-gray-400 font-bold mt-2">Try searching for something else</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-6 lg:gap-8">
            {user ? (
              <div className="relative">
                <div 
                  className="flex flex-col items-center justify-center cursor-pointer group hover:bg-gray-50 p-2 rounded-xl transition-colors" 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <div className="mb-1">
                    <User size={24} className="text-gray-700 group-hover:text-[#a111a8] transition-colors" />
                  </div>
                  <div className="hidden md:block">
                    <span className="font-bold text-gray-700 group-hover:text-[#a111a8] transition-colors text-xs leading-none">
                      {user.displayName?.split(' ')[0] || 'User'}
                    </span>
                  </div>
                </div>

                <AnimatePresence>
                  {isUserMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-56 bg-white rounded-3xl shadow-2xl border border-gray-100 py-3 z-20"
                      >
                        <Link 
                          to="/order-history" 
                          className="flex items-center gap-3 px-6 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-[#a111a8] transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <History size={18} />
                          My Orders
                        </Link>
                        {isAdmin && (
                          <Link 
                            to="/pos-history" 
                            className="flex items-center gap-3 px-6 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-[#a111a8] transition-colors"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            <ShoppingBag size={18} />
                            POS History
                          </Link>
                        )}
                        {isAdmin && (
                          <Link 
                            to="/admin" 
                            className="flex items-center gap-3 px-6 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-[#a111a8] transition-colors"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            <LayoutDashboard size={18} />
                            Admin Dashboard
                          </Link>
                        )}
                        <div className="h-px bg-gray-100 my-2"></div>
                        <button 
                          onClick={() => {
                            logout();
                            setIsUserMenuOpen(false);
                            navigate('/');
                          }}
                          className="w-full flex items-center gap-3 px-6 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors text-left"
                        >
                          <User size={18} />
                          Logout
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button 
                onClick={async () => {
                  try {
                    await loginWithGoogle();
                  } catch (error: any) {
                    console.error("Login error:", error);
                    if (error.code === 'auth/popup-blocked') {
                      toast.error("Login popup blocked. Please allow popups for this site.");
                    } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                      toast.error("Login cancelled. Please try again.");
                    } else {
                      toast.error("Failed to log in. Please try again.");
                    }
                  }
                }}
                className="flex flex-col items-center justify-center cursor-pointer group hover:bg-gray-50 p-2 rounded-xl transition-colors"
              >
                <div className="mb-1">
                  <User size={24} className="text-gray-700 group-hover:text-[#a111a8] transition-colors" />
                </div>
                <div className="hidden md:block">
                  <span className="font-bold text-gray-700 group-hover:text-[#a111a8] transition-colors text-xs leading-none">
                    Login
                  </span>
                </div>
              </button>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              className="flex flex-col items-center justify-center cursor-pointer group hover:bg-gray-50 p-2 rounded-xl transition-colors relative"
            >
              <div className="mb-1 relative">
                <ShoppingCart size={24} className="text-gray-700 group-hover:text-[#a111a8] transition-colors" />
                {cartItems.length > 0 && (
                  <span className="absolute -top-1 -right-2 bg-[#a111a8] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center border border-white font-bold">
                    {cartItems.length}
                  </span>
                )}
              </div>
              <div className="hidden md:block">
                <span className="font-bold text-gray-700 group-hover:text-[#a111a8] transition-colors text-xs leading-none">
                  Cart
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="sm:hidden px-4 mt-3">
          <div className="relative" ref={searchRef}>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            </div>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => searchTerm.length >= 2 && setShowSearchResults(true)}
              placeholder='Search for "chocolate box"' 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-10 focus:ring-1 focus:ring-[#a111a8] focus:border-[#a111a8] transition-all outline-none text-gray-700 font-bold text-sm"
            />
          </div>
        </div>

        {/* Categories Navigation Bar */}
        <div className="mt-4 border-t border-gray-100 pt-3 w-full">
          <div className="container mx-auto px-4 lg:px-8">
            <nav className="flex items-center gap-6 lg:gap-8 overflow-x-auto no-scrollbar">
              <Link
                to="/"
                className={`flex items-center gap-2 pb-3 px-1 border-b-[3px] transition-all font-bold text-[15px] flex-shrink-0 ${
                  location.pathname === '/' 
                    ? 'border-[#a111a8] text-[#a111a8]' 
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <span className={`${location.pathname === '/' ? 'opacity-100' : 'opacity-70 grayscale'}`}>
                  <ShoppingBag size={18} />
                </span>
                All
              </Link>
              {categories.map((cat) => {
                const isActive = location.pathname === `/category/${cat.id}`;
                return (
                  <Link
                    key={cat.id}
                    to={`/category/${cat.id}`}
                    className={`flex items-center gap-2 pb-3 px-1 border-b-[3px] transition-all font-bold text-[15px] flex-shrink-0 ${
                      isActive 
                        ? 'border-[#a111a8] text-[#a111a8]' 
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span className={`${isActive ? 'opacity-100' : 'opacity-70 grayscale'}`}>
                      <img src={cat.imageUrl} className="w-[18px] opacity-70 mix-blend-multiply" alt="" referrerPolicy="no-referrer" />
                    </span>
                    {cat.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>
      
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      {/* Floating Admin POS Button */}
      {isAdmin && location.pathname !== '/admin' && (
        <button
          onClick={() => navigate('/admin', { state: { activeTab: 'pos' } })}
          className="fixed bottom-6 left-6 z-50 bg-gray-900 text-white p-4 rounded-full shadow-2xl flex items-center gap-3 hover:bg-gray-800 hover:-translate-y-1 transition-all group border-4 border-white"
        >
          <LayoutDashboard size={24} className="text-[#0c831f]" />
          <span className="font-black pr-2 hidden md:block group-hover:text-[#0c831f] transition-colors">Admin POS</span>
        </button>
      )}
    </>
  );
};
