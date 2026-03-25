import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { CartItem, Product } from '../types';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  totalAmount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});

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
    if (!auth.currentUser) {
      setCartItems([]);
      return;
    }

    const cartRef = collection(db, `users/${auth.currentUser.uid}/cart`);
    return onSnapshot(cartRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        product: products[doc.data().productId]
      })) as CartItem[];
      setCartItems(items);
    }, (error) => handleFirestoreError(error, OperationType.LIST, `users/${auth.currentUser?.uid}/cart`));
  }, [products, auth.currentUser]);

  const addToCart = async (product: Product) => {
    if (!auth.currentUser) return;
    const existingItem = cartItems.find(item => item.productId === product.id);
    const cartRef = collection(db, `users/${auth.currentUser.uid}/cart`);

    try {
      if (existingItem) {
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
      handleFirestoreError(error, OperationType.WRITE, `users/${auth.currentUser.uid}/cart`);
    }
  };

  const removeFromCart = async (cartItemId: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, `users/${auth.currentUser.uid}/cart`, cartItemId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${auth.currentUser.uid}/cart/${cartItemId}`);
    }
  };

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    if (!auth.currentUser || quantity < 1) return;
    try {
      await updateDoc(doc(db, `users/${auth.currentUser.uid}/cart`, cartItemId), { quantity });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}/cart/${cartItemId}`);
    }
  };

  const clearCart = async () => {
    if (!auth.currentUser) return;
    try {
      const cartRef = collection(db, `users/${auth.currentUser.uid}/cart`);
      const snapshot = await getDocs(cartRef);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${auth.currentUser.uid}/cart`);
    }
  };

  const totalAmount = cartItems.reduce((total, item) => {
    const price = item.product?.discountPrice || item.product?.price || 0;
    return total + (price * item.quantity);
  }, 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, totalAmount }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
