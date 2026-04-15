import React, { useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, writeBatch, increment } from 'firebase/firestore';
import { Product, Sale } from '../types';
import { Search, Scan, ShoppingCart, Trash2, Minus, Plus, Banknote, CreditCard, Loader2, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import { printInvoice } from '../utils/printInvoice';
import { motion, AnimatePresence } from 'framer-motion';

interface StorePOSProps {
  products: Product[];
  onScan: () => void;
  externalBarcode?: string;
}

export const StorePOS: React.FC<StorePOSProps> = ({ products, onScan, externalBarcode }) => {
  const [posCart, setPosCart] = useState<{ product: Product, quantity: number }[]>([]);
  const [posSearch, setPosSearch] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);

  React.useEffect(() => {
    if (externalBarcode) {
      const product = products.find(p => p.barcode === externalBarcode);
      if (product) {
        addToCart(product);
      } else {
        toast.error('Product not found');
      }
    }
  }, [externalBarcode]);

  const subtotal = posCart.reduce((sum, item) => sum + (item.product.discountPrice || item.product.price) * item.quantity, 0);
  const gstAmount = subtotal * 0.18;
  const totalAmount = Math.max(0, subtotal + gstAmount - discount);

  const handleStoreCheckout = async (paymentMethod: 'cash' | 'online', paymentId?: string) => {
    if (posCart.length === 0) return;
    setIsProcessingSale(true);
    const toastId = toast.loading('Processing sale...');

    try {
      // Final stock validation before processing
      for (const item of posCart) {
        const currentProduct = products.find(p => p.id === item.product.id);
        if (!currentProduct || currentProduct.stock < item.quantity) {
          toast.error(`Insufficient stock for ${item.product.name}. Available: ${currentProduct?.stock || 0}`, { id: toastId });
          setIsProcessingSale(false);
          return;
        }
      }

      const batch = writeBatch(db);
      
      // Update stock for each product
      for (const item of posCart) {
        const productRef = doc(db, 'products', item.product.id);
        batch.update(productRef, {
          stock: increment(-item.quantity)
        });
      }

      // Record the sale
      const saleData = {
        items: posCart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.product.discountPrice || item.product.price,
          subtotal: (item.product.discountPrice || item.product.price) * item.quantity
        })),
        subtotal,
        gstAmount,
        discount,
        totalAmount,
        paymentMethod,
        paymentId,
        customerName,
        customerPhone,
        createdAt: serverTimestamp(),
        adminId: auth.currentUser?.uid,
        type: 'store' as const
      };

      const docRef = await addDoc(collection(db, 'store_sales'), saleData);
      await batch.commit();

      const completedSale = { id: docRef.id, ...saleData } as Sale;
      setLastSale(completedSale);
      setPosCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscount(0);
      
      toast.success('Sale completed successfully!', { 
        id: toastId,
        action: {
          label: 'Print Receipt',
          onClick: () => printInvoice(completedSale)
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales');
      toast.error('Failed to process sale', { id: toastId });
    } finally {
      setIsProcessingSale(false);
    }
  };

  const handleRazorpayPayment = () => {
    if (posCart.length === 0) return;
    
    // Check if Razorpay is loaded
    if (!(window as any).Razorpay) {
      toast.error('Razorpay SDK not loaded. Please check your connection.');
      return;
    }

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: Math.round(totalAmount * 100), // in paise
      currency: "INR",
      name: "Retail Store POS",
      description: "POS Sale Payment",
      handler: function (response: any) {
        handleStoreCheckout('online', response.razorpay_payment_id);
      },
      prefill: {
        name: customerName,
        contact: customerPhone
      },
      theme: {
        color: "#0c831f"
      }
    };
    
    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  const addToCart = (product: Product) => {
    // Always use the latest product data from the products prop
    const latestProduct = products.find(p => p.id === product.id) || product;
    
    if (latestProduct.stock <= 0) {
      toast.error(`${latestProduct.name} is out of stock`);
      return;
    }
    const existing = posCart.find(item => item.product.id === latestProduct.id);
    if (existing) {
      if (existing.quantity >= latestProduct.stock) {
        toast.error(`Cannot add more than available stock for ${latestProduct.name} (Stock: ${latestProduct.stock})`);
        return;
      }
      setPosCart(posCart.map(item => item.product.id === latestProduct.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setPosCart([...posCart, { product: latestProduct, quantity: 1 }]);
    }
  };

  return (
    <div className="relative h-full">
      {/* POS Search & Selection */}
      <div className="space-y-6">
        <div className="bg-white/40 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-sm flex gap-4 sticky top-0 z-10">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              value={posSearch}
              onChange={(e) => {
                const val = e.target.value;
                setPosSearch(val);
                // Quick add if exact barcode match
                const product = products.find(p => p.barcode === val);
                if (product) {
                  addToCart(product);
                  setPosSearch(''); // Clear search after successful barcode match
                }
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && posSearch) {
                  const product = products.find(p => p.name.toLowerCase().includes(posSearch.toLowerCase()) || p.barcode === posSearch);
                  if (product) {
                    addToCart(product);
                    setPosSearch('');
                  }
                }
              }}
              placeholder="Search by name or barcode..." 
              className="w-full pl-12 pr-4 py-3 bg-white/40 backdrop-blur-sm border border-white/10 rounded-2xl focus:ring-2 focus:ring-[#0c831f] outline-none font-bold text-gray-700"
            />
          </div>
          <button 
            onClick={onScan}
            className="bg-gray-900/80 backdrop-blur-sm text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-gray-900 transition-all"
          >
            <Scan size={20} /> Scan
          </button>
          {posCart.length > 0 && (
            <button 
              onClick={() => setIsCartOpen(true)}
              className="bg-[#0c831f] text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-lg shadow-[#0c831f]/20 hover:bg-[#0a6c19] transition-all relative"
            >
              <ShoppingCart size={20} />
              <span>View Cart</span>
              <span className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border-2 border-white">
                {posCart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-24">
          {products
            .filter(p => p.name.toLowerCase().includes(posSearch.toLowerCase()) || p.barcode === posSearch)
            .map(product => (
              <button 
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/20 hover:border-[#0c831f] hover:shadow-lg transition-all text-left group"
              >
                <div className="aspect-square bg-white/40 rounded-xl mb-3 overflow-hidden backdrop-blur-sm">
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                </div>
                <h4 className="font-black text-gray-800 text-sm line-clamp-1">{product.name}</h4>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs font-bold text-gray-400">{product.unit}</p>
                  <p className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${product.stock > 10 ? 'bg-green-100/50 text-green-600' : product.stock > 0 ? 'bg-yellow-100/50 text-yellow-600' : 'bg-red-100/50 text-red-600'} backdrop-blur-sm`}>
                    Stock: {product.stock}
                  </p>
                </div>
                <p className="text-lg font-black text-[#0c831f] mt-1">₹{product.discountPrice || product.price}</p>
              </button>
            ))}
        </div>
      </div>

      {/* POS Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[80]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white/80 backdrop-blur-2xl shadow-2xl z-[90] flex flex-col border-l border-white/20"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/40 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#0c831f] text-white rounded-xl flex items-center justify-center shadow-lg shadow-[#0c831f]/20">
                    <ShoppingCart size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-900">Store Cart</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transaction Mode</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      if (window.confirm('Clear entire cart?')) {
                        setPosCart([]);
                        setCustomerName('');
                        setCustomerPhone('');
                        setDiscount(0);
                      }
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Clear Cart"
                  >
                    <Trash2 size={20} />
                  </button>
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="w-10 h-10 rounded-full bg-white/40 backdrop-blur-sm shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all border border-white/20"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6 border-b border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-wider">Customer Details</p>
                  <button className="text-[#0c831f] text-[10px] font-black hover:underline uppercase">Search Customer</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <input 
                      type="text" 
                      placeholder="Name" 
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-4 py-2 bg-white/40 backdrop-blur-sm border border-white/10 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#0c831f] outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <input 
                      type="text" 
                      placeholder="Phone" 
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-4 py-2 bg-white/40 backdrop-blur-sm border border-white/10 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#0c831f] outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {posCart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                    <ShoppingCart size={64} className="mb-4 text-gray-400" />
                    <p className="text-xl font-black text-gray-400">Your cart is empty</p>
                    <p className="text-sm font-bold text-gray-300">Add products to start a sale</p>
                  </div>
                ) : (
                  posCart.map((item, i) => {
                    const latestProduct = products.find(p => p.id === item.product.id);
                    const isOverStock = latestProduct && item.quantity > latestProduct.stock;
                    
                    return (
                      <div key={i} className={`bg-white/40 backdrop-blur-md p-3 rounded-2xl border transition-all flex items-center gap-4 group hover:shadow-md ${isOverStock ? 'border-red-500 bg-red-50/30' : 'border-white/10'}`}>
                        <div className="w-16 h-16 bg-white/40 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 p-2 backdrop-blur-sm">
                          <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-gray-900 text-sm truncate">{item.product.name}</h4>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-gray-400 uppercase">{item.product.unit}</p>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${latestProduct && latestProduct.stock > 0 ? 'bg-white/40 text-gray-600' : 'bg-red-100/50 text-red-600'} backdrop-blur-sm`}>
                              Stock: {latestProduct?.stock || 0}
                            </span>
                          </div>
                          <p className="text-sm font-black text-[#0c831f] mt-1">₹{item.product.discountPrice || item.product.price}</p>
                          {isOverStock && (
                            <p className="text-[10px] font-black text-red-500 mt-1 uppercase tracking-tighter">Exceeds available stock!</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-3 bg-white/40 backdrop-blur-sm rounded-xl p-1 px-2 border border-white/10">
                              <button 
                                onClick={() => {
                                  if (item.quantity > 1) {
                                    setPosCart(posCart.map(it => it.product.id === item.product.id ? { ...it, quantity: it.quantity - 1 } : it));
                                  } else {
                                    setPosCart(posCart.filter(it => it.product.id !== item.product.id));
                                  }
                                }} 
                                className="text-gray-500 hover:text-[#0c831f] transition-colors"
                              >
                                <Minus size={14} />
                              </button>
                              <span className={`text-sm font-black w-6 text-center ${isOverStock ? 'text-red-600' : ''}`}>{item.quantity}</span>
                              <button 
                                onClick={() => {
                                  if (latestProduct && item.quantity >= latestProduct.stock) {
                                    toast.error(`Cannot add more than available stock for ${item.product.name}`);
                                    return;
                                  }
                                  setPosCart(posCart.map(it => it.product.id === item.product.id ? { ...it, quantity: it.quantity + 1 } : it));
                                }} 
                                className="text-gray-500 hover:text-[#0c831f] transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                            <button 
                              onClick={() => setPosCart(posCart.filter(it => it.product.id !== item.product.id))}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <p className="text-xs font-black text-gray-900">₹{(item.product.discountPrice || item.product.price) * item.quantity}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-6 border-t border-white/10 bg-white/40 backdrop-blur-sm space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-bold">Subtotal</span>
                    <span className="font-black text-gray-900">₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-bold">GST (18%)</span>
                    <span className="font-black text-gray-900">₹{gstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-bold">Discount (₹)</span>
                    <input 
                      type="number" 
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      className="w-24 px-2 py-1 bg-white/40 backdrop-blur-sm border border-white/10 rounded-lg text-right font-black text-[#0c831f] focus:ring-2 focus:ring-[#0c831f] outline-none"
                    />
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-white/10">
                    <span className="text-gray-900 font-black text-lg">Total Amount</span>
                    <span className="text-3xl font-black text-[#0c831f]">₹{totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  {lastSale && (
                    <button 
                      onClick={() => printInvoice(lastSale)}
                      className="col-span-2 flex items-center justify-center gap-2 bg-blue-100/50 text-blue-600 p-4 rounded-2xl hover:bg-blue-100 transition-all font-black text-sm mb-2 backdrop-blur-sm border border-blue-200/50"
                    >
                      <Printer size={20} /> Print Last Receipt
                    </button>
                  )}
                  <button 
                    onClick={() => handleStoreCheckout('cash')}
                    disabled={posCart.length === 0 || isProcessingSale}
                    className="flex flex-col items-center gap-2 bg-white/40 backdrop-blur-sm border-2 border-white/10 p-4 rounded-2xl hover:border-green-500 hover:text-green-600 transition-all disabled:opacity-50 group"
                  >
                    <Banknote size={28} className="group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-wider">Cash Payment</span>
                  </button>
                  <button 
                    onClick={handleRazorpayPayment}
                    disabled={posCart.length === 0 || isProcessingSale}
                    className="flex flex-col items-center gap-2 bg-white/40 backdrop-blur-sm border-2 border-white/10 p-4 rounded-2xl hover:border-blue-500 hover:text-blue-600 transition-all disabled:opacity-50 group"
                  >
                    <CreditCard size={28} className="group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-wider">Online Pay</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Cart Button for Mobile/Quick Access */}
      {posCart.length > 0 && !isCartOpen && (
        <motion.button
          initial={{ scale: 0, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsCartOpen(true)}
          className="fixed bottom-8 right-28 bg-[#0c831f] text-white p-5 rounded-full shadow-2xl z-50 flex items-center gap-3 group"
        >
          <div className="relative">
            <ShoppingCart size={28} />
            <span className="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black border-2 border-[#0c831f]">
              {posCart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          </div>
          <div className="text-left pr-2">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Checkout</p>
            <p className="text-lg font-black leading-none">₹{totalAmount.toFixed(0)}</p>
          </div>
        </motion.button>
      )}
    </div>
  );
};
