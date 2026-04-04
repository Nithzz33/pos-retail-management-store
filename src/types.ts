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
  rating?: number;
  createdAt?: any;
}

export interface Sale {
  id: string;
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
  }[];
  subtotal: number;
  gstAmount: number;
  discount: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'online';
  paymentId?: string;
  customerName?: string;
  customerPhone?: string;
  createdAt: any;
  adminId: string;
  type: 'store';
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
  paymentMethod: 'cash' | 'online';
  status: 'placed' | 'pending' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';
  createdAt: any;
  deliveryAddress: string;
  surgeMultiplier: number;
  surgeAmount: number;
  pickupLocation?: {
    lat: number;
    lng: number;
  };
  deliveryLocation?: {
    lat: number;
    lng: number;
  };
}

export interface Rider {
  id: string;
  name: string;
  status: 'online' | 'busy' | 'offline';
  location: {
    lat: number;
    lng: number;
  };
  rating?: number;
  acceptanceRate?: number;
  vehicleType?: 'bike' | 'scooter' | 'cycle';
  lastUpdated?: any;
}

export interface MatchingResult {
  riderId: string;
  score: number;
  distance: number;
  eta: number;
}

export interface AssignmentLog {
  id: string;
  orderId: string;
  riderId: string;
  riderName: string;
  assignedAt: any;
  status: 'assigned' | 'rejected' | 'completed';
  distance?: number;
  eta?: number;
  surgeMultiplier?: number;
}
