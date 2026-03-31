import { setDoc, doc, Firestore, collection, addDoc } from 'firebase/firestore';
import { Product } from './types';

const INITIAL_CATEGORIES = [
  'Електроника',
  'Алати',
  'Градежни материјали',
  'Опрема за заштита',
  'Канцелариски материјал'
];

const INITIAL_PRODUCTS: Partial<Product>[] = [
  {
    name: 'LED Сијалица 10W',
    barcode: '5310001001',
    unit: 'pcs',
    purchasePrice: 120,
    sellingPrice: 180,
    currentStock: 150,
    minStock: 50,
    active: true
  },
  {
    name: 'Чекан 500g',
    barcode: '5310001002',
    unit: 'pcs',
    purchasePrice: 350,
    sellingPrice: 550,
    currentStock: 25,
    minStock: 10,
    active: true
  },
  {
    name: 'Цемент 25kg',
    barcode: '5310001003',
    unit: 'box',
    purchasePrice: 280,
    sellingPrice: 340,
    currentStock: 80,
    minStock: 20,
    active: true
  },
  {
    name: 'Заштитни ракавици',
    barcode: '5310001004',
    unit: 'pcs',
    purchasePrice: 45,
    sellingPrice: 80,
    currentStock: 200,
    minStock: 50,
    active: true
  },
  {
    name: 'Хартија A4 80g',
    barcode: '5310001005',
    unit: 'box',
    purchasePrice: 220,
    sellingPrice: 310,
    currentStock: 45,
    minStock: 15,
    active: true
  }
];

export async function seedDatabase(db: Firestore) {
  console.log('Seeding database...');
  
  const categoriesMap: Record<string, string> = {};
  
  // 1. Seed Categories
  for (const catName of INITIAL_CATEGORIES) {
    const docRef = await addDoc(collection(db, 'categories'), { name: catName });
    categoriesMap[catName] = docRef.id;
  }
  
  // 2. Seed Products
  for (const product of INITIAL_PRODUCTS) {
    const catName = INITIAL_CATEGORIES[Math.floor(Math.random() * INITIAL_CATEGORIES.length)];
    const categoryId = categoriesMap[catName];
    
    await addDoc(collection(db, 'products'), {
      ...product,
      categoryId,
      createdAt: new Date().toISOString()
    });
  }
  
  // 3. Seed a default admin user doc (auth must be done separately)
  // This is just the Firestore doc, the Auth user must be created via Firebase Auth
  const demoUserId = 'demo-admin-id'; // This should match a real UID if possible
  await setDoc(doc(db, 'users', demoUserId), {
    id: demoUserId,
    name: 'Admin User',
    email: 'admin@storehouse.mk',
    role: 'Admin',
    active: true,
    createdAt: new Date().toISOString()
  });

  console.log('Seeding complete!');
}
