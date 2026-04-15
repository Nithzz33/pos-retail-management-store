import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where, limit, getDocs } from 'firebase/firestore';
import { Product, Review } from '../types';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, ChevronLeft, ShoppingCart, Plus, Minus, 
  Truck, ShieldCheck, Clock, MessageSquare, Send, Loader2,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { ProductImageCarousel } from '../components/ProductImageCarousel';

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  
  const { cartItems, addToCart, updateQuantity, removeFromCart } = useCart();
  const cartItem = cartItems.find(item => item.productId === id);

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        const docRef = doc(db, 'products', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() } as Product;
          setProduct(data);
          setSelectedImageIndex(0);
        } else {
          toast.error('Product not found');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `products/${id}`);
      } finally {
        setLoading(false);
      }
    };

    const unsubReviews = onSnapshot(
      query(collection(db, 'products', id, 'reviews'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];
        setReviews(reviewsData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `products/${id}/reviews`)
    );

    fetchProduct();
    window.scrollTo(0, 0);
    return () => unsubReviews();
  }, [id]);

  useEffect(() => {
    if (!product) return;

    const fetchRecommendations = async () => {
      try {
        const q = query(
          collection(db, 'products'),
          where('categoryId', '==', product.categoryId),
          limit(10)
        );
        const snapshot = await getDocs(q);
        const prods = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Product))
          .filter(p => p.id !== product.id)
          .slice(0, 6);
        setRecommendations(prods);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'products/recommendations');
      }
    };

    fetchRecommendations();
  }, [product]);

  useEffect(() => {
    if (product) {
      import('../utils/recentlyViewed').then(({ addToRecentlyViewed }) => {
        addToRecentlyViewed(product);
      });
    }
  }, [product]);

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error('Please login to leave a review');
      return;
    }
    if (!newReview.comment.trim()) return;

    setIsSubmittingReview(true);
    try {
      await addDoc(collection(db, 'products', id!, 'reviews'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Anonymous',
        rating: newReview.rating,
        comment: newReview.comment,
        createdAt: serverTimestamp()
      });
      setNewReview({ rating: 5, comment: '' });
      toast.success('Review added successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `products/${id}/reviews`);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#0c831f]" size={48} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-black text-gray-800 mb-4">Product not found</h2>
        <Link to="/" className="text-[#0c831f] font-bold hover:underline">Back to Home</Link>
      </div>
    );
  }

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
    : 0;

  const allImages = product ? [product.imageUrl, ...(product.images || [])].filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-app-bg pb-20">
      <div className="container mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-[#0c831f] font-bold mb-8 transition-colors">
          <ChevronLeft size={20} /> Back to Shopping
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative group">
              <ProductImageCarousel 
                images={allImages}
                index={selectedImageIndex}
                onChange={setSelectedImageIndex}
                aspectRatio="aspect-square"
                className="rounded-3xl bg-gray-50 border border-gray-100"
                imageClassName="p-8"
                showDots={allImages.length > 1}
                showArrows={allImages.length > 1}
              />
            </div>
            
            {allImages.length > 1 && (
              <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                {allImages.map((img, i) => (
                  <button 
                    key={i}
                    onClick={() => setSelectedImageIndex(i)}
                    className={`w-20 h-20 rounded-xl border-2 flex-shrink-0 overflow-hidden transition-all ${selectedImageIndex === i ? 'border-[#0c831f]' : 'border-transparent bg-gray-50'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-lg text-sm font-black">
                  <Star size={14} fill="currentColor" />
                  {averageRating.toFixed(1)}
                </div>
                <span className="text-gray-400 font-bold text-sm">{reviews.length} Reviews</span>
              </div>
              
              <h1 className="text-4xl font-black text-gray-900 mb-2">{product.name}</h1>
              <p className="text-lg font-bold text-gray-400 uppercase tracking-wider">{product.unit}</p>
            </div>

            <div className="flex items-end gap-4">
              <div className="flex flex-col">
                {product.discountPrice && (
                  <span className="text-xl text-gray-400 line-through font-bold">₹{product.price}</span>
                )}
                <span className="text-5xl font-black text-gray-900">₹{product.discountPrice || product.price}</span>
              </div>
              {product.discountPrice && (
                <div className="bg-[#0c831f] text-white px-3 py-1 rounded-full text-sm font-black mb-2">
                  {Math.round(((product.price - product.discountPrice) / product.price) * 100)}% OFF
                </div>
              )}
            </div>

            <div className="flex items-center gap-6 py-6 border-y border-gray-100">
              {product.stock <= 0 ? (
                <div className="flex-1 bg-red-50 text-red-600 px-8 py-4 rounded-2xl font-black text-xl text-center border-2 border-red-100">
                  Out of Stock
                </div>
              ) : cartItem ? (
                <div className="flex items-center bg-[#0c831f] text-white rounded-2xl px-6 py-4 gap-8 shadow-lg shadow-[#0c831f]/20">
                  <button 
                    onClick={() => cartItem.quantity === 1 ? removeFromCart(cartItem.id) : updateQuantity(cartItem.id, cartItem.quantity - 1)}
                    className="hover:scale-125 transition-transform"
                  >
                    <Minus size={24} />
                  </button>
                  <span className="font-black text-2xl min-w-[30px] text-center">{cartItem.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(cartItem.id, cartItem.quantity + 1)}
                    disabled={cartItem.quantity >= product.stock}
                    className="hover:scale-125 transition-transform disabled:opacity-50"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => addToCart(product)}
                  className="flex-1 bg-[#0c831f] text-white px-8 py-4 rounded-2xl font-black text-xl shadow-lg shadow-[#0c831f]/20 hover:bg-[#0a6c19] transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <ShoppingCart size={24} /> Add to Cart
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${product.stock > 10 ? 'bg-green-500' : product.stock > 0 ? 'bg-yellow-500' : 'bg-red-500'}`} />
              <span className="text-sm font-bold text-gray-600">
                {product.stock > 0 ? `${product.stock} items available in stock` : 'Currently unavailable'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center text-center p-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/20">
                <Clock className="text-[#0c831f] mb-2" size={24} />
                <span className="text-xs font-black text-gray-900">10 Mins Delivery</span>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/20">
                <ShieldCheck className="text-[#0c831f] mb-2" size={24} />
                <span className="text-xs font-black text-gray-900">Quality Assured</span>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-white/20 backdrop-blur-sm rounded-2xl border border-white/20">
                <Truck className="text-[#0c831f] mb-2" size={24} />
                <span className="text-xs font-black text-gray-900">Free Shipping</span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-black text-gray-900">Product Description</h3>
              <p className="text-gray-600 font-medium leading-relaxed">
                {product.description || "No description available for this product."}
              </p>
            </div>
          </div>
        </div>

        {/* Recommendations Section */}
        {recommendations.length > 0 && (
          <div className="mt-20">
            <h3 className="text-2xl font-black text-gray-900 mb-8">You might also like</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {recommendations.map(item => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="mt-20 border-t border-gray-100 pt-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="space-y-6">
              <h3 className="text-2xl font-black text-gray-900">Customer Reviews</h3>
              
              <div className="bg-white/40 backdrop-blur-md p-8 rounded-3xl space-y-4 border border-white/20 shadow-sm">
                <div className="flex items-center gap-4">
                  <span className="text-5xl font-black text-gray-900">{averageRating.toFixed(1)}</span>
                  <div className="flex flex-col">
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={16} fill={i < Math.round(averageRating) ? "currentColor" : "none"} />
                      ))}
                    </div>
                    <span className="text-sm font-bold text-gray-400">Based on {reviews.length} reviews</span>
                  </div>
                </div>
              </div>

              {auth.currentUser ? (
                <form onSubmit={handleAddReview} className="space-y-4">
                  <h4 className="font-black text-gray-800">Write a Review</h4>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                        className={`p-1 transition-colors ${newReview.rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                        <Star size={24} fill={newReview.rating >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={newReview.comment}
                    onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                    placeholder="Share your thoughts about this product..."
                    className="w-full bg-white/40 backdrop-blur-md border border-white/20 rounded-2xl p-4 font-medium focus:ring-2 focus:ring-[#0c831f] outline-none min-h-[120px]"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingReview || !newReview.comment.trim()}
                    className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-gray-800 transition-all disabled:opacity-50 shadow-lg shadow-gray-900/10"
                  >
                    {isSubmittingReview ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                    Post Review
                  </button>
                </form>
              ) : (
                <div className="p-6 bg-white/20 backdrop-blur-sm rounded-2xl text-center border border-white/20">
                  <p className="font-bold text-gray-500 mb-2">Login to write a review</p>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-6">
              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={review.id} 
                    className="p-6 bg-white/40 backdrop-blur-md border border-white/20 rounded-3xl space-y-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/40 backdrop-blur-sm border border-white/20 flex items-center justify-center font-black text-[#0c831f]">
                          {review.userName[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-gray-900">{review.userName}</p>
                          <div className="flex text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} size={12} fill={i < review.rating ? "currentColor" : "none"} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-gray-400">
                        {review.createdAt?.toDate ? format(review.createdAt.toDate(), 'MMM d, yyyy') : 'Just now'}
                      </span>
                    </div>
                    <p className="text-gray-600 font-medium leading-relaxed">{review.comment}</p>
                  </motion.div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-30">
                  <MessageSquare size={48} className="mb-4" />
                  <p className="font-black">No reviews yet. Be the first to review!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
