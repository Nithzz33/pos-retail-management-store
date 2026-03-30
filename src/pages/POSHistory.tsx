import React, { useEffect, useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Sale, Product } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Clock, User, Phone, CreditCard, Banknote, Printer, ChevronDown, ChevronUp, Package, Search } from 'lucide-react';
import { format } from 'date-fns';
import { printInvoice } from '../utils/printInvoice';
import { useNavigate } from 'react-router-dom';

const ADMIN_EMAIL = "sainithingowda3714@gmail.com";

export const POSHistory: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!auth.currentUser || !isAdmin) {
      if (!loading) navigate('/');
      return;
    }

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods: Record<string, Product> = {};
      snapshot.docs.forEach(doc => {
        prods[doc.id] = { id: doc.id, ...doc.data() } as Product;
      });
      setProducts(prods);
    });

    // Only admins can see POS history, or if we want to allow staff
    const q = query(
      collection(db, 'store_sales'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeSales = onSnapshot(q, (snapshot) => {
      const saleList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sale[];
      setSales(saleList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'store_sales');
      setLoading(false);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeSales();
    };
  }, []);

  const filteredSales = sales.filter(sale => 
    sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.customerPhone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-gray-900 p-3 rounded-2xl text-white">
              <ShoppingBag size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900">POS Sale History</h1>
              <p className="text-gray-500 font-medium">Manage and track in-store transactions</p>
            </div>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by ID, Name, Phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none font-bold text-sm"
            />
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingBag size={48} className="text-gray-300" />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">No sales found</h2>
            <p className="text-gray-500 font-medium">No in-store transactions match your search criteria.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSales.map((sale) => (
              <motion.div 
                key={sale.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div 
                  className="p-6 cursor-pointer"
                  onClick={() => setExpandedSaleId(expandedSaleId === sale.id ? null : sale.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="bg-gray-50 p-3 rounded-xl">
                        <ShoppingBag size={24} className="text-gray-400" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transaction ID</p>
                        <p className="font-black text-gray-800">#{sale.id.slice(-8).toUpperCase()}</p>
                      </div>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</p>
                          <div className="flex items-center gap-1 font-bold text-gray-700">
                            <User size={14} className="text-gray-400" />
                            {sale.customerName || 'Walk-in Customer'}
                          </div>
                        </div>
                        {sale.customerPhone && (
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phone</p>
                            <div className="flex items-center gap-1 font-bold text-gray-700">
                              <Phone size={14} className="text-gray-400" />
                              {sale.customerPhone}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment</p>
                        <div className="flex items-center gap-1 font-bold text-gray-700 justify-end">
                          {sale.paymentMethod === 'cash' ? <Banknote size={14} className="text-green-500" /> : <CreditCard size={14} className="text-blue-500" />}
                          <span className="capitalize">{sale.paymentMethod}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Amount</p>
                        <p className="text-xl font-black text-gray-900">₹{sale.totalAmount.toFixed(2)}</p>
                      </div>
                      <div className="text-gray-400">
                        {expandedSaleId === sale.id ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      {sale.createdAt?.toDate ? format(sale.createdAt.toDate(), 'MMM dd, yyyy • hh:mm a') : 'Recently'}
                    </div>
                    <span>•</span>
                    <div>{sale.items.length} Items</div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedSaleId === sale.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-50 bg-gray-50/50"
                    >
                      <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Items Summary</h4>
                            <div className="space-y-3">
                              {sale.items.map((item, idx) => {
                                const product = products[item.productId];
                                return (
                                  <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-gray-50 rounded-lg overflow-hidden p-1">
                                        <img src={product?.imageUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                      </div>
                                      <div>
                                        <p className="text-sm font-black text-gray-800">{item.name}</p>
                                        <p className="text-[10px] font-bold text-gray-400">{item.quantity} x ₹{item.price}</p>
                                      </div>
                                    </div>
                                    <p className="font-black text-gray-900">₹{item.subtotal}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-6">
                            <div>
                              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Financial Details</h4>
                              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 font-bold">Subtotal</span>
                                  <span className="font-black text-gray-900">₹{sale.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 font-bold">GST (18%)</span>
                                  <span className="font-black text-gray-900">₹{sale.gstAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-500 font-bold">Discount</span>
                                  <span className="font-black text-red-500">-₹{sale.discount.toFixed(2)}</span>
                                </div>
                                <div className="pt-3 border-t border-dashed border-gray-200 flex justify-between items-center">
                                  <span className="text-gray-900 font-black">Grand Total</span>
                                  <span className="text-2xl font-black text-gray-900">₹{sale.totalAmount.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <button 
                                onClick={() => printInvoice(sale)}
                                className="flex-1 flex items-center justify-center gap-2 bg-gray-900 text-white py-4 rounded-2xl font-black hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/20"
                              >
                                <Printer size={20} /> Print Receipt
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
