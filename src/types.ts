export interface Category {
  id: string;
  name: string;
  imageUrl: string;
  order: number;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  discountPrice?: number;
  unit: string;
  imageUrl: string;
  categoryId: string;
  stock: number;
  damagedCount?: number;
  isPopular?: boolean;
  barcode?: string;
  images?: string[];
}

export interface Sale {
  id: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  totalAmount: number;
  paymentMethod: 'cash' | 'online';
  paymentId?: string;
  createdAt: any;
  adminId: string;
}

export interface Procurement {
  id: string;
  productId: string;
  quantity: number;
  costPrice: number;
  createdAt: any;
  adminId: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  address?: string;
  role: 'user' | 'admin';
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  addedAt: any;
  product?: Product;
}

export interface Order {
  id: string;
  userId: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: any;
  deliveryAddress: string;
}
