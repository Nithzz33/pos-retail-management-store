import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, Loader2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { cartItems, removeFromCart, updateQuantity, totalAmount, clearCart } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const handleCheckout = async () => {
    if (!auth.currentUser) {
      toast.error('Please login to place an order');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Create order on server
      const response = await fetch('/api/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          currency: 'INR',
        }),
      });

      const orderData = await response.json();

      // 2. Open Razorpay Modal
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_SOQbAh2VaZaTAd",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Retail Management Store",
        description: "Order Payment",
        order_id: orderData.id,
        handler: async (response: any) => {
          // 3. Handle success
          try {
            // Save order to Firestore
            await addDoc(collection(db, 'orders'), {
              userId: auth.currentUser?.uid,
              items: cartItems.map(item => ({
                productId: item.productId,
                name: item.product?.name || 'Unknown Product',
                price: item.product?.discountPrice || item.product?.price || 0,
                quantity: item.quantity
              })),
              totalAmount,
              status: 'placed',
              paymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              deliveryAddress: 'Default Address (Mock)', // In a real app, collect this
              createdAt: serverTimestamp(),
            });

            toast.success('Order placed successfully!');
            await clearCart();
            onClose();
            navigate('/order-history');
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'orders');
            toast.error('Payment successful but failed to save order. Please contact support.');
          }
        },
        prefill: {
          name: auth.currentUser.displayName || '',
          email: auth.currentUser.email || '',
        },
        theme: {
          color: "#FF3269",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to initiate payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0">
              <div className="flex items-center gap-3">
                <div className="bg-[#FF3269]/10 p-2 rounded-xl text-[#FF3269]">
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-800">Your Cart</h2>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{cartItems.length} Items</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-32 h-32 bg-gray-50 rounded-full flex items-center justify-center">
                    <ShoppingBag size={48} className="text-gray-300" />
                  </div>
                  <h3 className="text-xl font-black text-gray-800">Your cart is empty</h3>
                  <p className="text-gray-500 font-medium">Add items to your cart to see them here.</p>
                  <button 
                    onClick={onClose}
                    className="bg-[#FF3269] text-white px-8 py-3 rounded-xl font-black hover:bg-[#E62D5E] transition-all"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="flex gap-4 group">
                    <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                      <img 
                        src={item.product?.imageUrl} 
                        alt={item.product?.name} 
                        className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{item.product?.name}</h4>
                        <p className="text-xs text-gray-500 font-medium">{item.product?.unit}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center bg-gray-100 rounded-lg px-2 py-1 gap-3">
                          <button 
                            onClick={() => item.quantity === 1 ? removeFromCart(item.id) : updateQuantity(item.id, item.quantity - 1)}
                            className="text-gray-500 hover:text-[#FF3269] transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-bold text-sm min-w-[12px] text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="text-gray-500 hover:text-[#FF3269] transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <span className="font-black text-gray-900">₹{(item.product?.discountPrice || item.product?.price || 0) * item.quantity}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="p-2 text-gray-300 hover:text-red-500 transition-colors self-start"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="p-6 bg-white border-t border-gray-100 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-bold text-gray-500">
                    <span>Item Total</span>
                    <span>₹{totalAmount}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-gray-500">
                    <span>Delivery Fee</span>
                    <span className="text-green-600">FREE</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-gray-900 pt-2 border-t border-dashed border-gray-200">
                    <span>Grand Total</span>
                    <span>₹{totalAmount}</span>
                  </div>
                </div>
                <button 
                  onClick={handleCheckout}
                  disabled={isProcessing}
                  className="w-full bg-[#FF3269] text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-[#FF3269]/20 hover:bg-[#E62D5E] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="animate-spin" size={24} />
                      Processing...
                    </>
                  ) : (
                    'Proceed to Checkout'
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
