import React from 'react';
import { Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

import { ProductImageCarousel } from './ProductImageCarousel';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { cartItems, addToCart, updateQuantity, removeFromCart } = useCart();
  const cartItem = cartItems.find(item => item.productId === product.id);

  const allImages = [product.imageUrl, ...(product.images || [])].filter(Boolean);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white rounded-2xl p-3 border border-gray-100 hover:shadow-xl transition-all group relative"
    >
      <Link to={`/product/${product.id}`}>
        <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-gray-50 relative group/image">
          <ProductImageCarousel 
            images={allImages} 
            showDots={allImages.length > 1}
            showArrows={allImages.length > 1}
            imageClassName="p-2 group-hover:scale-110 transition-transform duration-500"
          />
        </div>
        
        <div className="flex flex-col h-[50px] justify-start mb-2">
          <h3 className="font-bold text-gray-800 text-sm line-clamp-2 mb-1">{product.name}</h3>
          <span className="text-xs text-gray-500 font-medium">{product.unit}</span>
        </div>
      </Link>

      <div className="flex items-center justify-between mt-2">
        <div className="flex flex-col">
          {product.discountPrice && (
            <span className="text-xs text-gray-400 line-through">₹{product.price}</span>
          )}
          <span className="font-black text-gray-900">₹{product.discountPrice || product.price}</span>
        </div>

        {product.stock <= 0 ? (
          <span className="text-xs font-black text-red-500 uppercase tracking-tighter bg-red-50 px-2 py-1 rounded-md">
            Out of Stock
          </span>
        ) : cartItem ? (
          <div className="flex items-center bg-[#FF3269] text-white rounded-lg px-2 py-1 gap-3">
            <button 
              onClick={() => cartItem.quantity === 1 ? removeFromCart(cartItem.id) : updateQuantity(cartItem.id, cartItem.quantity - 1)}
              className="hover:scale-110 transition-transform"
            >
              <Minus size={14} />
            </button>
            <span className="font-bold text-sm min-w-[12px] text-center">{cartItem.quantity}</span>
            <button 
              onClick={() => updateQuantity(cartItem.id, cartItem.quantity + 1)}
              disabled={cartItem.quantity >= product.stock}
              className="hover:scale-110 transition-transform disabled:opacity-50"
            >
              <Plus size={14} />
            </button>
          </div>
        ) : (
          <button 
            onClick={() => addToCart(product)}
            className="bg-white border-2 border-[#FF3269] text-[#FF3269] px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-[#FF3269] hover:text-white transition-all active:scale-95"
          >
            Add
          </button>
        )}
      </div>
    </motion.div>
  );
};
