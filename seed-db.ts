import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { faker } from '@faker-js/faker';
import firebaseConfig from "./firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Use default database

async function seed() {
  try {
    console.log('Starting Firestore seeding...');

    // 1. Create Categories (2)
    console.log('Seeding categories...');
    const categoryNames = [
      'Beverages', 'Food'
    ];
    const categories: { id: string; name: string }[] = [];
    for (const name of categoryNames) {
      const docRef = await addDoc(collection(db, 'categories'), { name });
      categories.push({ id: docRef.id, name });
    }

    // 2. Create Products (5)
    console.log('Seeding products...');
    const units = ['kg', 'l', 'pcs', 'box'];
    const products: { id: string; name: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const product = {
        name: faker.commerce.productName(),
        barcode: faker.string.numeric(12),
        unit: units[faker.number.int({ min: 0, max: 3 })],
        purchasePrice: parseFloat(faker.commerce.price({ min: 10, max: 500 })),
        sellingPrice: 0,
        categoryId: categories[faker.number.int({ min: 0, max: categories.length - 1 })].id,
        currentStock: faker.number.int({ min: 0, max: 100 }),
        minStock: faker.number.int({ min: 5, max: 20 }),
        active: true
      };
      product.sellingPrice = product.purchasePrice * (1 + faker.number.float({ min: 0.2, max: 0.5 }));
      
      const docRef = await addDoc(collection(db, 'products'), product);
      products.push({ id: docRef.id, ...product });
    }

    // 3. Create Invoices (5)
    console.log('Seeding invoices...');
    for (let i = 0; i < 5; i++) {
      const invoice = {
        invoiceNumber: `INV-${faker.string.alphanumeric(8).toUpperCase()}`,
        supplierName: faker.company.name(),
        date: faker.date.past().toISOString(),
        totalAmount: faker.number.int({ min: 1000, max: 10000 }),
        status: 'completed',
        userId: 'system-seed'
      };
      await addDoc(collection(db, 'invoices'), invoice);
    }

    console.log('Firestore seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
