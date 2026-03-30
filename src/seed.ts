import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, addDoc, getDocs, query, limit, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';

const categories = [
  { name: "Fruits & Vegetables", imageUrl: "https://cdn.zeptonow.com/production///tr:w-160,ar-160-160,pr-true,f-auto,q-80/inventory/banner/06020c64-071c-438e-8913-64998811d333.png", order: 1 },
  { name: "Dairy, Bread & Eggs", imageUrl: "https://cdn.zeptonow.com/production///tr:w-160,ar-160-160,pr-true,f-auto,q-80/inventory/banner/8014594c-8367-463e-903d-818222634351.png", order: 2 },
  { name: "Personal Care", imageUrl: "https://cdn.zeptonow.com/production///tr:w-160,ar-160-160,pr-true,f-auto,q-80/inventory/banner/87060c64-071c-438e-8913-64998811d333.png", order: 3 },
  { name: "Study Materials", imageUrl: "https://cdn.zeptonow.com/production///tr:w-160,ar-160-160,pr-true,f-auto,q-80/inventory/banner/96d0879c-9c0b-468a-9214-7e889311634b.png", order: 4 },
  { name: "Snacks & Munchies", imageUrl: "https://cdn.zeptonow.com/production///tr:w-160,ar-160-160,pr-true,f-auto,q-80/inventory/banner/26f0490b-163e-463f-9a43-85511b012345.png", order: 5 },
  { name: "Beverages", imageUrl: "https://cdn.zeptonow.com/production///tr:w-160,ar-160-160,pr-true,f-auto,q-80/inventory/banner/7014594c-8367-463e-903d-818222634351.png", order: 6 },
  { name: "Household Essentials", imageUrl: "https://cdn.zeptonow.com/production///tr:w-160,ar-160-160,pr-true,f-auto,q-80/inventory/banner/8014594c-8367-463e-903d-818222634351.png", order: 7 },
];

const productBases = [
  { category: "Fruits & Vegetables", items: ["Apple", "Orange", "Grapes", "Mango", "Watermelon", "Potato", "Onion", "Carrot", "Spinach", "Broccoli"] },
  { category: "Dairy, Bread & Eggs", items: ["Milk", "Curd", "Paneer", "Cheese", "Butter", "Egg", "Brown Bread", "White Bread", "Multigrain Bread", "Yogurt"] },
  { category: "Personal Care", items: ["Shampoo", "Conditioner", "Soap", "Face Wash", "Body Wash", "Toothpaste", "Toothbrush", "Mouthwash", "Deodorant", "Perfume"] },
  { category: "Study Materials", items: ["Notebook", "Pen", "Pencil", "Eraser", "Sharpener", "Scale", "Marker", "Highlighter", "Glue", "Stapler"] },
  { category: "Snacks & Munchies", items: ["Potato Chips", "Nachos", "Popcorn", "Biscuits", "Cookies", "Chocolate", "Wafers", "Namkeen", "Roasted Makhana", "Dry Fruits"] },
  { category: "Beverages", items: ["Tea", "Coffee", "Green Tea", "Fruit Juice", "Energy Drink", "Soft Drink", "Mineral Water", "Coconut Water", "Iced Tea", "Cold Coffee"] },
  { category: "Household Essentials", items: ["Detergent", "Dishwash Bar", "Floor Cleaner", "Toilet Cleaner", "Glass Cleaner", "Air Freshener", "Garbage Bags", "Kitchen Roll", "Toilet Paper", "Scrub Pad"] },
];

const generateProducts = () => {
  const generated: any[] = [];
  productBases.forEach(base => {
    base.items.forEach((item, index) => {
      const price = Math.floor(Math.random() * (200 - 20 + 1)) + 20;
      const stock = Math.floor(Math.random() * 200) + 10;
      
      const searchTerms = `${item.toLowerCase().replace(/\s+/g, ',')},product,whitebackground`;
      
      generated.push({
        name: item,
        price: price,
        unit: "1 Unit",
        imageUrl: `https://loremflickr.com/400/400/${searchTerms}?lock=${index + 200}`,
        images: [
          `https://loremflickr.com/400/400/${searchTerms}?lock=${index + 200}`,
          `https://loremflickr.com/400/400/${searchTerms}?lock=${index + 300}`,
          `https://loremflickr.com/400/400/${searchTerms}?lock=${index + 400}`,
        ],
        stock: stock,
        isPopular: Math.random() > 0.7,
        categoryName: base.category,
        description: `High quality ${item} for your daily needs. Freshly sourced and carefully packed.`
      });
    });
  });
  return generated;
};

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

export async function seedDatabase() {
  console.log("Starting database cleanup and seeding...");
  
  try {
    // 1. Handle Categories
    console.log("Processing categories...");
    const categoriesSnap = await getDocs(collection(db, 'categories'));
    const categoryMap: { [key: string]: string } = {};
    const processedNames = new Set<string>();

    // Cleanup duplicates first
    const cleanupBatch = writeBatch(db);
    let cleanupCount = 0;
    for (const cDoc of categoriesSnap.docs) {
      const name = cDoc.data().name;
      if (processedNames.has(name)) {
        cleanupBatch.delete(cDoc.ref);
        cleanupCount++;
      } else {
        processedNames.add(name);
        categoryMap[name] = cDoc.id;
      }
    }
    if (cleanupCount > 0) {
      console.log(`Deleting ${cleanupCount} duplicate categories...`);
      await cleanupBatch.commit();
    }

    // Seed or Update Categories in a single batch if possible
    const catBatch = writeBatch(db);
    const newCategoryRefs: { [name: string]: any } = {};

    for (const cat of categories) {
      if (!categoryMap[cat.name]) {
        console.log(`Preparing to seed category: ${cat.name}`);
        const newDocRef = doc(collection(db, 'categories'));
        catBatch.set(newDocRef, cat);
        newCategoryRefs[cat.name] = newDocRef;
      } else {
        console.log(`Preparing to update category: ${cat.name}`);
        const docRef = doc(db, 'categories', categoryMap[cat.name]);
        catBatch.update(docRef, { 
          imageUrl: cat.imageUrl,
          order: cat.order 
        });
      }
    }
    
    console.log("Committing category changes...");
    await catBatch.commit();

    // Update categoryMap with newly created IDs
    for (const name in newCategoryRefs) {
      categoryMap[name] = newCategoryRefs[name].id;
    }

    // 2. Handle Products (Delete ALL)
    await clearAllProducts();

    // 3. Seed New Products
    const newProducts = generateProducts();
    console.log(`Seeding exactly ${newProducts.length} new products (10 per category)...`);
    
    let addBatch = writeBatch(db);
    let addCount = 0;
    let totalAdded = 0;

    for (const prod of newProducts) {
      const { categoryName, ...prodData } = prod;
      const categoryId = categoryMap[categoryName];
      
      if (!categoryId) {
        console.error(`CRITICAL: Category not found for product: ${prod.name} (Category: ${categoryName})`);
        throw new Error(`Category mapping failed for ${categoryName}`);
      }

      const newDocRef = doc(collection(db, 'products'));
      addBatch.set(newDocRef, {
        ...prodData,
        categoryId
      });
      addCount++;
      totalAdded++;

      if (addCount === 500) {
        console.log(`Committing batch of 500 products (Total: ${totalAdded})...`);
        await addBatch.commit();
        addBatch = writeBatch(db);
        addCount = 0;
      }
    }
    if (addCount > 0) {
      console.log(`Committing final batch of ${addCount} products...`);
      await addBatch.commit();
    }
    
    console.log(`Database cleanup and seeding complete! Total products seeded: ${totalAdded}`);
  } catch (error) {
    console.error("Critical error in seedDatabase:", error);
    handleFirestoreError(error, OperationType.WRITE, 'seedDatabase');
  }
}
