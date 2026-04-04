import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, User, MapPin, ChevronDown, History, LayoutDashboard, Grid, ShoppingBag, X, Loader2 } from 'lucide-react';
import { loginWithGoogle, logout, auth, db, onAuthStateChanged } from '../firebase';
import { collection, onSnapshot, query, orderBy, getDocs, where, limit } from 'firebase/firestore';
import { useCart } from '../context/CartContext';
import { Category, Product } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { CartDrawer } from './CartDrawer';
import { Link, useNavigate } from 'react-router-dom';

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
      <header className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl transition-all duration-300 rounded-full border border-white/20 ${isScrolled ? 'bg-white/70 backdrop-blur-xl shadow-2xl py-2' : 'bg-white/90 backdrop-blur-md shadow-xl py-3'}`}>
        <div className="container mx-auto px-8 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="text-2xl font-black text-[#FF3269] tracking-tighter cursor-pointer">Retail Management Store</Link>
            
            {/* Categories Dropdown */}
            <div className="hidden lg:block relative">
              <button 
                onMouseEnter={() => setIsCategoriesOpen(true)}
                className="flex items-center gap-2 font-black text-gray-800 hover:text-[#FF3269] transition-colors py-2"
              >
                <Grid size={18} />
                Categories
                <ChevronDown size={14} className={`transition-transform ${isCategoriesOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isCategoriesOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    onMouseLeave={() => setIsCategoriesOpen(false)}
                    className="absolute left-0 mt-0 w-[600px] bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-6 z-50 grid grid-cols-3 gap-4"
                  >
                    {categories.map((cat) => (
                      <Link 
                        key={cat.id} 
                        to={`/category/${cat.id}`}
                        onClick={() => setIsCategoriesOpen(false)}
                        className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[#FF3269]/5 group transition-all"
                      >
                        <div className="w-12 h-12 bg-gray-50 rounded-xl p-2 group-hover:bg-white transition-colors">
                          <img src={cat.imageUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <span className="font-bold text-gray-700 group-hover:text-[#FF3269] transition-colors">{cat.name}</span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Location */}
            <div className="hidden md:flex flex-col cursor-pointer">
              <div className="flex items-center gap-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                Delivery in 10 Mins <ChevronDown size={12} />
              </div>
              <div className="flex items-center gap-1 text-sm font-bold text-gray-800">
                <MapPin size={14} className="text-[#FF3269]" />
                Select Address
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl relative" ref={searchRef}>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
            </div>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => searchTerm.length >= 2 && setShowSearchResults(true)}
              placeholder='Search for "milk", "bread", "fruits"...' 
              className="w-full bg-gray-100 border-none rounded-xl py-3 pl-12 pr-10 focus:ring-2 focus:ring-[#FF3269] transition-all outline-none text-gray-700 font-medium"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            )}

            {/* Search Results Dropdown */}
            <AnimatePresence>
              {showSearchResults && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden z-50"
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
                          className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors group"
                        >
                          <div className="w-12 h-12 bg-gray-50 rounded-lg p-1 flex-shrink-0">
                            <img src={product.imageUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-800 text-sm truncate group-hover:text-[#FF3269] transition-colors">{product.name}</h4>
                            <p className="text-xs text-gray-400 font-bold uppercase">{product.unit}</p>
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
          <div className="flex items-center gap-6">
            {user ? (
              <div className="relative">
                <div 
                  className="flex items-center gap-2 cursor-pointer group" 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border-2 border-transparent group-hover:border-[#FF3269] transition-all">
                    <img src={user.photoURL || ''} alt="" referrerPolicy="no-referrer" />
                  </div>
                  <span className="hidden md:block font-bold text-gray-700 group-hover:text-[#FF3269] transition-colors flex items-center gap-1">
                    Account <ChevronDown size={14} />
                  </span>
                </div>

                <AnimatePresence>
                  {isUserMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-48 bg-white/80 backdrop-blur-2xl rounded-2xl shadow-xl border border-white/20 py-2 z-20"
                      >
                        <Link 
                          to="/order-history" 
                          className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-[#FF3269] transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <History size={18} />
                          Online Orders
                        </Link>
                        {isAdmin && (
                          <Link 
                            to="/pos-history" 
                            className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-[#FF3269] transition-colors"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            <ShoppingBag size={18} />
                            POS History
                          </Link>
                        )}
                        {isAdmin && (
                          <Link 
                            to="/admin" 
                            className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-[#FF3269] transition-colors"
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            <LayoutDashboard size={18} />
                            Admin Panel
                          </Link>
                        )}
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
                onClick={() => loginWithGoogle()}
                className="font-bold text-gray-700 hover:text-[#FF3269] transition-colors"
              >
                Login
              </button>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative bg-[#FF3269] text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold hover:bg-[#E62D5E] transition-all shadow-lg shadow-[#FF3269]/20"
            >
              <ShoppingCart size={20} />
              <span className="hidden sm:inline">Cart</span>
              {cartItems.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-black text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                  {cartItems.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
};
