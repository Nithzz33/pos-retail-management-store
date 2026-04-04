import React, { useState, useEffect } from 'react';
import { X, Trash2, Plus, Minus, ShoppingBag, Loader2, MapPin, Navigation, User as UserIcon, ChevronRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp, writeBatch, doc, increment, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

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
  const { cartItems, removeFromCart, updateQuantity, totalAmount, clearCart, surgeMultiplier, surgeAmount, finalAmount } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [addressType, setAddressType] = useState<'profile' | 'current' | 'manual'>('profile');
  const [manualAddress, setManualAddress] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showAddressSelection, setShowAddressSelection] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.currentUser) {
      const fetchProfile = async () => {
        try {
          const docRef = doc(db, 'users', auth.currentUser!.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            setUserProfile(profile);
            if (profile.address) {
              setAddressType('profile');
            } else {
              setAddressType('manual');
            }
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        }
      };
      fetchProfile();
    }
  }, [isOpen]);

  const fetchCurrentLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeliveryLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setAddressType('current');
        setIsLocating(false);
        toast.success('Location detected!');
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Failed to get current location. Please check permissions.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCheckout = async () => {
    if (!auth.currentUser) {
      toast.error('Please login to place an order');
      return;
    }

    let finalAddress = '';
    if (addressType === 'profile') {
      if (!userProfile?.address) {
        toast.error('No address found in profile. Please enter manually.');
        return;
      }
      finalAddress = userProfile.address;
    } else if (addressType === 'current') {
      if (!deliveryLocation) {
        toast.error('Please detect your location first.');
        return;
      }
      finalAddress = `Current Location (${deliveryLocation.lat.toFixed(4)}, ${deliveryLocation.lng.toFixed(4)})`;
    } else {
      if (!manualAddress.trim()) {
        toast.error('Please enter a delivery address.');
        return;
      }
      finalAddress = manualAddress;
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

      // 3. Handle success
      const handler = async (response: any) => {
        try {
          const batch = writeBatch(db);
          
          // Update stock for each product
          for (const item of cartItems) {
            if (item.product) {
              const productRef = doc(db, 'products', item.productId);
              batch.update(productRef, {
                stock: increment(-item.quantity)
              });
            }
          }

            // Save order to Firestore
            await addDoc(collection(db, 'orders'), {
              userId: auth.currentUser?.uid,
              items: cartItems.map(item => ({
                productId: item.productId,
                name: item.product?.name || 'Unknown Product',
                price: item.product?.discountPrice || item.product?.price || 0,
                quantity: item.quantity
              })),
              totalAmount: finalAmount,
              surgeMultiplier,
              surgeAmount,
              status: 'placed',
              paymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              deliveryAddress: finalAddress,
              deliveryLocation: deliveryLocation || (addressType === 'profile' ? { lat: 12.9716, lng: 77.5946 } : null), // Default to Bangalore if profile
              createdAt: serverTimestamp(),
            });

          await batch.commit();

          toast.success('Order placed successfully!');
          await clearCart();
          onClose();
          navigate('/order-history');
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'orders');
          toast.error('Payment successful but failed to save order. Please contact support.');
        }
      };

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_SOQbAh2VaZaTAd",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Retail Management Store",
        description: "Order Payment",
        order_id: orderData.id,
        handler,
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
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white/80 backdrop-blur-2xl z-[70] shadow-2xl flex flex-col border-l border-white/20"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-transparent sticky top-0">
              <div className="flex items-center gap-3">
                <div className="bg-[#FF3269]/10 p-2 rounded-xl text-[#FF3269] backdrop-blur-md">
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-800">Your Cart</h2>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{cartItems.length} Items</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-32 h-32 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20">
                    <ShoppingBag size={48} className="text-gray-300" />
                  </div>
                  <h3 className="text-xl font-black text-gray-800">Your cart is empty</h3>
                  <p className="text-gray-500 font-medium">Add items to your cart to see them here.</p>
                  <button 
                    onClick={onClose}
                    className="bg-[#FF3269] text-white px-8 py-3 rounded-xl font-black hover:bg-[#E62D5E] transition-all shadow-lg shadow-[#FF3269]/20"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="flex gap-4 group bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-sm hover:shadow-md transition-all">
                    <div className="w-20 h-20 bg-white/40 rounded-xl overflow-hidden flex-shrink-0 border border-white/20">
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
                        <div className="flex items-center bg-white/40 backdrop-blur-sm rounded-lg px-2 py-1 gap-3 border border-white/20">
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
              <div className="p-6 bg-white/40 backdrop-blur-xl border-t border-white/20 space-y-4">
                {/* Address Selection Section */}
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 space-y-3 border border-white/20">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">Delivery Address</h3>
                    <button 
                      onClick={() => setShowAddressSelection(!showAddressSelection)}
                      className="text-[#FF3269] text-xs font-bold hover:underline"
                    >
                      {showAddressSelection ? 'Done' : 'Change'}
                    </button>
                  </div>

                  {showAddressSelection ? (
                    <div className="space-y-3">
                      {userProfile?.address && (
                        <button 
                          onClick={() => setAddressType('profile')}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${addressType === 'profile' ? 'border-[#FF3269] bg-white/60 shadow-md' : 'border-transparent bg-white/20'}`}
                        >
                          <div className={`p-2 rounded-lg ${addressType === 'profile' ? 'bg-[#FF3269] text-white' : 'bg-white/40 text-gray-500'}`}>
                            <UserIcon size={16} />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-black text-gray-800">Profile Address</p>
                            <p className="text-[10px] font-bold text-gray-500 line-clamp-1">{userProfile.address}</p>
                          </div>
                        </button>
                      )}

                      <button 
                        onClick={fetchCurrentLocation}
                        disabled={isLocating}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${addressType === 'current' ? 'border-[#FF3269] bg-white/60 shadow-md' : 'border-transparent bg-white/20'}`}
                      >
                        <div className={`p-2 rounded-lg ${addressType === 'current' ? 'bg-[#FF3269] text-white' : 'bg-white/40 text-gray-500'}`}>
                          {isLocating ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-black text-gray-800">Current Location</p>
                          <p className="text-[10px] font-bold text-gray-500">
                            {deliveryLocation ? `${deliveryLocation.lat.toFixed(4)}, ${deliveryLocation.lng.toFixed(4)}` : 'Detect automatically'}
                          </p>
                        </div>
                      </button>

                      <div className={`p-3 rounded-xl border-2 transition-all ${addressType === 'manual' ? 'border-[#FF3269] bg-white/60 shadow-md' : 'border-transparent bg-white/20'}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg ${addressType === 'manual' ? 'bg-[#FF3269] text-white' : 'bg-white/40 text-gray-500'}`}>
                            <MapPin size={16} />
                          </div>
                          <p className="text-xs font-black text-gray-800">Manual Address</p>
                        </div>
                        <textarea 
                          value={manualAddress}
                          onChange={(e) => {
                            setManualAddress(e.target.value);
                            setAddressType('manual');
                          }}
                          placeholder="Enter your delivery address..."
                          className="w-full bg-transparent text-xs font-bold text-gray-600 focus:outline-none resize-none h-16"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className="bg-[#FF3269] text-white p-2 rounded-lg mt-1 shadow-lg shadow-[#FF3269]/20">
                        {addressType === 'profile' ? <UserIcon size={16} /> : addressType === 'current' ? <Navigation size={16} /> : <MapPin size={16} />}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-black text-gray-800">
                          {addressType === 'profile' ? 'Profile Address' : addressType === 'current' ? 'Current Location' : 'Manual Address'}
                        </p>
                        <p className="text-[10px] font-bold text-gray-500 line-clamp-2">
                          {addressType === 'profile' ? userProfile?.address : addressType === 'current' ? (deliveryLocation ? `${deliveryLocation.lat.toFixed(4)}, ${deliveryLocation.lng.toFixed(4)}` : 'Detecting...') : manualAddress || 'No address entered'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-bold text-gray-500">
                    <span>Item Total</span>
                    <span className="text-gray-900">₹{totalAmount}</span>
                  </div>
                  {surgeMultiplier > 1 && (
                    <div className="flex justify-between text-sm font-bold text-amber-600">
                      <div className="flex items-center gap-1">
                        <span>Surge Pricing ({surgeMultiplier}x)</span>
                      </div>
                      <span>₹{surgeAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-gray-500">
                    <span>Delivery Fee</span>
                    <span className="text-green-600">FREE</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-gray-900 pt-2 border-t border-dashed border-gray-200">
                    <span>Grand Total</span>
                    <span>₹{finalAmount.toFixed(2)}</span>
                  </div>
                </div>
                <button 
                  onClick={handleCheckout}
                  disabled={isProcessing || (addressType === 'manual' && !manualAddress.trim()) || (addressType === 'current' && !deliveryLocation)}
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
