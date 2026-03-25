import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, User, MapPin, ChevronDown, History, LayoutDashboard, Grid } from 'lucide-react';
import { loginWithGoogle, logout, auth, db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useCart } from '../context/CartContext';
import { Category } from '../types';
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
  const navigate = useNavigate();

  const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;

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
      <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${isScrolled ? 'bg-white shadow-md py-2' : 'bg-white py-4'}`}>
        <div className="container mx-auto px-4 flex items-center justify-between gap-4">
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
                    className="absolute left-0 mt-0 w-[600px] bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 z-50 grid grid-cols-3 gap-4"
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
          <div className="flex-1 max-w-2xl relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Search size={20} />
            </div>
            <input 
              type="text" 
              placeholder='Search for "milk"' 
              className="w-full bg-gray-100 border-none rounded-xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-[#FF3269] transition-all outline-none text-gray-700"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-6">
            {auth.currentUser ? (
              <div className="relative">
                <div 
                  className="flex items-center gap-2 cursor-pointer group" 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden border-2 border-transparent group-hover:border-[#FF3269] transition-all">
                    <img src={auth.currentUser.photoURL || ''} alt="" referrerPolicy="no-referrer" />
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
                        className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-20"
                      >
                        <Link 
                          to="/order-history" 
                          className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-[#FF3269] transition-colors"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <History size={18} />
                          Orders
                        </Link>
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
