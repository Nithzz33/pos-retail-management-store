import React, { useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { Product, Sale } from '../types';
import { Search, Scan, ShoppingCart, Trash2, Minus, Plus, Banknote, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface StorePOSProps {
  products: Product[];
  onScan: () => void;
  externalBarcode?: string;
}

export const StorePOS: React.FC<StorePOSProps> = ({ products, onScan, externalBarcode }) => {
  const [posCart, setPosCart] = useState<{ product: Product, quantity: number }[]>([]);
  const [posSearch, setPosSearch] = useState('');
  const [isProcessingSale, setIsProcessingSale] = useState(false);

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
  const totalAmount = subtotal + gstAmount;

  const handleStoreCheckout = async (paymentMethod: 'cash' | 'online') => {
    if (posCart.length === 0) return;
    setIsProcessingSale(true);
    const toastId = toast.loading('Processing sale...');

    try {
      const batch = writeBatch(db);
      
      // Update stock for each product
      for (const item of posCart) {
        const productRef = doc(db, 'products', item.product.id);
        batch.update(productRef, {
          stock: item.product.stock - item.quantity
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
        totalAmount,
        paymentMethod,
        createdAt: serverTimestamp(),
        adminId: auth.currentUser?.uid,
        type: 'store'
      };

      await addDoc(collection(db, 'store_sales'), saleData);
      await batch.commit();

      setPosCart([]);
      toast.success('Sale completed successfully!', { id: toastId });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sales');
      toast.error('Failed to process sale', { id: toastId });
    } finally {
      setIsProcessingSale(false);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error('Product out of stock');
      return;
    }
    const existing = posCart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        toast.error('Cannot add more than available stock');
        return;
      }
      setPosCart(posCart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setPosCart([...posCart, { product, quantity: 1 }]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* POS Search & Selection */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex gap-4">
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
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700"
            />
          </div>
          <button 
            onClick={onScan}
            className="bg-gray-900 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-gray-800 transition-all"
          >
            <Scan size={20} /> Scan
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {products
            .filter(p => p.name.toLowerCase().includes(posSearch.toLowerCase()) || p.barcode === posSearch)
            .slice(0, 9)
            .map(product => (
              <button 
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white p-4 rounded-2xl border border-gray-100 hover:border-[#FF3269] hover:shadow-lg transition-all text-left group"
              >
                <div className="aspect-square bg-gray-50 rounded-xl mb-3 overflow-hidden">
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                </div>
                <h4 className="font-black text-gray-800 text-sm line-clamp-1">{product.name}</h4>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs font-bold text-gray-400">{product.unit}</p>
                  <p className="text-xs font-bold text-green-500">Stock: {product.stock}</p>
                </div>
                <p className="text-lg font-black text-[#FF3269] mt-1">₹{product.discountPrice || product.price}</p>
              </button>
            ))}
        </div>
      </div>

      {/* POS Cart & Checkout */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 flex flex-col h-[calc(100vh-200px)]">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xl font-black text-gray-900">Current Sale</h3>
          <button 
            onClick={() => setPosCart([])}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {posCart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
              <ShoppingCart size={48} className="mb-4" />
              <p className="font-black">Cart is empty</p>
            </div>
          ) : (
            posCart.map((item, i) => (
              <div key={i} className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center gap-4 group hover:shadow-md transition-all">
                <div className="w-16 h-16 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 p-2">
                  <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-gray-900 text-sm truncate">{item.product.name}</h4>
                  <p className="text-xs font-bold text-gray-400 uppercase">{item.product.unit}</p>
                  <p className="text-sm font-black text-[#FF3269] mt-1">₹{item.product.discountPrice || item.product.price}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-3 bg-gray-100 rounded-xl p-1 px-2">
                      <button 
                        onClick={() => {
                          if (item.quantity > 1) {
                            setPosCart(posCart.map(it => it.product.id === item.product.id ? { ...it, quantity: it.quantity - 1 } : it));
                          } else {
                            setPosCart(posCart.filter(it => it.product.id !== item.product.id));
                          }
                        }} 
                        className="text-gray-500 hover:text-[#FF3269] transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-black w-6 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => {
                          const product = products.find(p => p.id === item.product.id);
                          if (product && item.quantity >= product.stock) {
                            toast.error('Cannot add more than available stock');
                            return;
                          }
                          setPosCart(posCart.map(it => it.product.id === item.product.id ? { ...it, quantity: it.quantity + 1 } : it));
                        }} 
                        className="text-gray-500 hover:text-[#FF3269] transition-colors"
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
            ))
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-bold">Subtotal</span>
              <span className="font-black text-gray-900">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-bold">GST (18%)</span>
              <span className="font-black text-gray-900">₹{gstAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-gray-900 font-black">Total Amount</span>
              <span className="text-2xl font-black text-[#FF3269]">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button 
              onClick={() => handleStoreCheckout('cash')}
              disabled={posCart.length === 0 || isProcessingSale}
              className="flex flex-col items-center gap-1 bg-white border-2 border-gray-100 p-3 rounded-2xl hover:border-green-500 hover:text-green-600 transition-all disabled:opacity-50"
            >
              <Banknote size={24} />
              <span className="text-xs font-black">Cash</span>
            </button>
            <button 
              onClick={() => handleStoreCheckout('online')}
              disabled={posCart.length === 0 || isProcessingSale}
              className="flex flex-col items-center gap-1 bg-white border-2 border-gray-100 p-3 rounded-2xl hover:border-blue-500 hover:text-blue-600 transition-all disabled:opacity-50"
            >
              <CreditCard size={24} />
              <span className="text-xs font-black">Online</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
