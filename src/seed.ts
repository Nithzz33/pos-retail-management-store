import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, addDoc, getDocs, query, limit, deleteDoc, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { geohashForLocation } from 'geofire-common';

const categories: any[] = [
  { id: 'cat1', name: 'Fresh Vegetables', icon: 'Carrot', color: 'bg-green-100 text-green-600', imageUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=200' },
  { id: 'cat2', name: 'Fresh Fruits', icon: 'Apple', color: 'bg-red-100 text-red-600', imageUrl: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&q=80&w=200' },
  { id: 'cat3', name: 'Dairy & Eggs', icon: 'Milk', color: 'bg-blue-100 text-blue-600', imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=200' },
  { id: 'cat4', name: 'Bakery', icon: 'Croissant', color: 'bg-amber-100 text-amber-600', imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200' },
  { id: 'cat5', name: 'Snacks & Beverages', icon: 'Coffee', color: 'bg-purple-100 text-purple-600', imageUrl: 'https://images.unsplash.com/photo-1599598425947-33002629ee98?auto=format&fit=crop&q=80&w=200' },
  { id: 'cat6', name: 'Meat & Seafood', icon: 'Fish', color: 'bg-rose-100 text-rose-600', imageUrl: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&q=80&w=200' },
  { id: 'cat7', name: 'Pantry Staples', icon: 'Wheat', color: 'bg-yellow-100 text-yellow-600', imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=200' },
  { id: 'cat8', name: 'Household', icon: 'Sparkles', color: 'bg-teal-100 text-teal-600', imageUrl: 'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&q=80&w=200' }
];

const productBases: any[] = [
  { name: 'Organic Bananas', categoryId: 'cat2', price: 60, unit: '1 kg', stock: 50, imageUrl: 'https://images.unsplash.com/photo-1571501478200-8f1b621457bd?auto=format&fit=crop&q=80&w=400' },
  { name: 'Fresh Milk', categoryId: 'cat3', price: 35, unit: '500 ml', stock: 100, imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=400' },
  { name: 'Whole Wheat Bread', categoryId: 'cat4', price: 45, unit: '400 g', stock: 30, imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400' },
  { name: 'Potato', categoryId: 'cat1', price: 40, unit: '1 kg', stock: 200, imageUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&q=80&w=400' },
  { name: 'Onion', categoryId: 'cat1', price: 50, unit: '1 kg', stock: 150, imageUrl: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?auto=format&fit=crop&q=80&w=400' },
  { name: 'Tomato', categoryId: 'cat1', price: 30, unit: '1 kg', stock: 100, imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&q=80&w=400' },
  { name: 'Eggs', categoryId: 'cat3', price: 60, unit: '6 pcs', stock: 80, imageUrl: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&q=80&w=400' },
  { name: 'Chicken Breast', categoryId: 'cat6', price: 250, unit: '500 g', stock: 40, imageUrl: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&q=80&w=400' },
  { name: 'Rice', categoryId: 'cat7', price: 120, unit: '1 kg', stock: 300, imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400' },
  { name: 'Coffee Powder', categoryId: 'cat5', price: 150, unit: '100 g', stock: 60, imageUrl: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&q=80&w=400' }
];

const generateProducts = () => {
  return productBases.map(base => ({
    ...base,
    barcode: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
    damagedCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
};

export async function clearAllCategories() {
  console.log("Starting full category cleanup...");
  try {
    const categoriesSnap = await getDocs(collection(db, 'categories'));
    console.log(`Found ${categoriesSnap.size} categories to delete.`);
    
    let deleteBatch = writeBatch(db);
    let count = 0;
    for (const cDoc of categoriesSnap.docs) {
      deleteBatch.delete(cDoc.ref);
      count++;
      if (count === 500) {
        await deleteBatch.commit();
        deleteBatch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) await deleteBatch.commit();
    console.log("All categories successfully removed from database.");
    return categoriesSnap.size;
  } catch (error) {
    console.error("Error clearing categories:", error);
    handleFirestoreError(error, OperationType.DELETE, 'categories');
    throw error;
  }
}

export async function clearAllProducts() {
  console.log("Starting full product cleanup...");
  try {
    const productsSnap = await getDocs(collection(db, 'products'));
    console.log(`Found ${productsSnap.size} products to delete.`);
    
    let deleteBatch = writeBatch(db);
    let count = 0;
    for (const pDoc of productsSnap.docs) {
      deleteBatch.delete(pDoc.ref);
      count++;
      if (count === 500) {
        await deleteBatch.commit();
        deleteBatch = writeBatch(db);
        count = 0;
      }
    }
    if (count > 0) await deleteBatch.commit();
    console.log("All products successfully removed from database.");
    return productsSnap.size;
  } catch (error) {
    console.error("Error clearing products:", error);
    handleFirestoreError(error, OperationType.DELETE, 'products');
    throw error;
  }
}

export async function seedCategoriesIfEmpty() {
  try {
    const categoriesSnap = await getDocs(query(collection(db, 'categories'), limit(1)));
    if (categoriesSnap.empty) {
      console.log("No categories found. Seeding default categories...");
      const batch = writeBatch(db);
      categories.forEach(cat => {
        const docRef = doc(db, 'categories', cat.id);
        batch.set(docRef, cat);
      });
      await batch.commit();
      console.log("Default categories seeded successfully.");
    }
  } catch (error) {
    console.error("Error seeding default categories:", error);
  }
}

export async function seedDatabase() {
  console.log("Starting database cleanup...");
  
  try {
    // 1. Handle Categories (Delete ALL)
    await clearAllCategories();

    // 2. Handle Products (Delete ALL)
    await clearAllProducts();

    // 3. Seed Categories and Products
    console.log("Seeding categories and products...");
    const categoryBatch = writeBatch(db);
    for (const category of categories) {
      const catRef = doc(db, 'categories', category.id);
      categoryBatch.set(catRef, category);
    }
    await categoryBatch.commit();
    console.log("Categories seeded.");

    const productBatch = writeBatch(db);
    const newProducts = generateProducts();
    for (const product of newProducts) {
      const prodRef = doc(collection(db, 'products'));
      productBatch.set(prodRef, product);
    }
    await productBatch.commit();
    console.log("Products seeded.");

    // 4. Seed Mock Riders
    console.log("Seeding mock riders...");
    const ridersSnap = await getDocs(collection(db, 'riders'));
    if (ridersSnap.empty) {
      const riderBatch = writeBatch(db);
      const mockRiders = [
        { name: "Rahul Sharma", lat: 12.9716, lng: 77.5946, rating: 4.8, acceptanceRate: 0.95, status: 'online' },
        { name: "Amit Patel", lat: 12.9352, lng: 77.6245, rating: 4.5, acceptanceRate: 0.88, status: 'online' },
        { name: "Suresh Kumar", lat: 12.9279, lng: 77.6271, rating: 4.2, acceptanceRate: 0.75, status: 'busy' },
        { name: "Priya Singh", lat: 12.9562, lng: 77.7011, rating: 4.9, acceptanceRate: 0.98, status: 'online' },
        { name: "Deepak Verma", lat: 13.0285, lng: 77.5896, rating: 4.6, acceptanceRate: 0.92, status: 'offline' },
        { name: "Vikram Rao", lat: 12.9784, lng: 77.6408, rating: 4.7, acceptanceRate: 0.90, status: 'busy' }
      ];

      for (const rider of mockRiders) {
        const riderRef = doc(collection(db, 'riders'));
        riderBatch.set(riderRef, {
          name: rider.name,
          location: { lat: rider.lat, lng: rider.lng },
          geohash: geohashForLocation([rider.lat, rider.lng]),
          rating: rider.rating,
          acceptanceRate: rider.acceptanceRate,
          status: rider.status,
          lastUpdated: serverTimestamp()
        });
      }
      await riderBatch.commit();
      console.log("Mock riders seeded.");
    }

    // 5. Seed Mock Orders for Matching Demo
    console.log("Seeding mock orders for matching...");
    const ordersSnap = await getDocs(query(collection(db, 'orders'), limit(1)));
    if (ordersSnap.empty) {
      const orderBatch = writeBatch(db);
      const mockOrders = [
        { 
          userId: "demo-user-1", 
          items: [{ productId: "p1", name: "Fresh Apples", price: 120, quantity: 2 }],
          totalAmount: 240,
          status: "pending",
          deliveryAddress: "Indiranagar, Bangalore",
          pickupLocation: { lat: 12.9784, lng: 77.6408 },
          deliveryLocation: { lat: 12.9716, lng: 77.6412 },
          createdAt: serverTimestamp()
        },
        { 
          userId: "demo-user-2", 
          items: [{ productId: "p2", name: "Organic Milk", price: 60, quantity: 3 }],
          totalAmount: 180,
          status: "pending",
          deliveryAddress: "Koramangala, Bangalore",
          pickupLocation: { lat: 12.9352, lng: 77.6245 },
          deliveryLocation: { lat: 12.9279, lng: 77.6271 },
          createdAt: serverTimestamp()
        }
      ];

      for (const order of mockOrders) {
        const orderRef = doc(collection(db, 'orders'));
        orderBatch.set(orderRef, order);
      }
      await orderBatch.commit();
      console.log("Mock orders seeded.");
    }

  } catch (error) {
    console.error("Critical error in seedDatabase:", error);
    handleFirestoreError(error, OperationType.WRITE, 'seedDatabase');
  }
}
