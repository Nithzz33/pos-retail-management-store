import React, { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType, onAuthStateChanged } from '../firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, getDocs, writeBatch, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Order, Product, Procurement, Sale, UserProfile, Category, AssignmentLog } from '../types';
import { Rider, riderAssignmentService, MatchingResult } from '../services/riderAssignmentService';
import { RiderMap } from '../components/RiderMap';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, ShoppingBag, Users, Package, Search, Settings, Tag,
  Loader2, AlertTriangle, CheckCircle, Database, MapPin,
  Clock, Truck, XCircle, ArrowUpRight, ArrowDownRight, RefreshCw,
  Scan, ShoppingCart, CreditCard, Banknote, Plus, Minus, Trash2, Sparkles,
  Edit, Save, X, Upload, FileText, ChevronLeft, ChevronRight, Check, Square, Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { GoogleGenAI } from "@google/genai";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter, subDays, subMonths } from 'date-fns';
import { calculateETA, calculateHaversineDistance } from '../utils/geoUtils';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { StorePOS } from '../components/StorePOS';
import { AIAssistant } from '../components/AIAssistant';
import Papa from 'papaparse';
import { ProductImageCarousel } from '../components/ProductImageCarousel';
import { seedDatabase, clearAllProducts } from '../seed';
import { printInvoice } from '../utils/printInvoice';

const ADMIN_EMAIL = "sainithingowda3714@gmail.com";

export const AdminDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [storeSales, setStoreSales] = useState<Sale[]>([]);
  const [procurements, setProcurements] = useState<Procurement[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignmentLogs, setAssignmentLogs] = useState<AssignmentLog[]>([]);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<'all' | 'assigned' | 'rejected' | 'completed'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'inventory' | 'procurement' | 'pos' | 'sales' | 'customers' | 'rider-matching' | 'rider-assignment-history' | 'settings'>('overview');
  const [user, setUser] = useState(auth.currentUser);
  
  // Rider Matching State
  const [selectedOrderForMatching, setSelectedOrderForMatching] = useState<Order | null>(null);
  const [matchingResults, setMatchingResults] = useState<MatchingResult[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [assignedRiderId, setAssignedRiderId] = useState<string | null>(null);
  const [hoveredRiderId, setHoveredRiderId] = useState<string | null>(null);
  const [filterOnlineOnly, setFilterOnlineOnly] = useState(true);

  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);
  
  // POS State
  const [isScanning, setIsScanning] = useState(false);
  const [scanType, setScanType] = useState<'procurement' | 'edit' | 'pos'>('procurement');
  const [scannedBarcode, setScannedBarcode] = useState<string | undefined>(undefined);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Procurement State
  const [procurementBarcode, setProcurementBarcode] = useState('');
  const [procurementProduct, setProcurementProduct] = useState<Product | null>(null);
  const [procurementQuantity, setProcurementQuantity] = useState(1);
  const [procurementCost, setProcurementCost] = useState(0);

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const generateProductImage = async (field: 'imageUrl' | number) => {
    if (!productForm.name) {
      toast.error('Please enter a product name first');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `A high-quality, professional studio product photograph of ${productForm.name} ${productForm.unit || ''}, isolated on a clean white background, commercial photography style, 4k resolution.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: prompt }] }],
      });

      let imageUrl = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }

      if (imageUrl) {
        if (field === 'imageUrl') {
          setProductForm({ ...productForm, imageUrl });
        } else {
          const newImages = [...(productForm.images || [])];
          newImages[field] = imageUrl;
          setProductForm({ ...productForm, images: newImages });
        }
        toast.success('Image generated successfully!');
      }
    } catch (error) {
      console.error('Image Generation Error:', error);
      toast.error('Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Product Edit State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [productForm, setProductForm] = useState<Partial<Product>>({});

  // Bulk Stock State
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkStockValue, setBulkStockValue] = useState<number>(0);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAllProducts = async () => {
    if (!window.confirm('Are you sure you want to delete ALL products? This action cannot be undone.')) {
      return;
    }
    setIsClearing(true);
    try {
      const count = await clearAllProducts();
      toast.success(`Successfully deleted ${count} products!`);
    } catch (error: any) {
      console.error('Clear Error:', error);
      toast.error('Failed to clear products. Check console for details.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleResetDatabase = async () => {
    console.log('Reset Database triggered');
    if (!window.confirm('Are you sure you want to reset the database? This will delete all current products and seed new ones.')) {
      console.log('Reset Database cancelled by user');
      return;
    }
    setIsSeeding(true);
    try {
      console.log('Calling seedDatabase...');
      await seedDatabase();
      console.log('seedDatabase completed successfully');
      toast.success('Database reset and seeded successfully!');
    } catch (error: any) {
      console.error('Seeding Error:', error);
      let errorMessage = 'Failed to reset database.';
      try {
        // Try to parse the JSON error from handleFirestoreError
        const errInfo = JSON.parse(error.message);
        errorMessage = `Seeding failed: ${errInfo.error}`;
        if (errInfo.error.includes('permission-denied')) {
          errorMessage = "Permission denied. Please ensure you are logged in as an admin and your email is verified.";
        }
      } catch (e) {
        errorMessage = error.message || 'An unknown error occurred during seeding.';
      }
      toast.error(errorMessage, {
        description: 'Check the browser console for more technical details.',
        duration: 8000
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleBulkStockUpdate = async () => {
    if (selectedProducts.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedProducts.forEach(productId => {
        const productRef = doc(db, 'products', productId);
        batch.update(productRef, { stock: bulkStockValue });
      });
      await batch.commit();
      toast.success(`Successfully updated stock for ${selectedProducts.length} products`);
      setSelectedProducts([]);
      setIsBulkModalOpen(false);
    } catch (error) {
      console.error('Bulk Update Error:', error);
      toast.error('Failed to update stock in bulk');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  useEffect(() => {
    if (!user || user.email !== ADMIN_EMAIL) {
      if (!isLoading) window.location.href = '/';
      return;
    }

    const unsubOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(ordersData);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(productsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    const unsubStoreSales = onSnapshot(query(collection(db, 'store_sales'), orderBy('createdAt', 'desc')), (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Sale[];
      setStoreSales(salesData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'store_sales'));

    const unsubProcurements = onSnapshot(query(collection(db, 'procurements'), orderBy('createdAt', 'desc')), (snapshot) => {
      const procurementsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Procurement[];
      setProcurements(procurementsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'procurements'));

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data() })) as UserProfile[];
      setUsers(usersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    const unsubCategories = onSnapshot(query(collection(db, 'categories'), orderBy('order', 'asc')), (snapshot) => {
      const categoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Category[];
      setCategories(categoriesData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    const unsubRiders = onSnapshot(collection(db, 'riders'), (snapshot) => {
      const ridersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Rider[];
      setRiders(ridersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'riders'));

    const unsubAssignmentLogs = onSnapshot(query(collection(db, 'assignment_logs'), orderBy('assignedAt', 'desc')), (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AssignmentLog[];
      setAssignmentLogs(logsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'assignment_logs'));

    if (user && !user.emailVerified) {
      console.log('User email not verified:', user.email);
      toast.error('Your email is not verified. Some administrative actions may be restricted.', {
        description: 'Please verify your email to ensure full access.',
        duration: 10000,
      });
    }

    console.log('Admin Status:', {
      currentUser: user?.email,
      isAdmin: user?.email === ADMIN_EMAIL,
      emailVerified: user?.emailVerified
    });

    return () => {
      unsubOrders();
      unsubProducts();
      unsubStoreSales();
      unsubProcurements();
      unsubUsers();
      unsubCategories();
      unsubRiders();
      unsubAssignmentLogs();
    };
  }, [user, isAdmin]);

  // Analytics Calculations
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const getSalesForPeriod = (start: Date) => {
    const onlineSales = orders
      .filter(o => o.status !== 'cancelled' && o.createdAt?.toDate && isAfter(o.createdAt.toDate(), start))
      .reduce((sum, o) => sum + o.totalAmount, 0);
    
    const offlineSales = storeSales
      .filter(s => s.createdAt?.toDate && isAfter(s.createdAt.toDate(), start))
      .reduce((sum, s) => sum + s.totalAmount, 0);

    return onlineSales + offlineSales;
  };

  const stats = {
    today: getSalesForPeriod(todayStart),
    week: getSalesForPeriod(weekStart),
    month: getSalesForPeriod(monthStart),
    year: getSalesForPeriod(yearStart),
    totalRevenue: orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.totalAmount, 0) + 
                  storeSales.reduce((sum, s) => sum + s.totalAmount, 0),
    totalOrders: orders.length + storeSales.length,
    activeOrders: orders.filter(o => ['pending', 'processing', 'shipped'].includes(o.status)).length,
    lowStock: products.filter(p => p.stock < 10).length
  };

  // Top Selling Products
  const topProducts = products.map(p => {
    const onlineQty = orders
      .filter(o => o.status !== 'cancelled')
      .flatMap(o => o.items)
      .filter(item => item.productId === p.id)
      .reduce((sum, item) => sum + item.quantity, 0);
    
    const offlineQty = storeSales
      .flatMap(s => s.items)
      .filter(item => item.productId === p.id)
      .reduce((sum, item) => sum + item.quantity, 0);

    return { ...p, totalSold: onlineQty + offlineQty };
  })
  .sort((a, b) => b.totalSold - a.totalSold)
  .slice(0, 5);

  // Recent Activity
  const recentActivity = [
    ...orders.map(o => ({ type: 'order', id: o.id, amount: o.totalAmount, date: o.createdAt?.toDate?.() || new Date(), status: o.status })),
    ...storeSales.map(s => ({ type: 'sale', id: s.id, amount: s.totalAmount, date: s.createdAt?.toDate?.() || new Date(), status: 'completed' }))
  ]
  .sort((a, b) => b.date.getTime() - a.date.getTime())
  .slice(0, 10);

  // Chart Data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(now, 6 - i);
    const dayName = format(d, 'EEE');
    const dayStart = startOfDay(d);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const onlineDaySales = orders
      .filter(o => o.status !== 'cancelled' && o.createdAt?.toDate && 
              isAfter(o.createdAt.toDate(), dayStart) && 
              !isAfter(o.createdAt.toDate(), dayEnd))
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const offlineDaySales = storeSales
      .filter(s => s.createdAt?.toDate && 
              isAfter(s.createdAt.toDate(), dayStart) && 
              !isAfter(s.createdAt.toDate(), dayEnd))
      .reduce((sum, s) => sum + s.totalAmount, 0);

    return { name: dayName, sales: onlineDaySales + offlineDaySales };
  });

  const categoryData = categories.map(cat => ({
    name: cat.name,
    value: products.filter(p => p.categoryId === cat.id).length,
    revenue: products
      .filter(p => p.categoryId === cat.id)
      .reduce((sum, p) => {
        const onlineRev = orders
          .filter(o => o.status !== 'cancelled')
          .flatMap(o => o.items)
          .filter(item => item.productId === p.id)
          .reduce((s, item) => s + (item.price * item.quantity), 0);
        
        const offlineRev = storeSales
          .flatMap(s => s.items)
          .filter(item => item.productId === p.id)
          .reduce((s, item) => s + (item.price * item.quantity), 0);
          
        return sum + onlineRev + offlineRev;
      }, 0)
  }));

  const revenueByCategoryData = categoryData
    .filter(c => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const COLORS = ['#FF3269', '#4F46E5', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6'];

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
      toast.success(`Order status updated to ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const procureProduct = async (productId: string, currentStock: number) => {
    try {
      await updateDoc(doc(db, 'products', productId), { stock: currentStock + 50 });
      toast.success('Stock updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
    }
  };

  const reportDamaged = async (productId: string, currentDamaged: number = 0) => {
    try {
      await updateDoc(doc(db, 'products', productId), { damagedCount: currentDamaged + 1 });
      toast.success('Damaged item reported');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
    }
  };

  const clearDamaged = async (productId: string) => {
    try {
      await updateDoc(doc(db, 'products', productId), { damagedCount: 0 });
      toast.success('Damaged count cleared');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${productId}`);
    }
  };

  const handleBarcodeScan = (barcode: string) => {
    if (scanType === 'procurement') {
      if (barcode === procurementBarcode && procurementProduct) {
        setProcurementQuantity(prev => prev + 1);
        toast.success(`Quantity incremented for ${procurementProduct.name}`);
      } else {
        setProcurementBarcode(barcode);
        const prod = products.find(p => p.barcode === barcode);
        setProcurementProduct(prod || null);
        setProcurementQuantity(1);
        
        if (prod) {
          toast.success(`Product found: ${prod.name}`);
          // Auto-fill last cost price
          const lastProc = procurements.find(p => p.productId === prod.id);
          if (lastProc) {
            setProcurementCost(lastProc.costPrice);
          } else {
            setProcurementCost(0);
          }
        } else {
          toast.error('Product not found');
          setIsScanning(false);
        }
      }
    } else if (scanType === 'edit') {
      setProductForm(prev => ({ ...prev, barcode }));
      setIsScanning(false);
      toast.success('Barcode scanned');
    } else if (scanType === 'pos') {
      setScannedBarcode(barcode);
      setIsScanning(false);
      // Reset barcode after a short delay so it can be scanned again
      setTimeout(() => setScannedBarcode(undefined), 100);
    }
  };

  const handleSaveProduct = async () => {
    if (!productForm.name || !productForm.price || !productForm.unit || !productForm.categoryId) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const finalProductData = {
        ...productForm,
        images: (productForm.images || []).filter(img => img.trim() !== '')
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), finalProductData);
        toast.success('Product updated successfully');
      } else {
        await addDoc(collection(db, 'products'), {
          ...finalProductData,
          stock: Number(productForm.stock) || 0,
          damagedCount: 0,
          isPopular: false,
          imageUrl: productForm.imageUrl || 'https://picsum.photos/seed/product/400/400'
        });
        toast.success('Product added successfully');
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setProductForm({});
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        const errors: string[] = [];
        const validProducts: any[] = [];

        data.forEach((row, index) => {
          const rowNum = index + 2; // +1 for header, +1 for 1-based index
          if (!row.name || !row.price || !row.unit || !row.categoryId) {
            errors.push(`Row ${rowNum}: Missing required fields (name, price, unit, categoryId)`);
            return;
          }
          
          validProducts.push({
            name: row.name,
            price: Number(row.price),
            discountPrice: row.discountPrice ? Number(row.discountPrice) : undefined,
            unit: row.unit,
            categoryId: row.categoryId,
            stock: Number(row.stock) || 0,
            imageUrl: row.imageUrl || 'https://picsum.photos/seed/product/400/400',
            description: row.description || '',
            barcode: row.barcode || '',
            damagedCount: 0,
            isPopular: false,
            images: row.images ? row.images.split(',').map((s: string) => s.trim()) : []
          });
        });

        if (errors.length > 0) {
          toast.error(`Import failed: ${errors[0]}${errors.length > 1 ? ` and ${errors.length - 1} more errors` : ''}`);
          setIsImporting(false);
          return;
        }

        try {
          const batch = writeBatch(db);
          validProducts.forEach((product) => {
            const newDocRef = doc(collection(db, 'products'));
            batch.set(newDocRef, product);
          });
          await batch.commit();
          toast.success(`Successfully imported ${validProducts.length} products`);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'products/bulk');
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        toast.error(`CSV Parsing Error: ${error.message}`);
        setIsImporting(false);
      }
    });
  };

  const downloadSampleCSV = () => {
    const headers = ['name', 'price', 'discountPrice', 'unit', 'categoryId', 'stock', 'imageUrl', 'description', 'barcode', 'images'];
    const sampleData = [
      ['Fresh Apple', '120', '100', '1kg', 'fruits-veg', '50', 'https://picsum.photos/seed/apple/400/400', 'Sweet red apples', '123456789', 'https://picsum.photos/seed/apple2/400/400'],
      ['Organic Milk', '60', '', '1L', 'dairy-eggs', '20', 'https://picsum.photos/seed/milk/400/400', 'Pure organic milk', '987654321', '']
    ];
    
    const csvContent = [headers, ...sampleData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "product_import_sample.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-[#FF3269]" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <BarcodeScanner 
        isOpen={isScanning} 
        onClose={() => setIsScanning(false)} 
        onScan={handleBarcodeScan} 
        continuous={scanType === 'procurement'}
      />
      {/* Sidebar */}
      <aside className="w-64 bg-white/40 backdrop-blur-xl border-r border-white/20 flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-black text-[#FF3269] tracking-tighter">ADMIN PANEL</h1>
          <p className="text-xs font-bold text-gray-400 uppercase mt-1">Retail Management</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'overview' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-white/40'}`}
          >
            <TrendingUp size={20} /> Overview
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'orders' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-white/40'}`}
          >
            <ShoppingBag size={20} /> Orders
          </button>
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'inventory' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-white/40'}`}
          >
            <Package size={20} /> Inventory
          </button>
          <button 
            onClick={() => setActiveTab('pos')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'pos' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-white/40'}`}
          >
            <ShoppingCart size={20} /> Store POS
          </button>
          <button 
            onClick={() => setActiveTab('sales')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'sales' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-white/40'}`}
          >
            <Banknote size={20} /> Store Sales
          </button>
          <button 
            onClick={() => setActiveTab('procurement')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'procurement' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-white/40'}`}
          >
            <Scan size={20} /> Procurement
          </button>
          <button 
            onClick={() => setActiveTab('customers')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'customers' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-white/40'}`}
          >
            <Users size={20} /> Customers
          </button>
          <button 
            onClick={() => setActiveTab('rider-matching')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'rider-matching' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-white/40'}`}
          >
            <Truck size={20} /> Rider Matching
          </button>
          <button 
            onClick={() => setActiveTab('rider-assignment-history')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'rider-assignment-history' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-white/40'}`}
          >
            <Clock size={20} /> Assignment History
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'settings' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <RefreshCw size={20} /> Settings
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-[#FF3269] flex items-center justify-center text-white font-black relative">
              {auth.currentUser?.displayName?.[0] || 'A'}
              <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-sm">
                <div className="bg-[#FF3269] rounded-full p-0.5">
                  <Sparkles size={8} className="text-white" />
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-800 truncate">{auth.currentUser?.displayName || 'Admin'}</p>
                <div className="bg-[#FF3269]/10 text-[#FF3269] text-[8px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5 border border-[#FF3269]/20">
                  <Sparkles size={8} /> AI
                </div>
              </div>
              <p className="text-xs font-medium text-gray-400 truncate">{auth.currentUser?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex items-center justify-between mb-8 bg-white/40 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-sm">
          <div>
            <h2 className="text-3xl font-black text-gray-900 capitalize">{activeTab}</h2>
            <p className="text-gray-500 font-medium">Welcome back, Admin. Here's what's happening today.</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleResetDatabase}
              disabled={isSeeding}
              className="bg-white/40 backdrop-blur-sm text-gray-700 border border-white/20 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-white/60 transition-all disabled:opacity-50"
            >
              {isSeeding ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Reset Database
            </button>
            <div className="bg-white/40 backdrop-blur-sm p-2 rounded-xl shadow-sm border border-white/20 flex items-center gap-2 px-4">
              <Clock size={18} className="text-gray-400" />
              <span className="font-bold text-gray-700">{format(now, 'PPP')}</span>
            </div>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Today Sales', value: `₹${stats.today}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50/50' },
                { label: 'Weekly Sales', value: `₹${stats.week}`, icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50/50' },
                { label: 'Monthly Sales', value: `₹${stats.month}`, icon: ShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50/50' },
                { label: 'Total Revenue', value: `₹${stats.totalRevenue}`, icon: TrendingUp, color: 'text-[#FF3269]', bg: 'bg-[#FF3269]/10' },
              ].map((stat, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={stat.label} 
                  className="bg-white/40 backdrop-blur-md p-6 rounded-3xl border border-white/20 shadow-sm"
                >
                  <div className={`${stat.bg} ${stat.color} w-12 h-12 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm`}>
                    <stat.icon size={24} />
                  </div>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                  <h3 className="text-2xl font-black text-gray-900 mt-1">{stat.value}</h3>
                </motion.div>
              ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white/40 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-sm">
                <h3 className="text-xl font-black text-gray-900 mb-6">Sales Trend (Last 7 Days)</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={last7Days}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF3269" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#FF3269" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#9ca3af' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#9ca3af' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ fontWeight: 800, color: '#FF3269' }}
                      />
                      <Area type="monotone" dataKey="sales" stroke="#FF3269" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white/40 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-sm">
                <h3 className="text-xl font-black text-gray-900 mb-6">Inventory Status</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="text-red-500" />
                      <div>
                        <p className="font-black text-red-900">Low Stock Alert</p>
                        <p className="text-sm font-bold text-red-600">{stats.lowStock} products need attention</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveTab('inventory')}
                      className="bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-600 transition-colors"
                    >
                      View All
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase">Total Orders</p>
                      <p className="text-2xl font-black text-gray-900">{stats.totalOrders}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-xs font-bold text-gray-400 uppercase">Total Customers</p>
                      <p className="text-2xl font-black text-gray-900">{users.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-black text-gray-900 mb-6">Revenue by Category</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueByCategoryData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fontWeight: 600, fill: '#9ca3af' }} 
                        width={100}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [`₹${value}`, 'Revenue']}
                      />
                      <Bar dataKey="revenue" radius={[0, 10, 10, 0]}>
                        {revenueByCategoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-black text-gray-900 mb-6">Category Distribution</h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {categoryData.map((cat, i) => (
                    <div key={cat.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-xs font-bold text-gray-600 truncate">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Products & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-black text-gray-900 mb-6">Top Selling Products</h3>
                <div className="space-y-4">
                  {topProducts.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl overflow-hidden border border-gray-100 p-1">
                          <img src={p.imageUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{p.name}</p>
                          <p className="text-xs font-bold text-gray-400 uppercase">{p.unit}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-[#FF3269]">{p.totalSold} sold</p>
                        <p className="text-xs font-bold text-gray-400">₹{(p.discountPrice || p.price) * p.totalSold} revenue</p>
                      </div>
                    </div>
                  ))}
                  {topProducts.length === 0 && (
                    <p className="text-center py-8 text-gray-400 font-bold">No sales data yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-black text-gray-900 mb-6">Recent Activity</h3>
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activity.type === 'order' ? 'bg-blue-50 text-blue-500' : 'bg-green-50 text-green-500'}`}>
                          {activity.type === 'order' ? <ShoppingBag size={20} /> : <ShoppingCart size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">
                            {activity.type === 'order' ? 'Online Order' : 'Store Sale'} 
                            <span className="text-gray-400 text-xs ml-2">#{activity.id.slice(-6).toUpperCase()}</span>
                          </p>
                          <p className="text-xs font-bold text-gray-400">{format(activity.date, 'MMM d, HH:mm')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-gray-900">₹{activity.amount}</p>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          activity.status === 'delivered' || activity.status === 'completed' ? 'text-green-500' :
                          activity.status === 'cancelled' ? 'text-red-500' : 'text-blue-500'
                        }`}>
                          {activity.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {recentActivity.length === 0 && (
                    <p className="text-center py-8 text-gray-400 font-bold">No recent activity.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900">All Orders</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search orders..." 
                  className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#FF3269] outline-none text-sm font-medium"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-400 text-xs font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">#{order.id.slice(-6).toUpperCase()}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-800">{order.userId.slice(0, 8)}...</p>
                        <p className="text-xs text-gray-400 font-medium">{order.deliveryAddress}</p>
                      </td>
                      <td className="px-6 py-4 font-black text-gray-900">₹{order.totalAmount}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-600' :
                          order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-500">
                        {order.createdAt?.toDate ? format(order.createdAt.toDate(), 'MMM d, HH:mm') : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                          className="bg-gray-100 border-none rounded-lg text-xs font-bold py-1 px-2 focus:ring-2 focus:ring-[#FF3269] outline-none"
                        >
                          <option value="placed">Placed</option>
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="out_for_delivery">Out for Delivery</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => printInvoice(order)}
                          className="p-2 text-gray-400 hover:text-[#FF3269] hover:bg-[#FF3269]/5 rounded-lg transition-colors"
                          title="Print Invoice"
                        >
                          <Printer size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900">Product Inventory</h3>
              <div className="flex items-center gap-3">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleBulkImport}
                  accept=".csv"
                  className="hidden"
                />
                <button 
                  onClick={downloadSampleCSV}
                  className="bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all"
                >
                  <FileText size={18} /> Sample CSV
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="bg-white text-[#FF3269] border border-[#FF3269] px-4 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#FF3269]/5 transition-all disabled:opacity-50"
                >
                  {isImporting ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                  Bulk Import
                </button>
                {selectedProducts.length > 0 && (
                  <button 
                    onClick={() => setIsBulkModalOpen(true)}
                    className="bg-orange-500 text-white px-4 py-2.5 rounded-2xl font-black flex items-center gap-2 hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
                  >
                    <RefreshCw size={18} /> Bulk Stock Update ({selectedProducts.length})
                  </button>
                )}
                <button 
                  onClick={handleClearAllProducts}
                  disabled={isClearing}
                  className="bg-white text-red-600 border border-red-200 px-4 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  {isClearing ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                  Clear All
                </button>
                <button 
                  onClick={() => {
                    setEditingProduct(null);
                    setProductForm({ categoryId: 'fruits-veg' }); // Default category
                    setIsProductModalOpen(true);
                  }}
                  className="bg-gray-900 text-white px-6 py-2.5 rounded-2xl font-black flex items-center gap-2 hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/10"
                >
                  <Plus size={20} /> Add Product
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <div key={product.id} className={`bg-white p-6 rounded-3xl shadow-sm border ${selectedProducts.includes(product.id) ? 'border-[#FF3269] ring-2 ring-[#FF3269]/10' : 'border-gray-100'} flex gap-4 group hover:shadow-xl transition-all relative`}>
                  <button 
                    onClick={() => {
                      if (selectedProducts.includes(product.id)) {
                        setSelectedProducts(prev => prev.filter(id => id !== product.id));
                      } else {
                        setSelectedProducts(prev => [...prev, product.id]);
                      }
                    }}
                    className={`absolute top-4 left-4 z-10 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      selectedProducts.includes(product.id) 
                        ? 'bg-[#FF3269] border-[#FF3269] text-white' 
                        : 'bg-white border-gray-200 text-transparent group-hover:border-gray-300'
                    }`}
                  >
                    <Check size={14} strokeWidth={4} />
                  </button>
                  <div className="w-20 h-20 bg-gray-50 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-100">
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <h4 className="font-black text-gray-900 truncate">{product.name}</h4>
                        <p className="text-xs font-bold text-gray-400 uppercase">{product.unit}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setEditingProduct(product);
                          setProductForm(product);
                          setIsProductModalOpen(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-[#FF3269] hover:bg-[#FF3269]/5 rounded-lg transition-all"
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                    {product.barcode && (
                      <p className="text-[10px] font-mono font-bold text-gray-400 mt-1 flex items-center gap-1">
                        <Scan size={10} /> {product.barcode}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-gray-400">Stock</p>
                        <p className={`text-lg font-black ${product.stock < 10 ? 'text-red-500' : 'text-green-500'}`}>
                          {product.stock}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400">Price</p>
                        <p className="text-lg font-black text-gray-900">₹{product.discountPrice || product.price}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      {product.stock < 10 && (
                        <button 
                          onClick={() => procureProduct(product.id, product.stock)}
                          className="flex-1 bg-[#FF3269] text-white px-3 py-1.5 rounded-xl text-[10px] font-black hover:bg-[#E62D5E] transition-all flex items-center justify-center gap-1"
                        >
                          <RefreshCw size={10} /> Procure
                        </button>
                      )}
                      <button 
                        onClick={() => reportDamaged(product.id, product.damagedCount)}
                        className="flex-1 bg-orange-100 text-orange-600 px-3 py-1.5 rounded-xl text-[10px] font-black hover:bg-orange-200 transition-all flex items-center justify-center gap-1"
                      >
                        <AlertTriangle size={10} /> Report
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'pos' && (
          <div className="h-[calc(100vh-180px)]">
            <StorePOS 
              products={products} 
              onScan={() => { setScanType('pos'); setIsScanning(true); }} 
              externalBarcode={scannedBarcode}
            />
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900">Store Sales History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-400 text-xs font-black uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Sale ID</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Items</th>
                    <th className="px-6 py-4">Subtotal</th>
                    <th className="px-6 py-4">Discount</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Method</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {storeSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">#{sale.id.slice(-6).toUpperCase()}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-800">{sale.customerName || 'Walk-in'}</p>
                        <p className="text-xs text-gray-400 font-medium">{sale.customerPhone || 'No Phone'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-800">{sale.items.length} items</p>
                        <p className="text-[10px] text-gray-400 truncate max-w-[150px]">
                          {sale.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                        </p>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-600">₹{sale.subtotal?.toFixed(2) || sale.totalAmount}</td>
                      <td className="px-6 py-4 font-bold text-red-500">-₹{sale.discount?.toFixed(2) || 0}</td>
                      <td className="px-6 py-4 font-black text-gray-900">₹{sale.totalAmount.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          sale.paymentMethod === 'online' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                        }`}>
                          {sale.paymentMethod}
                          {sale.paymentId && <span className="block text-[8px] opacity-50">ID: {sale.paymentId.slice(-8)}</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-500">
                        {sale.createdAt?.toDate ? format(sale.createdAt.toDate(), 'MMM d, HH:mm') : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => printInvoice(sale)}
                          className="p-2 text-gray-400 hover:text-[#FF3269] hover:bg-[#FF3269]/5 rounded-lg transition-colors"
                          title="Print Invoice"
                        >
                          <Printer size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {storeSales.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-gray-400 font-bold">
                        No store sales recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'procurement' && (
          <div className="space-y-8">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center">
              <div className="w-20 h-20 bg-[#FF3269]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#FF3269]">
                <Scan size={40} />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Inventory Procurement</h3>
              <p className="text-gray-500 font-medium mb-8">Scan a product barcode to update stock levels or add new inventory.</p>
              
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    value={procurementBarcode}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProcurementBarcode(val);
                      const prod = products.find(p => p.barcode === val);
                      if (prod) {
                        setProcurementProduct(prod);
                        setProcurementQuantity(1);
                        const lastProc = procurements.find(p => p.productId === prod.id);
                        setProcurementCost(lastProc ? lastProc.costPrice : 0);
                        toast.success(`Product found: ${prod.name}`);
                      } else {
                        setProcurementProduct(null);
                      }
                    }}
                    placeholder="Enter or scan barcode..." 
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700"
                  />
                  {procurementBarcode && (
                    <button 
                      onClick={() => {
                        setProcurementBarcode('');
                        setProcurementProduct(null);
                        setProcurementQuantity(1);
                        setProcurementCost(0);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
                <button 
                  onClick={() => { setScanType('procurement'); setIsScanning(true); }}
                  className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/10"
                >
                  <Scan size={24} /> Scan
                </button>
              </div>
            </div>

            {procurementBarcode && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-gray-100"
              >
                {procurementProduct ? (
                  <div className="flex gap-6">
                    <div className="w-32 h-32 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 p-2">
                      <img src={procurementProduct.imageUrl} alt={procurementProduct.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-black text-gray-900">{procurementProduct.name}</h4>
                      <p className="text-sm font-bold text-gray-400 uppercase mb-4">{procurementProduct.unit} • Current Stock: {procurementProduct.stock}</p>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs font-black text-gray-400 uppercase mb-1">Add Quantity</label>
                          <input 
                            type="number" 
                            value={procurementQuantity}
                            onChange={(e) => setProcurementQuantity(parseInt(e.target.value))}
                            className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-black text-gray-400 uppercase mb-1">Cost Price (per unit)</label>
                          <input 
                            type="number" 
                            value={procurementCost}
                            onChange={(e) => setProcurementCost(parseFloat(e.target.value))}
                            className="w-full bg-gray-50 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={async () => {
                          try {
                            // 1. Update Product Stock
                            await updateDoc(doc(db, 'products', procurementProduct.id), {
                              stock: procurementProduct.stock + procurementQuantity
                            });

                            // 2. Save Procurement Record
                            await addDoc(collection(db, 'procurements'), {
                              productId: procurementProduct.id,
                              quantity: procurementQuantity,
                              costPrice: procurementCost,
                              createdAt: serverTimestamp(),
                              adminId: auth.currentUser?.uid
                            });

                            toast.success('Stock updated successfully');
                            setProcurementBarcode('');
                            setProcurementProduct(null);
                            setProcurementQuantity(1);
                            setProcurementCost(0);
                          } catch (error) {
                            toast.error('Failed to update stock');
                          }
                        }}
                        className="w-full bg-[#FF3269] text-white px-8 py-3 rounded-xl font-black hover:bg-[#E62D5E] transition-all"
                      >
                        Update Stock
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="font-black text-gray-800 mb-4">Product with barcode "{procurementBarcode}" not found.</p>
                    <button 
                      onClick={() => {
                        setEditingProduct(null);
                        setProductForm({ barcode: procurementBarcode, categoryId: 'fruits-veg' });
                        setIsProductModalOpen(true);
                      }}
                      className="bg-gray-900 text-white px-8 py-3 rounded-xl font-black hover:bg-gray-800 transition-all"
                    >
                      Add New Product
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Procurement History */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-xl font-black text-gray-900">Procurement History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-400 text-xs font-black uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Product</th>
                      <th className="px-6 py-4">Quantity</th>
                      <th className="px-6 py-4">Cost Price</th>
                      <th className="px-6 py-4">Total Cost</th>
                      <th className="px-6 py-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {procurements.map((proc) => {
                      const product = products.find(p => p.id === proc.productId);
                      return (
                        <tr key={proc.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100 p-1">
                                <img src={product?.imageUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                              </div>
                              <span className="font-bold text-gray-900">{product?.name || 'Unknown Product'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-gray-900">{proc.quantity}</td>
                          <td className="px-6 py-4 font-bold text-gray-900">₹{proc.costPrice}</td>
                          <td className="px-6 py-4 font-black text-[#FF3269]">₹{proc.quantity * proc.costPrice}</td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-500">
                            {proc.createdAt?.toDate ? format(proc.createdAt.toDate(), 'MMM d, HH:mm') : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                    {procurements.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold">
                          No procurement records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-900">Customer Management</h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name or email..." 
                    className="pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-[#FF3269] outline-none text-sm font-medium w-64"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-400 text-xs font-black uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Orders</th>
                      <th className="px-6 py-4">Total Spent</th>
                      <th className="px-6 py-4">Address</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users
                      .filter(u => 
                        u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) || 
                        u.email.toLowerCase().includes(userSearch.toLowerCase())
                      )
                      .map((u) => {
                        const userOrders = orders.filter(o => o.userId === u.uid);
                        const totalSpent = userOrders.reduce((sum, o) => sum + o.totalAmount, 0);
                        
                        return (
                          <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden border border-gray-100">
                                  {u.photoURL ? (
                                    <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-black">
                                      {u.displayName?.[0] || u.email[0].toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{u.displayName || 'Anonymous'}</p>
                                  <p className="text-xs text-gray-400 font-medium">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                u.role === 'admin' ? 'bg-[#FF3269]/10 text-[#FF3269]' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-gray-900">{userOrders.length}</td>
                            <td className="px-6 py-4 font-black text-gray-900">₹{totalSpent}</td>
                            <td className="px-6 py-4">
                              <p className="text-xs text-gray-500 font-medium max-w-[200px] truncate">{u.address || 'No address set'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <select 
                                value={u.role}
                                onChange={async (e) => {
                                  try {
                                    await updateDoc(doc(db, 'users', u.uid), { role: e.target.value });
                                    toast.success(`User role updated to ${e.target.value}`);
                                  } catch (error) {
                                    toast.error('Failed to update role');
                                  }
                                }}
                                className="bg-gray-100 border-none rounded-lg text-xs font-bold py-1 px-2 focus:ring-2 focus:ring-[#FF3269] outline-none"
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rider-matching' && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">Rider Matching System</h3>
                  <p className="text-gray-500 font-medium">Real-time geospatial assignment for pending orders.</p>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Online</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Busy</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Offline</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setFilterOnlineOnly(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${filterOnlineOnly ? 'bg-white text-[#FF3269] shadow-sm' : 'text-gray-400'}`}
                    >
                      Online Only
                    </button>
                    <button 
                      onClick={() => setFilterOnlineOnly(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${!filterOnlineOnly ? 'bg-white text-[#FF3269] shadow-sm' : 'text-gray-400'}`}
                    >
                      All Riders
                    </button>
                  </div>
                  <div className="px-4 py-2 bg-green-50 text-green-600 rounded-xl font-bold text-sm flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    {riders.filter(r => r.status === 'online').length} Online
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pending Orders List */}
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-gray-400 uppercase tracking-wider">Pending Orders</h4>
                  {orders.filter(o => o.status === 'pending' || o.status === 'placed').map(order => (
                    <motion.div
                      key={order.id}
                      layoutId={order.id}
                      onClick={() => setSelectedOrderForMatching(order)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        selectedOrderForMatching?.id === order.id 
                          ? 'border-[#FF3269] bg-[#FF3269]/5' 
                          : 'border-gray-100 hover:border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-black text-gray-400">#{order.id.slice(-6)}</span>
                        <span className="text-xs font-black text-[#FF3269]">₹{order.totalAmount}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-800 truncate">{order.deliveryAddress}</p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] font-bold text-gray-400">
                          {order.items.length} items • {format(order.createdAt?.toDate?.() || new Date(), 'HH:mm')}
                        </p>
                        {order.pickupLocation && (
                          <div className="flex items-center gap-1 text-[10px] font-black text-[#FF3269] uppercase tracking-tighter">
                            <MapPin size={10} /> Has Location
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {orders.filter(o => o.status === 'pending' || o.status === 'placed').length === 0 && (
                    <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                      <p className="text-gray-400 font-bold">No pending orders to match.</p>
                    </div>
                  )}
                </div>

                {/* Matching Logic Demo */}
                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-200">
                  <div className="mb-6">
                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-4">Rider Assignment Map</h4>
                    <RiderMap 
                      riders={filterOnlineOnly ? riders.filter(r => r.status === 'online') : riders} 
                      pendingOrders={orders.filter(o => o.status === 'pending' || o.status === 'placed')}
                      selectedOrderId={selectedOrderForMatching?.id}
                      hoveredRiderId={hoveredRiderId}
                    />
                  </div>

                  {selectedOrderForMatching ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-black text-gray-900">Matching Analysis</h4>
                        <button
                          disabled={isMatching}
                          onClick={async () => {
                            setIsMatching(true);
                            setMatchingResults([]);
                            setAssignedRiderId(null);
                            
                            // Simulate algorithm steps
                            toast.info("Step 1: Fetching nearby riders via Geohash...");
                            await new Promise(r => setTimeout(r, 800));
                            
                            const filteredRiders = filterOnlineOnly ? riders.filter(r => r.status === 'online') : riders;
                            const results = await riderAssignmentService.findBestRiders(
                              selectedOrderForMatching as any,
                              filteredRiders as any
                            );
                            
                            toast.info(`Step 2: Found ${results.length} riders. Calculating ETA via A*...`);
                            await new Promise(r => setTimeout(r, 1000));
                            
                            setMatchingResults(results);
                            setIsMatching(false);
                            toast.success("Matching complete! Ranking riders by score.");
                          }}
                          className="px-6 py-2 bg-gray-900 text-white rounded-xl font-black text-sm hover:bg-gray-800 transition-all disabled:opacity-50"
                        >
                          {isMatching ? 'Running Algorithm...' : 'Run Matching Algorithm'}
                        </button>
                      </div>

                      {matchingResults.length > 0 ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-black text-gray-400 uppercase tracking-wider">Algorithm Recommendations</h5>
                            <button 
                              onClick={() => setMatchingResults([])}
                              className="text-[10px] font-black text-[#FF3269] uppercase hover:underline"
                            >
                              Clear Results
                            </button>
                          </div>
                          {matchingResults.map((result, index) => {
                            const rider = riders.find(r => r.id === result.riderId);
                            return (
                              <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                key={result.riderId}
                                onMouseEnter={() => setHoveredRiderId(result.riderId)}
                                onMouseLeave={() => setHoveredRiderId(null)}
                                className={`p-4 rounded-2xl bg-white border-2 flex items-center justify-between transition-all ${
                                  assignedRiderId === result.riderId ? 'border-green-500 bg-green-50' : 
                                  hoveredRiderId === result.riderId ? 'border-[#FF3269] shadow-md scale-[1.02]' : 'border-gray-100'
                                }`}
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-black text-gray-400">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-black text-gray-900">{rider?.name}</p>
                                      <div className={`w-2 h-2 rounded-full ${
                                        rider?.status === 'online' ? 'bg-green-500' : 
                                        rider?.status === 'busy' ? 'bg-amber-500' : 'bg-red-500'
                                      }`} title={rider?.status} />
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                      <span className="flex items-center gap-1"><Clock size={10} /> {result.eta} mins</span>
                                      <span>•</span>
                                      <span>{result.distance.toFixed(1)} km</span>
                                      <span>•</span>
                                      <span className="text-yellow-600">★ {rider?.rating}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-black text-[#FF3269]">Score: {result.score.toFixed(2)}</p>
                                  <button
                                    onClick={async () => {
                                      setAssignedRiderId(result.riderId);
                                      
                                      // Dispatch via Backend
                                      const dispatchResponse = await fetch('/api/dispatch', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ order: selectedOrderForMatching, riders: [result] })
                                      });
                                      
                                      if (dispatchResponse.ok) {
                                        toast.success(`Order dispatched to ${rider?.name}!`);
                                        // Update order status in Firestore
                                        await updateDoc(doc(db, 'orders', selectedOrderForMatching.id), {
                                          status: 'processing',
                                          assignedRiderId: result.riderId,
                                          assignedAt: serverTimestamp()
                                        });

                                        // Log the assignment
                                        await addDoc(collection(db, 'assignment_logs'), {
                                          orderId: selectedOrderForMatching.id,
                                          riderId: result.riderId,
                                          riderName: rider?.name || 'Unknown Rider',
                                          assignedAt: serverTimestamp(),
                                          status: 'assigned',
                                          distance: result.distance,
                                          eta: result.eta,
                                          surgeMultiplier: selectedOrderForMatching.surgeMultiplier || 1.0
                                        });

                                        setSelectedOrderForMatching(null);
                                        setMatchingResults([]);
                                      }
                                    }}
                                    className="mt-2 px-4 py-1 bg-[#FF3269] text-white rounded-lg font-black text-[10px] hover:bg-[#E62D5E] transition-all"
                                  >
                                    Assign
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black text-gray-400 uppercase tracking-wider">Manual Selection</h5>
                            <span className="text-[10px] font-bold text-gray-400">
                              {filterOnlineOnly ? 'Showing Online Only' : 'Showing All Riders'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {(filterOnlineOnly ? riders.filter(r => r.status === 'online') : riders).map((rider) => (
                              <button
                                key={rider.id}
                                onClick={async () => {
                                  if (!selectedOrderForMatching) return;
                                  
                                  setAssignedRiderId(rider.id);
                                  toast.loading(`Assigning to ${rider.name}...`, { id: 'manual-assign' });
                                  
                                  try {
                                    const distance = calculateHaversineDistance(
                                      rider.location.lat,
                                      rider.location.lng,
                                      selectedOrderForMatching.pickupLocation.lat,
                                      selectedOrderForMatching.pickupLocation.lng
                                    );
                                    const eta = calculateETA(
                                      rider.location.lat,
                                      rider.location.lng,
                                      selectedOrderForMatching.pickupLocation.lat,
                                      selectedOrderForMatching.pickupLocation.lng
                                    );

                                    // Dispatch via Backend
                                    const dispatchResponse = await fetch('/api/dispatch', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ order: selectedOrderForMatching, riders: [{ riderId: rider.id, score: 1, distance, eta }] })
                                    });

                                    if (dispatchResponse.ok) {
                                      // Update order status in Firestore
                                      await updateDoc(doc(db, 'orders', selectedOrderForMatching.id), {
                                        status: 'processing',
                                        assignedRiderId: rider.id,
                                        assignedAt: serverTimestamp()
                                      });

                                      // Log the assignment
                                      await addDoc(collection(db, 'assignment_logs'), {
                                        orderId: selectedOrderForMatching.id,
                                        riderId: rider.id,
                                        riderName: rider.name,
                                        assignedAt: serverTimestamp(),
                                        status: 'assigned',
                                        distance: distance,
                                        eta: eta,
                                        surgeMultiplier: selectedOrderForMatching.surgeMultiplier || 1.0
                                      });

                                      toast.success(`Order manually dispatched to ${rider.name}!`, { id: 'manual-assign' });
                                      setSelectedOrderForMatching(null);
                                      setMatchingResults([]);
                                      setAssignedRiderId(null);
                                    }
                                  } catch (error) {
                                    console.error('Manual Assignment Error:', error);
                                    toast.error('Failed to assign rider manually', { id: 'manual-assign' });
                                  }
                                }}
                                className="p-3 rounded-xl bg-white border border-gray-100 hover:border-[#FF3269] hover:shadow-md transition-all text-left flex items-center gap-3 group"
                              >
                                <div className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center font-black text-[#FF3269] group-hover:bg-[#FF3269] group-hover:text-white transition-colors">
                                  {rider.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-black text-gray-900 truncate">{rider.name}</p>
                                    <div className={`w-1.5 h-1.5 rounded-full ${
                                      rider.status === 'online' ? 'bg-green-500' : 
                                      rider.status === 'busy' ? 'bg-amber-500' : 'bg-red-500'
                                    }`} />
                                  </div>
                                  <p className="text-[9px] font-bold text-gray-400">★ {rider.rating} • {rider.status}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                          
                          <div className="pt-4 border-t border-gray-100">
                            <div className="text-center py-6">
                              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                                <Sparkles size={24} />
                              </div>
                              <p className="text-xs font-bold text-gray-400 mb-4">Or use our AI-powered matching algorithm</p>
                              <button
                                disabled={isMatching}
                                onClick={async () => {
                                  setIsMatching(true);
                                  setMatchingResults([]);
                                  setAssignedRiderId(null);
                                  
                                  // Simulate algorithm steps
                                  toast.info("Step 1: Fetching nearby riders via Geohash...");
                                  await new Promise(r => setTimeout(r, 800));
                                  
                                  const filteredRiders = filterOnlineOnly ? riders.filter(r => r.status === 'online') : riders;
                                  
                                  const response = await fetch('/api/match', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ order: selectedOrderForMatching, riders: filteredRiders })
                                  });
                                  const results = await response.json();
                                  
                                  toast.info(`Step 2: Found ${results.length} riders. Calculating ETA via A*...`);
                                  await new Promise(r => setTimeout(r, 1000));
                                  
                                  setMatchingResults(results);
                                  setIsMatching(false);
                                  toast.success("Matching complete! Ranking riders by score.");
                                }}
                                className="px-8 py-3 bg-gray-900 text-white rounded-xl font-black text-sm hover:bg-gray-800 transition-all disabled:opacity-50 shadow-lg shadow-gray-900/20"
                              >
                                {isMatching ? 'Running Algorithm...' : 'Run Matching Algorithm'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20">
                      <Sparkles className="text-[#FF3269] mb-4 opacity-20" size={48} />
                      <h4 className="text-lg font-black text-gray-900 mb-2">Ready to Match</h4>
                      <p className="text-gray-400 font-medium max-w-xs">Select a pending order from the left to begin the high-performance matching process.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Algorithm Explanation Card */}
            <div className="bg-gray-900 text-white p-8 rounded-3xl shadow-xl">
              <h4 className="text-xl font-black mb-6 flex items-center gap-2">
                <Settings size={24} className="text-[#FF3269]" />
                How the Algorithm Works
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <div className="text-[#FF3269] font-black text-lg">01. Spatial Indexing</div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Uses <strong>Geohashes</strong> to partition the map. Instead of O(N) search, we perform O(1) proximity lookups in Redis/Firestore.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-[#FF3269] font-black text-lg">02. A* Pathfinding</div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Calculates real-world ETA using road networks and traffic factors, not just straight-line distance.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="text-[#FF3269] font-black text-lg">03. Multi-Factor Scoring</div>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Ranks riders using a weighted formula: <code>Score = w1*ETA + w2*Rating + w3*Acceptance</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rider-assignment-history' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight">Assignment History</h2>
                <p className="text-gray-500 font-medium">Log of all rider assignments and their status.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-6 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center gap-3">
                  <div className="w-3 h-3 bg-[#FF3269] rounded-full animate-pulse" />
                  <span className="text-sm font-black text-gray-900">{assignmentLogs.length} Assignments Logged</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search by Order ID or Rider Name..."
                  value={assignmentSearch}
                  onChange={(e) => setAssignmentSearch(e.target.value)}
                  className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700 shadow-sm"
                />
              </div>
              <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                {(['all', 'assigned', 'rejected', 'completed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setAssignmentStatusFilter(status)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      assignmentStatusFilter === status 
                        ? 'bg-[#FF3269] text-white shadow-md' 
                        : 'text-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[40px] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-wider">Order ID</th>
                      <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-wider">Rider</th>
                      <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-wider">Assigned At</th>
                      <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-8 py-6 text-xs font-black text-gray-400 uppercase tracking-wider">Metrics</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {assignmentLogs
                      .filter(log => {
                        const matchesSearch = log.orderId.toLowerCase().includes(assignmentSearch.toLowerCase()) || 
                                           log.riderName.toLowerCase().includes(assignmentSearch.toLowerCase());
                        const matchesStatus = assignmentStatusFilter === 'all' || log.status === assignmentStatusFilter;
                        return matchesSearch && matchesStatus;
                      })
                      .map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-8 py-6">
                          <span className="text-sm font-black text-gray-900">#{log.orderId.slice(-6)}</span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-black text-[#FF3269]">
                              {log.riderName[0]}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-black text-gray-900">{log.riderName}</p>
                                {riders.find(r => r.id === log.riderId) && (
                                  <div className={`w-1.5 h-1.5 rounded-full ${
                                    riders.find(r => r.id === log.riderId)?.status === 'online' ? 'bg-green-500' : 
                                    riders.find(r => r.id === log.riderId)?.status === 'busy' ? 'bg-amber-500' : 'bg-red-500'
                                  }`} />
                                )}
                              </div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ID: {log.riderId.slice(-6)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <p className="text-sm font-bold text-gray-600">
                            {format(log.assignedAt?.toDate?.() || new Date(), 'MMM dd, HH:mm')}
                          </p>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            log.status === 'assigned' ? 'bg-blue-50 text-blue-600' :
                            log.status === 'completed' ? 'bg-green-50 text-green-600' :
                            'bg-red-50 text-red-600'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1">
                                <MapPin size={12} className="text-gray-400" />
                                <span className="text-xs font-bold text-gray-600">{log.distance?.toFixed(1)} km</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock size={12} className="text-gray-400" />
                                <span className="text-xs font-bold text-gray-600">{log.eta} mins</span>
                              </div>
                            </div>
                            {log.surgeMultiplier && log.surgeMultiplier > 1 && (
                              <div className="flex items-center gap-1 text-[10px] font-black text-amber-600">
                                <TrendingUp size={10} />
                                <span>{log.surgeMultiplier}x Surge</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {assignmentLogs
                      .filter(log => {
                        const matchesSearch = log.orderId.toLowerCase().includes(assignmentSearch.toLowerCase()) || 
                                           log.riderName.toLowerCase().includes(assignmentSearch.toLowerCase());
                        const matchesStatus = assignmentStatusFilter === 'all' || log.status === assignmentStatusFilter;
                        return matchesSearch && matchesStatus;
                      }).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                              <Clock size={32} />
                            </div>
                            <p className="text-gray-400 font-bold">No assignment history found matching your criteria.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-2xl font-black text-gray-900 mb-6">System Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-200">
                  <h4 className="text-lg font-black text-gray-900 mb-2">Database Management</h4>
                  <p className="text-gray-500 text-sm font-medium mb-6">Reset and seed the database with mock categories, products, riders, and orders for testing.</p>
                  <button 
                    onClick={async () => {
                      if (window.confirm('Are you sure? This will clear all existing products and seed new data.')) {
                        setIsLoading(true);
                        await seedDatabase();
                        setIsLoading(false);
                        toast.success('Database seeded successfully!');
                      }
                    }}
                    className="w-full py-4 bg-[#FF3269] text-white rounded-2xl font-black shadow-lg shadow-[#FF3269]/20 hover:bg-[#E62D5E] transition-all flex items-center justify-center gap-2"
                  >
                    <Database size={20} /> Seed Database
                  </button>
                </div>
                
                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-200">
                  <h4 className="text-lg font-black text-gray-900 mb-2">Admin Profile</h4>
                  <div className="flex items-center gap-4 mt-4">
                    <div className="w-12 h-12 rounded-full bg-[#FF3269]/10 flex items-center justify-center text-[#FF3269] font-black">
                      {auth.currentUser?.email?.[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-gray-900">{auth.currentUser?.email}</p>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">System Administrator</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                    <Settings size={20} />
                  </div>
                  <h3 className="text-xl font-black text-gray-900">Store Settings</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase ml-1">Store Name</label>
                    <input 
                      type="text" 
                      defaultValue="Retail Management"
                      className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase ml-1">Contact Email</label>
                    <input 
                      type="email" 
                      defaultValue="contact@store.com"
                      className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase ml-1">Currency</label>
                    <select className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700">
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                  <button className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black hover:bg-gray-800 transition-all mt-4">
                    Save General Settings
                  </button>
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                      <Tag size={20} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900">Categories</h3>
                  </div>
                  <button 
                    onClick={async () => {
                      const name = window.prompt('Enter category name:');
                      if (!name) return;
                      try {
                        await addDoc(collection(db, 'categories'), {
                          name,
                          imageUrl: 'https://picsum.photos/seed/cat/200/200',
                          order: categories.length
                        });
                        toast.success('Category added');
                      } catch (error) {
                        toast.error('Failed to add category');
                      }
                    }}
                    className="text-[#FF3269] font-black text-sm hover:underline flex items-center gap-1"
                  >
                    <Plus size={14} /> Add New
                  </button>
                </div>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white overflow-hidden border border-gray-100 p-1">
                          <img src={cat.imageUrl} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <span className="font-bold text-gray-800">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={async () => {
                            const newName = window.prompt('Edit category name:', cat.name);
                            if (!newName) return;
                            try {
                              await updateDoc(doc(db, 'categories', cat.id), { name: newName });
                              toast.success('Category updated');
                            } catch (error) {
                              toast.error('Failed to update category');
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={async () => {
                            if (!window.confirm('Delete this category? Products in this category will remain but the category will be gone.')) return;
                            try {
                              await deleteDoc(doc(db, 'categories', cat.id));
                              toast.success('Category deleted');
                            } catch (error) {
                              toast.error('Failed to delete category');
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
                    <AlertTriangle size={20} />
                  </div>
                  <h3 className="text-xl font-black text-gray-900">Danger Zone</h3>
                </div>
                
                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-500 mb-4">These actions are permanent and cannot be undone. Please be careful.</p>
                  
                  <button 
                    onClick={handleClearAllProducts}
                    disabled={isClearing}
                    className="w-full bg-white text-red-600 border-2 border-red-100 py-4 rounded-2xl font-black hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                  >
                    {isClearing ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                    Delete All Products
                  </button>
                  
                  <button 
                    onClick={handleResetDatabase}
                    disabled={isSeeding}
                    className="w-full bg-red-600 text-white py-4 rounded-2xl font-black hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                  >
                    {isSeeding ? <Loader2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
                    Reset Entire Database
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Bulk Stock Update Modal */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 bg-orange-500 text-white">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <RefreshCw size={24} />
                  </div>
                  <button onClick={() => setIsBulkModalOpen(false)} className="hover:bg-white/20 p-2 rounded-xl transition-all">
                    <X size={24} />
                  </button>
                </div>
                <h3 className="text-2xl font-black">Bulk Stock Update</h3>
                <p className="text-orange-100 font-bold">Updating {selectedProducts.length} selected products</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase ml-1">New Stock Level</label>
                  <input 
                    type="number" 
                    value={bulkStockValue}
                    onChange={(e) => setBulkStockValue(parseInt(e.target.value))}
                    className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-orange-500 outline-none font-black text-2xl text-gray-700"
                    placeholder="0"
                  />
                  <p className="text-[10px] font-bold text-gray-400 ml-1">This will overwrite the current stock for all selected products.</p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setIsBulkModalOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-2xl font-black hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleBulkStockUpdate}
                    disabled={isBulkUpdating}
                    className="flex-1 bg-orange-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isBulkUpdating ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    Update All
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Edit Modal */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProductModalOpen(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div>
                  <h3 className="text-2xl font-black text-gray-900">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Inventory Management</p>
                </div>
                <button 
                  onClick={() => setIsProductModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase ml-1">Product Name</label>
                    <input 
                      type="text" 
                      value={productForm.name || ''}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700"
                      placeholder="e.g. Banana Robusta"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase ml-1">Unit</label>
                    <input 
                      type="text" 
                      value={productForm.unit || ''}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700"
                      placeholder="e.g. 500g, 1L"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase ml-1">Base Price (₹)</label>
                    <input 
                      type="number" 
                      value={productForm.price || ''}
                      onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                      className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase ml-1">Discount Price (₹)</label>
                    <input 
                      type="number" 
                      value={productForm.discountPrice || ''}
                      onChange={(e) => setProductForm({ ...productForm, discountPrice: Number(e.target.value) })}
                      className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase ml-1">Stock Level</label>
                    <input 
                      type="number" 
                      value={productForm.stock || ''}
                      onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                      className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase ml-1">Category ID</label>
                    <input 
                      type="text" 
                      value={productForm.categoryId || ''}
                      onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                      className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase ml-1">Barcode</label>
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      value={productForm.barcode || ''}
                      onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                      className="flex-1 bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-mono font-bold text-gray-700"
                      placeholder="Scan or enter barcode"
                    />
                    <button 
                      onClick={() => { setScanType('edit'); setIsScanning(true); }}
                      className="bg-gray-900 text-white px-4 rounded-2xl hover:bg-gray-800 transition-all"
                    >
                      <Scan size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase ml-1">Main Image URL</label>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <input 
                          type="text" 
                          value={productForm.imageUrl || ''}
                          onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                          className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700"
                          placeholder="https://..."
                        />
                      </div>
                      <button 
                        onClick={() => generateProductImage('imageUrl')}
                        disabled={isGeneratingImage}
                        className="bg-[#FF3269]/10 text-[#FF3269] px-4 rounded-2xl font-black hover:bg-[#FF3269]/20 transition-all disabled:opacity-50 flex items-center gap-2"
                        title="Generate with AI"
                      >
                        {isGeneratingImage ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                      </button>
                    </div>
                  </div>
                  
                  {productForm.imageUrl && (
                    <div className="w-24 h-24 rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden ml-1">
                      <img src={productForm.imageUrl} alt="Preview" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-xs font-black text-gray-400 uppercase">Additional Images</label>
                    <button 
                      onClick={() => {
                        const currentImages = productForm.images || [];
                        setProductForm({ ...productForm, images: [...currentImages, ''] });
                      }}
                      className="text-[#FF3269] text-xs font-black flex items-center gap-1 hover:underline"
                    >
                      <Plus size={14} /> Add Image
                    </button>
                  </div>
                  <div className="space-y-6">
                    {(productForm.images || []).map((img, idx) => (
                      <div key={idx} className="space-y-3">
                        <div className="flex gap-3">
                          <input 
                            type="text" 
                            value={img}
                            onChange={(e) => {
                              const newImages = [...(productForm.images || [])];
                              newImages[idx] = e.target.value;
                              setProductForm({ ...productForm, images: newImages });
                            }}
                            className="flex-1 bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700 text-sm"
                            placeholder="Additional image URL..."
                          />
                          <button 
                            onClick={() => generateProductImage(idx)}
                            disabled={isGeneratingImage}
                            className="bg-[#FF3269]/10 text-[#FF3269] px-3 rounded-2xl font-black hover:bg-[#FF3269]/20 transition-all disabled:opacity-50"
                            title="Generate with AI"
                          >
                            <Sparkles size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              const newImages = (productForm.images || []).filter((_, i) => i !== idx);
                              setProductForm({ ...productForm, images: newImages });
                            }}
                            className="p-3 text-gray-400 hover:text-red-500 bg-gray-50 rounded-2xl transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        {img && (
                          <div className="w-20 h-20 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden ml-1">
                            <img src={img} alt="Preview" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex gap-4">
                <button 
                  onClick={() => setIsProductModalOpen(false)}
                  className="flex-1 bg-white border-2 border-gray-200 text-gray-500 py-4 rounded-2xl font-black hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveProduct}
                  className="flex-1 bg-[#FF3269] text-white py-4 rounded-2xl font-black shadow-lg shadow-[#FF3269]/20 hover:bg-[#E62D5E] transition-all flex items-center justify-center gap-2"
                >
                  <Save size={20} /> Save Product
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating AI Assistant Logo */}
      {isAdmin && activeTab === 'pos' && (
        <AIAssistant 
          dataContext={{
            stats: {
              todaySales: stats.today,
              weekSales: stats.week,
              monthSales: stats.month,
              yearSales: stats.year,
              totalRevenue: stats.totalRevenue,
              totalOrders: stats.totalOrders,
              lowStockCount: stats.lowStock,
              damagedProductCount: products.filter(p => (p.damagedCount || 0) > 0).length
            },
            allProducts: products.map(p => ({ 
              name: p.name, 
              stock: p.stock, 
              damaged: p.damagedCount || 0,
              price: p.discountPrice || p.price
            })),
            lowStockProducts: products.filter(p => p.stock < 10).map(p => ({ name: p.name, stock: p.stock })),
            damagedProducts: products.filter(p => (p.damagedCount || 0) > 0).map(p => ({ name: p.name, damaged: p.damagedCount })),
            recentOrders: orders.slice(0, 5).map(o => ({ id: o.id, amount: o.totalAmount, status: o.status })),
            recentStoreSales: storeSales.slice(0, 5).map(s => ({ 
              id: s.id, 
              amount: s.totalAmount, 
              method: s.paymentMethod,
              customer: s.customerName || 'Walk-in',
              discount: s.discount || 0
            }))
          }}
          last7Days={last7Days}
          products={products}
        />
      )}
    </div>
  );
};
