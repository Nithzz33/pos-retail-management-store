import React, { useEffect, useState } from 'react';
import { db, auth, handleFirestoreError, OperationType, onAuthStateChanged } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Order, Product } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronRight, Clock, MapPin, CheckCircle2, Truck, Navigation, Home, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { printInvoice } from '../utils/printInvoice';

const ORDER_STATUSES = [
  { id: 'placed', label: 'Order Placed', icon: Package },
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'processing', label: 'Processing', icon: Clock },
  { id: 'shipped', label: 'Shipped', icon: Truck },
  { id: 'out_for_delivery', label: 'Out for Delivery', icon: Navigation },
  { id: 'delivered', label: 'Delivered', icon: Home },
];

const TrackingProgress: React.FC<{ currentStatus: string }> = ({ currentStatus }) => {
  if (currentStatus === 'cancelled') {
    return (
      <div className="py-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-black uppercase tracking-wider">
          <XCircle size={20} />
          Order Cancelled
        </div>
      </div>
    );
  }

  const currentIndex = ORDER_STATUSES.findIndex(s => s.id === currentStatus);
  const progressWidth = currentIndex === -1 ? 0 : (currentIndex / (ORDER_STATUSES.length - 1)) * 100;
  
  return (
    <div className="py-8">
      <div className="relative flex justify-between">
        {/* Progress Line */}
        <div className="absolute top-5 left-0 w-full h-1 bg-gray-100 -z-10">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressWidth}%` }}
            className="h-full bg-[#FF3269] transition-all duration-500"
          />
        </div>

        {ORDER_STATUSES.map((status, index) => {
          const Icon = status.icon;
          const isCompleted = index <= currentIndex;
          const isActive = index === currentIndex;

          return (
            <div key={status.id} className="flex flex-col items-center gap-2 relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500 relative z-10 ${
                isCompleted ? 'bg-[#FF3269] border-[#FF3269] text-white' : 'bg-white border-gray-100 text-gray-300'
              } ${isActive ? 'ring-4 ring-[#FF3269]/20 scale-110 shadow-lg shadow-[#FF3269]/20' : ''}`}>
                {isCompleted && !isActive ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                
                {isActive && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                    className="absolute inset-0 bg-[#FF3269] rounded-full -z-10"
                  />
                )}
              </div>
              <div className="flex flex-col items-center">
                <span className={`text-[10px] font-black uppercase tracking-wider text-center max-w-[60px] leading-tight ${
                  isCompleted ? 'text-gray-800' : 'text-gray-400'
                }`}>
                  {status.label}
                </span>
                {isActive && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[8px] font-black text-[#FF3269] uppercase tracking-tighter mt-0.5"
                  >
                    Live
                  </motion.span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const OrderHistory: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [user, setUser] = useState(auth.currentUser);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    
    setCancellingId(orderId);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'cancelled'
      });
      toast.success('Order cancelled successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
      toast.error('Failed to cancel order');
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods: Record<string, Product> = {};
      snapshot.docs.forEach(doc => {
        prods[doc.id] = { id: doc.id, ...doc.data() } as Product;
      });
      setProducts(prods);
    });

    if (!isAuthReady) {
      return () => unsubscribeProducts();
    }

    if (!user) {
      setLoading(false);
      return () => unsubscribeProducts();
    }

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeOrders = onSnapshot(q, (snapshot) => {
      const orderList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      setOrders(orderList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeOrders();
    };
  }, [user, isAuthReady]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF3269]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center gap-4 mb-8 bg-white/40 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-sm">
          <div className="bg-[#FF3269]/10 p-3 rounded-2xl text-[#FF3269] backdrop-blur-sm">
            <Package size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900">Online Order History</h1>
            <p className="text-gray-500 font-medium">View and track all your past online orders</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/40 backdrop-blur-md rounded-3xl p-12 text-center border border-white/20 shadow-sm"
          >
            <div className="w-24 h-24 bg-white/40 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
              <Package size={48} className="text-gray-300" />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">No orders yet</h2>
            <p className="text-gray-500 font-medium mb-8">Looks like you haven't placed any orders yet. Start shopping to see your history!</p>
            <a 
              href="/"
              className="inline-block bg-[#FF3269] text-white px-8 py-3 rounded-xl font-black hover:bg-[#E62D5E] transition-all shadow-lg shadow-[#FF3269]/20"
            >
              Start Shopping
            </a>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <motion.div 
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/40 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="bg-white/40 p-3 rounded-xl backdrop-blur-sm">
                      <Package size={24} className="text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Order ID</p>
                      <p className="font-black text-gray-800">#{order.id.slice(-8).toUpperCase()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date</p>
                      <div className="flex items-center gap-1 font-bold text-gray-700">
                        <Clock size={14} />
                        {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMM dd, yyyy') : 'Recently'}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total</p>
                      <p className="font-black text-[#FF3269] text-lg">₹{order.totalAmount}</p>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-colors duration-500 backdrop-blur-sm ${
                      order.status === 'delivered' ? 'bg-green-100/50 text-green-600' :
                      order.status === 'cancelled' ? 'bg-red-100/50 text-red-600' :
                      'bg-blue-100/50 text-blue-600'
                    }`}>
                      {order.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3 text-gray-600">
                    <MapPin size={18} className="mt-0.5 flex-shrink-0" />
                    <p className="text-sm font-medium">{order.deliveryAddress}</p>
                  </div>

                  <AnimatePresence>
                    {expandedOrderId === order.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 border-t border-gray-50">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-black text-gray-800">Live Tracking</h4>
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                              </span>
                              <span className="text-[10px] font-black text-green-500 uppercase tracking-wider">Live Updates</span>
                            </div>
                          </div>
                          
                          <TrackingProgress currentStatus={order.status} />
                          
                          {/* Status Description Card */}
                          <div className="mt-4 p-4 bg-white/40 backdrop-blur-md rounded-2xl border border-white/20 flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/40 rounded-xl flex items-center justify-center text-[#FF3269] shadow-sm backdrop-blur-sm">
                              {ORDER_STATUSES.find(s => s.id === order.status)?.icon({ size: 24 }) || <Package size={24} />}
                            </div>
                            <div>
                              <p className="text-sm font-black text-gray-800">
                                {ORDER_STATUSES.find(s => s.id === order.status)?.label || 'Order Update'}
                              </p>
                              <p className="text-xs font-medium text-gray-500">
                                {order.status === 'placed' ? 'Your order has been successfully placed and is awaiting confirmation.' :
                                 order.status === 'pending' ? 'Store is reviewing your order details.' :
                                 order.status === 'processing' ? 'Your items are being carefully picked and packed.' :
                                 order.status === 'shipped' ? 'Your order has left the store and is on its way.' :
                                 order.status === 'out_for_delivery' ? 'Our delivery partner is nearby and will arrive shortly.' :
                                 order.status === 'delivered' ? 'Order delivered! Enjoy your fresh groceries.' :
                                 'Order status updated.'}
                              </p>
                            </div>
                          </div>
                          
                          {/* Simulated Map */}
                          <div className="mt-6 relative h-56 bg-white/20 backdrop-blur-md rounded-3xl overflow-hidden border border-white/20">
                            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="relative w-full h-full">
                                {/* Path Line */}
                                <svg className="absolute inset-0 w-full h-full">
                                  <path 
                                    d="M 50 180 Q 150 50 350 120" 
                                    fill="none" 
                                    stroke="#FF3269" 
                                    strokeWidth="4" 
                                    strokeDasharray="8 8" 
                                    className="opacity-20"
                                  />
                                </svg>
                                
                                {/* Delivery Partner Icon */}
                                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                  <motion.div 
                                    animate={{ 
                                      x: order.status === 'placed' || order.status === 'pending' ? 50 :
                                         order.status === 'processing' ? 100 :
                                         order.status === 'shipped' ? 200 :
                                         order.status === 'out_for_delivery' ? 300 : 350,
                                      y: order.status === 'placed' || order.status === 'pending' ? 180 :
                                         order.status === 'processing' ? 120 :
                                         order.status === 'shipped' ? 60 :
                                         order.status === 'out_for_delivery' ? 90 : 120
                                    }}
                                    transition={{ type: "spring", stiffness: 50, damping: 15 }}
                                    className="absolute p-2 bg-[#FF3269] text-white rounded-full shadow-2xl z-20"
                                  >
                                    <Truck size={24} />
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                                  </motion.div>
                                )}
 
                                {/* Destination Icon */}
                                <div className="absolute right-10 top-24 p-3 bg-gray-900 text-white rounded-full shadow-2xl z-10">
                                  <Home size={24} />
                                </div>
                              </div>
                            </div>
                            
                            {/* Delivery Partner Details Overlay */}
                            <div className="absolute bottom-4 left-4 right-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-xl flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white/40 rounded-full overflow-hidden border-2 border-white shadow-sm backdrop-blur-sm">
                                  <img src="https://picsum.photos/seed/delivery/100/100" alt="Delivery Partner" referrerPolicy="no-referrer" />
                                </div>
                                <div>
                                  <p className="text-sm font-black text-gray-800">Rahul Sharma</p>
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-bold text-gray-500">Delivery Partner • </span>
                                    <span className="text-[10px] font-black text-green-500">4.9 ★</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button className="bg-gray-100 text-gray-800 px-4 py-2 rounded-xl text-xs font-black hover:bg-gray-200 transition-colors">Message</button>
                                <button className="bg-[#FF3269] text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-[#E62D5E] transition-colors">Call</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="bg-gray-50 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Items</p>
                      <button 
                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                        className="text-[#FF3269] text-xs font-black flex items-center gap-1"
                      >
                        {expandedOrderId === order.id ? 'Hide Tracking' : 'Track Order'}
                        {expandedOrderId === order.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                    <div className="space-y-3">
                      {order.items.map((item, idx) => {
                        const product = products[item.productId];
                        return (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-white rounded-xl overflow-hidden border border-gray-100 flex-shrink-0 flex items-center justify-center p-1">
                                {product?.imageUrl ? (
                                  <img 
                                    src={product.imageUrl} 
                                    alt={item.name} 
                                    className="w-full h-full object-contain"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <Package size={20} className="text-gray-200" />
                                )}
                              </div>
                              <span className="font-bold text-gray-700">
                                {item.quantity}x <span className="font-medium text-gray-600 ml-1">{item.name}</span>
                              </span>
                            </div>
                            <span className="font-black text-gray-800">₹{item.price * item.quantity}</span>
                          </div>
                        );
                      })}
                      {order.deliveryFee !== undefined && (
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
                          <span className="font-bold text-gray-500">Delivery Fee</span>
                          <span className="font-black text-gray-800">₹{order.deliveryFee}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button 
                    onClick={() => printInvoice(order)}
                    className="flex-1 py-3 border-2 border-gray-100 rounded-xl font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all flex items-center justify-center gap-2"
                  >
                    View Invoice <ChevronRight size={18} />
                  </button>
                  
                  {(order.status === 'pending' || 
                    order.status === 'processing') && (
                    <button 
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={cancellingId === order.id}
                      className="flex-1 py-3 border-2 border-red-50 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {cancellingId === order.id ? (
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <XCircle size={18} />
                      )}
                      Cancel Order
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
