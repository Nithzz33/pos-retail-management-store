import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType, onAuthStateChanged } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { CartItem, Product } from '../types';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  totalAmount: number;
  surgeMultiplier: number;
  surgeAmount: number;
  finalAmount: number;
  deliveryFee: number;
  setDeliveryFee: (fee: number) => void;
  riderEarnings: number;
  adminEarnings: number;
  paymentMethod: 'cash' | 'online';
  setPaymentMethod: (method: 'cash' | 'online') => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [user, setUser] = useState(auth.currentUser);
  const [surgeMultiplier, setSurgeMultiplier] = useState(1.0);
  const [riderCount, setRiderCount] = useState(0);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(20);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('online');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Fetch products to map to cart items
    return onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods: Record<string, Product> = {};
      snapshot.docs.forEach(doc => {
        prods[doc.id] = { id: doc.id, ...doc.data() } as Product;
      });
      setProducts(prods);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setCartItems([]);
      return;
    }

    const cartRef = collection(db, `users/${user.uid}/cart`);
    return onSnapshot(cartRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        product: products[doc.data().productId]
      })) as CartItem[];
      setCartItems(items);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/cart`));
  }, [products, user]);

  useEffect(() => {
    // Fetch online riders and pending orders for surge calculation
    const unsubRiders = onSnapshot(collection(db, 'riders'), (snapshot) => {
      const online = snapshot.docs.filter(doc => doc.data().status === 'online').length;
      setRiderCount(online);
    });

    const unsubOrders = onSnapshot(query(collection(db, 'orders'), where('status', '==', 'pending')), (snapshot) => {
      setPendingOrderCount(snapshot.size);
    }, (error) => {
      console.warn("Could not fetch pending orders for surge calculation (expected for non-admins). Using mock value.");
      // Use a mock value for demand if we can't read orders
      setPendingOrderCount(Math.floor(Math.random() * 10) + 1);
    });

    return () => {
      unsubRiders();
      unsubOrders();
    };
  }, []);

  useEffect(() => {
    const fetchSurge = async () => {
      try {
        const response = await fetch('/api/surge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ demand: pendingOrderCount, supply: riderCount })
        });
        const surge = await response.json();
        setSurgeMultiplier(surge.multiplier);
      } catch (error) {
        console.error('Failed to fetch surge:', error);
      }
    };
    
    if (riderCount >= 0) {
      fetchSurge();
    }
  }, [riderCount, pendingOrderCount]);

  const addToCart = async (product: Product) => {
    if (!user) return;
    const existingItem = cartItems.find(item => item.productId === product.id);
    const cartRef = collection(db, `users/${user.uid}/cart`);

    if (product.stock <= 0) {
      throw new Error('Product is out of stock');
    }

    try {
      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
          throw new Error('Cannot add more than available stock');
        }
        await updateDoc(doc(cartRef, existingItem.id), {
          quantity: existingItem.quantity + 1
        });
      } else {
        await addDoc(cartRef, {
          productId: product.id,
          quantity: 1,
          addedAt: new Date()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/cart`);
    }
  };

  const removeFromCart = async (cartItemId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/cart`, cartItemId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/cart/${cartItemId}`);
    }
  };

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    if (!user || quantity < 1) return;
    
    // Find the item to check stock
    const item = cartItems.find(it => it.id === cartItemId);
    if (item && item.product && quantity > item.product.stock) {
      throw new Error('Cannot exceed available stock');
    }

    try {
      await updateDoc(doc(db, `users/${user.uid}/cart`, cartItemId), { quantity });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/cart/${cartItemId}`);
    }
  };

  const clearCart = async () => {
    if (!user) return;
    try {
      const cartRef = collection(db, `users/${user.uid}/cart`);
      const snapshot = await getDocs(cartRef);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/cart`);
    }
  };

  const totalAmount = cartItems.reduce((total, item) => {
    const price = item.product?.discountPrice || item.product?.price || 0;
    return total + (price * item.quantity);
  }, 0);

  const surgeAmount = totalAmount * (surgeMultiplier - 1);
  const finalAmount = totalAmount + surgeAmount;

  const totalDeliveryRevenue = deliveryFee + surgeAmount;
  const riderEarnings = Math.round(totalDeliveryRevenue * 0.8);
  const adminEarnings = totalDeliveryRevenue - riderEarnings;

  // Display the current surge multiplier and surge amount in the cart summary
  console.log(`Cart Summary - Surge Multiplier: ${surgeMultiplier}x, Surge Amount: ₹${surgeAmount.toFixed(2)}`);

  return (
    <CartContext.Provider value={{ 
      cartItems, 
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      clearCart, 
      totalAmount,
      surgeMultiplier,
      surgeAmount,
      finalAmount,
      deliveryFee,
      setDeliveryFee,
      riderEarnings,
      adminEarnings,
      paymentMethod,
      setPaymentMethod
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
