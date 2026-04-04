import { Product } from '../types';

const RECENTLY_VIEWED_KEY = 'recently_viewed_products';
const MAX_RECENT_PRODUCTS = 10;

export const addToRecentlyViewed = (product: Product) => {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    let products: Product[] = stored ? JSON.parse(stored) : [];

    // Remove if already exists to move it to the front
    products = products.filter((p) => p.id !== product.id);

    // Add to the beginning
    products.unshift(product);

    // Limit the number of products
    products = products.slice(0, MAX_RECENT_PRODUCTS);

    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(products));
  } catch (error) {
    console.error('Error saving to recently viewed:', error);
  }
};

export const getRecentlyViewed = (): Product[] => {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error getting recently viewed:', error);
    return [];
  }
};
