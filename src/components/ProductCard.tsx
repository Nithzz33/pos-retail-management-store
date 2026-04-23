import React from 'react';
import { Plus, Minus } from 'lucide-react';
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

  const discountAmount = product.discountPrice ? product.price - product.discountPrice : 0;
  const currentPrice = product.discountPrice || product.price;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white rounded-2xl p-3 transition-all group relative flex flex-col h-full hover:shadow-[0_2px_12px_rgb(0,0,0,0.06)]"
    >
      {/* Image Section */}
      <div className="relative mb-3">
        <Link to={`/product/${product.id}`} className="block">
          <div className="aspect-square rounded-[20px] overflow-hidden bg-gray-50/50 border border-gray-100 relative group/image">
            <ProductImageCarousel 
              images={allImages} 
              showDots={allImages.length > 1}
              showArrows={allImages.length > 1}
              imageClassName="p-2 group-hover:scale-110 transition-transform duration-500"
            />
          </div>
        </Link>
        
        {/* Absolute Add Button over Image */}
        <div className="absolute -bottom-3 right-2 z-10 bg-white rounded-xl">
          {product.stock <= 0 ? (
            <span className="text-[10px] font-black text-red-500 uppercase tracking-tighter bg-white shadow-sm border border-red-100 px-3 py-1.5 rounded-xl block">
              Out of Stock
            </span>
          ) : cartItem ? (
            <div className="flex items-center bg-[#ff3269] text-white rounded-xl px-2 py-1.5 gap-3 shadow-[0_2px_8px_rgba(255,50,105,0.3)] w-[85px] justify-between h-[36px]">
              <button 
                onClick={(e) => { e.preventDefault(); cartItem.quantity === 1 ? removeFromCart(cartItem.id) : updateQuantity(cartItem.id, cartItem.quantity - 1); }}
                className="hover:scale-110 transition-transform p-1"
              >
                <Minus size={14} strokeWidth={3} />
              </button>
              <span className="font-bold text-sm min-w-[12px] text-center">{cartItem.quantity}</span>
              <button 
                onClick={(e) => { e.preventDefault(); updateQuantity(cartItem.id, cartItem.quantity + 1); }}
                disabled={cartItem.quantity >= product.stock}
                className="hover:scale-110 transition-transform p-1 disabled:opacity-50"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button 
              onClick={(e) => { e.preventDefault(); addToCart(product); }}
              className="bg-white border border-[#ff3269] text-[#ff3269] w-[85px] h-[36px] rounded-xl font-black text-[13px] hover:bg-[#ff3269]/5 transition-all active:scale-95 shadow-[0_2px_8px_rgba(0,0,0,0.06)] tracking-wide"
            >
              ADD
            </button>
          )}
        </div>
      </div>

      <Link to={`/product/${product.id}`} className="flex-1 flex flex-col pt-1">
        {/* Price Section */}
        <div className="flex flex-col mb-2 min-h-[38px] justify-start">
          <div className="flex items-center gap-1.5">
            {discountAmount > 0 ? (
              <span className="bg-[#0c831f] text-white px-1.5 py-[2px] rounded text-[11px] font-black tracking-tight leading-none">
                ₹{currentPrice}
              </span>
            ) : (
              <span className="text-gray-900 px-0.5 py-[2px] text-[13px] font-black tracking-tight leading-none">
                ₹{currentPrice}
              </span>
            )}
            {product.discountPrice && (
              <span className="text-[11px] font-bold text-gray-400 line-through">₹{product.price}</span>
            )}
          </div>
          {discountAmount > 0 && (
            <span className="text-[10px] font-black text-[#0c831f] mt-[3px] tracking-tight leading-none">
              ₹{discountAmount} OFF
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-medium text-gray-800 text-[13px] line-clamp-2 mb-1 leading-snug">{product.name}</h3>
        
        {/* Unit */}
        <span className="text-xs text-gray-500 font-medium mb-3 opacity-80">{product.unit}</span>

        <div className="mt-auto">
          {/* Tags */}
          {product.isPopular && (
            <div className="mb-2">
              <span className="inline-block bg-teal-50 text-teal-700 px-2 py-[3px] rounded-[4px] text-[10px] font-bold tracking-tight leading-none">
                Top Picks
              </span>
            </div>
          )}

          {/* Rating */}
          <div className="flex items-center gap-1 text-[11px] font-bold text-[#0c831f]">
            <span className="text-sm leading-none">★</span>
            <span className="leading-none">{(product as any).rating != null ? (product as any).rating.toFixed(1) : "4.9"}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};
