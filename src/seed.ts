import { db } from './firebase';
import { collection, addDoc, getDocs, query, limit, deleteDoc, doc, updateDoc } from 'firebase/firestore';

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
  { category: "Fruits & Vegetables", items: ["Apple", "Orange", "Grapes", "Mango", "Watermelon", "Potato", "Onion", "Carrot", "Spinach", "Broccoli", "Cauliflower", "Cucumber", "Bell Pepper", "Garlic", "Ginger", "Lemon", "Pomegranate", "Kiwi", "Papaya", "Pineapple"] },
  { category: "Dairy, Bread & Eggs", items: ["Milk", "Curd", "Paneer", "Cheese", "Butter", "Eggs", "Brown Bread", "White Bread", "Multigrain Bread", "Yogurt", "Ghee", "Cream", "Buttermilk", "Condensed Milk", "Soy Milk", "Almond Milk", "Tofu", "Lassi", "Margarine", "Mayonnaise"] },
  { category: "Personal Care", items: ["Shampoo", "Conditioner", "Soap", "Face Wash", "Body Wash", "Toothpaste", "Toothbrush", "Mouthwash", "Deodorant", "Perfume", "Hand Wash", "Sanitizer", "Lotion", "Sunscreen", "Hair Oil", "Hair Gel", "Shaving Cream", "Razor", "Face Cream", "Lip Balm"] },
  { category: "Study Materials", items: ["Notebook", "Pen", "Pencil", "Eraser", "Sharpener", "Scale", "Marker", "Highlighter", "Glue", "Stapler", "Paper Clips", "Folder", "Calculator", "Diary", "Sketch Pens", "Crayons", "Water Colors", "Paint Brush", "Geometry Box", "Sticky Notes"] },
  { category: "Snacks & Munchies", items: ["Potato Chips", "Nachos", "Popcorn", "Biscuits", "Cookies", "Chocolate", "Wafers", "Namkeen", "Roasted Makhana", "Dry Fruits", "Peanuts", "Cashews", "Almonds", "Pistachios", "Walnuts", "Dates", "Raisins", "Energy Bar", "Protein Bar", "Corn Flakes"] },
  { category: "Beverages", items: ["Tea", "Coffee", "Green Tea", "Fruit Juice", "Energy Drink", "Soft Drink", "Mineral Water", "Coconut Water", "Iced Tea", "Cold Coffee", "Milkshake", "Smoothie", "Lemonade", "Squash", "Syrup", "Health Drink", "Soda", "Tonic Water", "Ginger Ale", "Hot Chocolate"] },
  { category: "Household Essentials", items: ["Detergent", "Dishwash Bar", "Floor Cleaner", "Toilet Cleaner", "Glass Cleaner", "Air Freshener", "Garbage Bags", "Kitchen Roll", "Toilet Paper", "Scrub Pad", "Sponge", "Napkins", "Matches", "Candles", "Incense Sticks", "Battery", "Bulb", "Mosquito Repellent", "Fabric Softener", "Bleach"] },
];

const brands = ["Premium", "Fresh", "Organic", "Natural", "Daily", "Value", "Select", "Choice", "Best", "Pure"];

const generateProducts = () => {
  const generated: any[] = [];
  productBases.forEach(base => {
    base.items.forEach((item, index) => {
      const price = Math.floor(Math.random() * (200 - 20 + 1)) + 20;
      const stock = Math.floor(Math.random() * 200) + 10;
      const brand = brands[Math.floor(Math.random() * brands.length)];
      
      // Refined keywords for better accuracy: item name + "product" + "whitebackground"
      // This usually yields cleaner, more accurate product shots
      const searchTerms = `${item.toLowerCase().replace(/\s+/g, ',')},product,whitebackground`;
      
      generated.push({
        name: `${brand} ${item}`,
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
        description: `High quality ${brand} ${item} for your daily needs. Freshly sourced and carefully packed.`
      });
    });
  });
  return generated;
};

export async function seedDatabase() {
  console.log("Starting database cleanup and seeding...");
  
  // 1. Handle Categories (Cleanup Duplicates and Seed)
  const categoriesSnap = await getDocs(collection(db, 'categories'));
  const categoryDocs = categoriesSnap.docs;
  const categoryMap: { [key: string]: string } = {};
  const processedNames = new Set<string>();

  // Cleanup duplicates first
  for (const cDoc of categoryDocs) {
    const name = cDoc.data().name;
    if (processedNames.has(name)) {
      console.log(`Deleting duplicate category: ${name}`);
      await deleteDoc(doc(db, 'categories', cDoc.id));
    } else {
      processedNames.add(name);
      categoryMap[name] = cDoc.id;
    }
  }

  // Seed or Update
  for (const cat of categories) {
    try {
      if (!categoryMap[cat.name]) {
        console.log(`Seeding category: ${cat.name}`);
        const docRef = await addDoc(collection(db, 'categories'), cat);
        categoryMap[cat.name] = docRef.id;
      } else {
        console.log(`Updating category: ${cat.name}`);
        await updateDoc(doc(db, 'categories', categoryMap[cat.name]), { 
          imageUrl: cat.imageUrl,
          order: cat.order 
        });
      }
    } catch (error) {
      console.warn(`Failed to process category ${cat.name}:`, error);
    }
  }

  // 2. Handle Products (Cleanup Duplicates and Seed New)
  const productsSnap = await getDocs(collection(db, 'products'));
  const productDocs = productsSnap.docs;
  const newProducts = generateProducts();
  const newProductNames = new Set(newProducts.map(p => p.name));
  
  console.log("Cleaning up old products and updating images...");
  for (const pDoc of productDocs) {
    try {
      const data = pDoc.data();
      // Delete if it's a duplicate or not in the new simplified list
      if (!newProductNames.has(data.name)) {
        console.log(`Deleting old/duplicate product: ${data.name}`);
        await deleteDoc(doc(db, 'products', pDoc.id));
      } else {
        // Force update all fields for existing products to ensure consistency
        const productInfo = newProducts.find(p => p.name === data.name);
        if (productInfo) {
          console.log(`Updating product: ${data.name}`);
          const { categoryName, ...prodData } = productInfo;
          await updateDoc(doc(db, 'products', pDoc.id), { ...prodData });
        }
      }
    } catch (error) {
      console.warn(`Failed to process product document ${pDoc.id}:`, error);
      // Ignore "not found" errors as they likely mean another process handled it
    }
  }

  // Fetch again after cleanup to see what's left
  const remainingProductsSnap = await getDocs(collection(db, 'products'));
  const remainingNames = new Set(remainingProductsSnap.docs.map(d => d.data().name));

  console.log(`Seeding ${newProducts.length} products...`);
  for (const prod of newProducts) {
    if (!remainingNames.has(prod.name)) {
      const { categoryName, ...prodData } = prod;
      const categoryId = categoryMap[categoryName] || Object.values(categoryMap)[0];
      await addDoc(collection(db, 'products'), {
        ...prodData,
        categoryId
      });
      remainingNames.add(prod.name);
    }
  }
  
  console.log("Database cleanup and seeding complete!");
}
