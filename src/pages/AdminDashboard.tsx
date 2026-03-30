import React, { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, getDocs, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { Order, Product, Procurement, Sale } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, ShoppingBag, Users, Package, Search, 
  Loader2, AlertTriangle, CheckCircle, 
  Clock, Truck, XCircle, ArrowUpRight, ArrowDownRight, RefreshCw,
  Scan, ShoppingCart, CreditCard, Banknote, Plus, Minus, Trash2, Sparkles,
  Edit, Save, X, Upload, FileText, ChevronLeft, ChevronRight, Check, Square, Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { GoogleGenAI } from "@google/genai";
import { format, startOfDay, startOfWeek, startOfMonth, startOfYear, isAfter, subDays, subMonths } from 'date-fns';
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
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'inventory' | 'procurement' | 'pos' | 'sales'>('overview');
  const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;
  
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
    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
      window.location.href = '/';
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

    if (auth.currentUser && !auth.currentUser.emailVerified) {
      console.log('User email not verified:', auth.currentUser.email);
      toast.error('Your email is not verified. Some administrative actions may be restricted.', {
        description: 'Please verify your email to ensure full access.',
        duration: 10000,
      });
    }

    console.log('Admin Status:', {
      currentUser: auth.currentUser?.email,
      isAdmin: auth.currentUser?.email === ADMIN_EMAIL,
      emailVerified: auth.currentUser?.emailVerified
    });

    return () => {
      unsubOrders();
      unsubProducts();
      unsubStoreSales();
      unsubProcurements();
    };
  }, []);

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

  const categoryData = products.reduce((acc: any[], p) => {
    const existing = acc.find(a => a.name === p.categoryId);
    if (existing) existing.value++;
    else acc.push({ name: p.categoryId, value: 1 });
    return acc;
  }, []);

  const COLORS = ['#FF3269', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

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
      setProcurementBarcode(barcode);
      const prod = products.find(p => p.barcode === barcode);
      setProcurementProduct(prod || null);
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
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-black text-[#FF3269] tracking-tighter">ADMIN PANEL</h1>
          <p className="text-xs font-bold text-gray-400 uppercase mt-1">Retail Management</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'overview' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <TrendingUp size={20} /> Overview
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'orders' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <ShoppingBag size={20} /> Orders
          </button>
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'inventory' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Package size={20} /> Inventory
          </button>
          <button 
            onClick={() => setActiveTab('pos')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'pos' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <ShoppingCart size={20} /> Store POS
          </button>
          <button 
            onClick={() => setActiveTab('sales')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'sales' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Banknote size={20} /> Store Sales
          </button>
          <button 
            onClick={() => setActiveTab('procurement')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'procurement' ? 'bg-[#FF3269] text-white shadow-lg shadow-[#FF3269]/20' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Scan size={20} /> Procurement
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
        <header className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-gray-900 capitalize">{activeTab}</h2>
            <p className="text-gray-500 font-medium">Welcome back, Admin. Here's what's happening today.</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleResetDatabase}
              disabled={isSeeding}
              className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all disabled:opacity-50"
            >
              {isSeeding ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Reset Database
            </button>
            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex items-center gap-2 px-4">
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
                { label: 'Today Sales', value: `₹${stats.today}`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Weekly Sales', value: `₹${stats.week}`, icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Monthly Sales', value: `₹${stats.month}`, icon: ShoppingBag, color: 'text-purple-600', bg: 'bg-purple-50' },
                { label: 'Total Revenue', value: `₹${stats.totalRevenue}`, icon: TrendingUp, color: 'text-[#FF3269]', bg: 'bg-[#FF3269]/10' },
              ].map((stat, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={stat.label} 
                  className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"
                >
                  <div className={`${stat.bg} ${stat.color} w-12 h-12 rounded-2xl flex items-center justify-center mb-4`}>
                    <stat.icon size={24} />
                  </div>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                  <h3 className="text-2xl font-black text-gray-900 mt-1">{stat.value}</h3>
                </motion.div>
              ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
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

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
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
                      <p className="text-xs font-bold text-gray-400 uppercase">Active Orders</p>
                      <p className="text-2xl font-black text-gray-900">{stats.activeOrders}</p>
                    </div>
                  </div>
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
                <input 
                  type="text" 
                  value={procurementBarcode}
                  onChange={(e) => {
                    setProcurementBarcode(e.target.value);
                    const prod = products.find(p => p.barcode === e.target.value);
                    setProcurementProduct(prod || null);
                  }}
                  placeholder="Enter or scan barcode..." 
                  className="flex-1 bg-gray-50 border-none rounded-2xl py-4 px-6 focus:ring-2 focus:ring-[#FF3269] outline-none font-bold text-gray-700"
                />
                <button 
                  onClick={() => { setScanType('procurement'); setIsScanning(true); }}
                  className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 hover:bg-gray-800 transition-all"
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
