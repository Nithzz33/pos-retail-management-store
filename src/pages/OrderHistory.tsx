import React, { useEffect, useState } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Order, Product } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChevronRight, Clock, MapPin, CheckCircle2, Truck, Navigation, Home, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

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
            <div key={status.id} className="flex flex-col items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${
                isCompleted ? 'bg-[#FF3269] border-[#FF3269] text-white' : 'bg-white border-gray-100 text-gray-300'
              } ${isActive ? 'ring-4 ring-[#FF3269]/20 scale-110' : ''}`}>
                {isCompleted && !isActive ? <CheckCircle2 size={20} /> : <Icon size={20} />}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider text-center max-w-[60px] ${
                isCompleted ? 'text-gray-800' : 'text-gray-400'
              }`}>
                {status.label}
              </span>
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

    if (!auth.currentUser) {
      setLoading(false);
      return () => unsubscribeProducts();
    }

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', auth.currentUser.uid),
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
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF3269]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-[#FF3269]/10 p-3 rounded-2xl text-[#FF3269]">
            <Package size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900">Order History</h1>
            <p className="text-gray-500 font-medium">View and track all your past orders</p>
          </div>
        </div>

        {orders.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100"
          >
            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package size={48} className="text-gray-300" />
            </div>
            <h2 className="text-2xl font-black text-gray-800 mb-2">No orders yet</h2>
            <p className="text-gray-500 font-medium mb-8">Looks like you haven't placed any orders yet. Start shopping to see your history!</p>
            <a 
              href="/"
              className="inline-block bg-[#FF3269] text-white px-8 py-3 rounded-xl font-black hover:bg-[#E62D5E] transition-all"
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
                className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="bg-gray-50 p-3 rounded-xl">
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
                    <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-colors duration-500 ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-600' :
                      order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-blue-100 text-blue-600'
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
                          <h4 className="text-sm font-black text-gray-800 mb-4">Live Tracking</h4>
                          <TrackingProgress currentStatus={order.status} />
                          
                          {/* Simulated Map */}
                          <div className="mt-6 relative h-48 bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
                            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="relative w-full h-full">
                                {/* Path Line */}
                                <svg className="absolute inset-0 w-full h-full">
                                  <path 
                                    d="M 50 150 Q 150 50 350 100" 
                                    fill="none" 
                                    stroke="#FF3269" 
                                    strokeWidth="4" 
                                    strokeDasharray="8 8" 
                                    className="opacity-30"
                                  />
                                </svg>
                                
                                {/* Delivery Partner Icon */}
                                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                  <motion.div 
                                    animate={{ 
                                      x: order.status === 'shipped' ? 150 : 250,
                                      y: order.status === 'shipped' ? 50 : 75
                                    }}
                                    className="absolute p-2 bg-[#FF3269] text-white rounded-full shadow-xl z-10"
                                  >
                                    <Truck size={20} />
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                                  </motion.div>
                                )}

                                {/* Destination Icon */}
                                <div className="absolute right-10 top-20 p-2 bg-gray-800 text-white rounded-full shadow-xl">
                                  <Home size={20} />
                                </div>
                              </div>
                            </div>
                            <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-white/50 shadow-lg flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden">
                                  <img src="https://picsum.photos/seed/delivery/100/100" alt="Delivery Partner" referrerPolicy="no-referrer" />
                                </div>
                                <div>
                                  <p className="text-xs font-black text-gray-800">Rahul Sharma</p>
                                  <p className="text-[10px] font-bold text-gray-500">Your delivery partner</p>
                                </div>
                              </div>
                              <button className="bg-[#FF3269] text-white px-4 py-2 rounded-lg text-xs font-black">Call</button>
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
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button className="flex-1 py-3 border-2 border-gray-100 rounded-xl font-bold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all flex items-center justify-center gap-2">
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
