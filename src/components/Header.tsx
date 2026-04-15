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
      <header className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 border-b border-gray-100 ${isScrolled ? 'bg-white shadow-md py-2' : 'bg-white py-3'}`}>
        <div className="container mx-auto px-4 lg:px-8 flex items-center justify-between gap-4 lg:gap-8">
          {/* Logo & Location */}
          <div className="flex items-center gap-4 lg:gap-8">
            <Link to="/" className="text-2xl lg:text-3xl font-black tracking-tighter cursor-pointer flex items-center">
              <span className="text-[#f8cb46]">blink</span><span className="text-[#0c831f]">it</span>
            </Link>
            
            {/* Location */}
            <div className="hidden md:flex flex-col cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-colors">
              <div className="flex items-center gap-1 text-[10px] lg:text-xs font-black text-gray-800 uppercase tracking-wider">
                Delivery in 8 Mins <ChevronDown size={14} className="text-[#0c831f]" />
              </div>
              <div className="flex items-center gap-1 text-xs lg:text-sm font-medium text-gray-500 truncate max-w-[200px]">
                <MapPin size={14} className="text-[#0c831f] flex-shrink-0" />
                <span className="truncate">Select your delivery location</span>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-3xl relative hidden sm:block" ref={searchRef}>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            </div>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => searchTerm.length >= 2 && setShowSearchResults(true)}
              placeholder='Search for "milk", "bread", "fruits"...' 
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3.5 pl-12 pr-10 focus:ring-2 focus:ring-[#0c831f]/20 focus:border-[#0c831f] transition-all outline-none text-gray-700 font-medium text-sm lg:text-base"
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
                  className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 max-h-[400px] overflow-y-auto"
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
                          className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0"
                        >
                          <div className="w-12 h-12 bg-white rounded-lg p-1 flex-shrink-0 border border-gray-100">
                            <img src={product.imageUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-800 text-sm truncate group-hover:text-[#0c831f] transition-colors">{product.name}</h4>
                            <p className="text-xs text-gray-400 font-medium">{product.unit}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-gray-900">₹{product.discountPrice || product.price}</p>
                            {product.discountPrice && (
                              <p className="text-[10px] text-gray-400 line-through">₹{product.price}</p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Search size={24} className="text-gray-300" />
                      </div>
                      <p className="text-gray-500 font-bold">No products found for "{searchTerm}"</p>
                      <p className="text-xs text-gray-400 mt-1">Try searching for something else</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 lg:gap-6">
            {user ? (
              <div className="relative">
                <div 
                  className="flex items-center gap-2 cursor-pointer group hover:bg-gray-50 p-2 rounded-xl transition-colors" 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border border-gray-200">
                    <img src={user.photoURL || ''} alt="" referrerPolicy="no-referrer" />
                  </div>
                  <div className="hidden md:block">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block leading-none">Account</span>
                    <span className="font-bold text-gray-700 group-hover:text-[#0c831f] transition-colors flex items-center gap-1 text-sm leading-none mt-1">
                      {user.displayName?.split(' ')[0] || 'User'} <ChevronDown size={14} />
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
                        className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-20"
                      >
                        <Link 
                          to="/order-history" 
                          className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-[#0c831f] transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <History size={18} />
                          My Orders
                        </Link>
                        {isAdmin && (
                          <Link 
                            to="/pos-history" 
                            className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-[#0c831f] transition-colors"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            <ShoppingBag size={18} />
                            POS History
                          </Link>
                        )}
                        {isAdmin && (
                          <Link 
                            to="/admin" 
                            className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-[#0c831f] transition-colors"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            <LayoutDashboard size={18} />
                            Admin Dashboard
                          </Link>
                        )}
                        <div className="h-px bg-gray-100 my-1"></div>
                        <button 
                          onClick={() => {
                            logout();
                            setIsUserMenuOpen(false);
                            navigate('/');
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors text-left"
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
                className="font-bold text-gray-700 hover:text-[#0c831f] transition-colors px-4 py-2 hover:bg-gray-50 rounded-xl"
              >
                Login
              </button>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              className="bg-[#0c831f] text-white px-4 lg:px-5 py-2.5 lg:py-3 rounded-2xl flex items-center gap-3 font-black hover:bg-[#0a6c19] transition-all shadow-lg shadow-[#0c831f]/20 hover:shadow-[#0c831f]/40 hover:-translate-y-0.5"
            >
              <ShoppingCart size={20} />
              <div className="hidden sm:flex flex-col items-start leading-none">
                <span className="text-[10px] text-white/80 uppercase tracking-wider">My Cart</span>
                <span className="text-sm">
                  {cartItems.length > 0 ? `₹${totalAmount}` : 'Empty'}
                </span>
              </div>
              {cartItems.length > 0 && (
                <span className="sm:hidden absolute -top-2 -right-2 bg-gray-900 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {cartItems.length}
                </span>
              )}
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
              placeholder='Search for "milk", "bread"...' 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-10 focus:ring-2 focus:ring-[#0c831f]/20 focus:border-[#0c831f] transition-all outline-none text-gray-700 font-medium text-sm"
            />
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
